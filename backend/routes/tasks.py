from flask import Blueprint, jsonify, request
from models import db, Task, ActivityAssignment, Actor, Diary1, Customer
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import logging
import threading
import os
from models import ReminderMail, HolidayMaster
from flask_cors import cross_origin
import traceback

from datetime import datetime, timedelta, time


tasks_bp = Blueprint('tasks', __name__)

@tasks_bp.route('/tasks', methods=['GET'])
def get_tasks():
    try:
        # Get user information from request
        user_id = request.args.get('user_id')
        role_id = request.args.get('role_id')
        
        # Get filters if provided
        auditor_id = request.args.get('auditor_id')
        client_id = request.args.get('client_id')
        
        print(f"Fetching tasks with filters - User ID: {user_id}, Role ID: {role_id}, "
              f"Auditor ID: {auditor_id}, Client ID: {client_id}")
        
        # Base query with ordering by assigned_timestamp in descending order
        query = Task.query.order_by(Task.assigned_timestamp.desc())
        
        # Apply filters based on role and parameters
        if auditor_id:
            print(f"Filtering tasks for auditor_id: {auditor_id}")
            query = query.filter(Task.actor_id == auditor_id)
        elif client_id:
            print(f"Filtering tasks for client_id: {client_id}")
            customer = Customer.query.filter_by(customer_id=client_id).first()
            if customer:
                query = query.filter(Task.customer_name == customer.customer_name)
            else:
                return jsonify([])
        elif role_id != "11":  # Not admin
            if user_id:
                query = query.filter(Task.actor_id == user_id)
            else:
                return jsonify([])
        
        # Execute query and get all tasks
        tasks = query.all()
        print(f"Found {len(tasks)} tasks for the given filters")
        
        # Convert tasks to response format
        tasks_response = [{
            'id': str(task.task_id),
            'task_name': task.task_name,
            'link': task.link,
            'status': task.status,
            'criticality': task.criticality,
            'assignee': task.assigned_to,
            'actor_id': str(task.actor_id),
            'due_date': task.duedate.isoformat() if task.duedate else None,
            'initiator': task.initiator,
            'time_taken': task.duration,
            'customer_name': task.customer_name,
            'title': task.task_name,
            'remarks': task.remarks,
            'assigned_timestamp': task.assigned_timestamp.isoformat() if task.assigned_timestamp else None
        } for task in tasks]
        
        return jsonify(tasks_response)
        
    except Exception as e:
        print("Error fetching tasks:", e)
        return jsonify({'error': 'Failed to fetch tasks'}), 500
    

def map_status(status):
    """Map the status from the database to a user-friendly format."""
    status_mapping = {
        'Yet to Start': 'todo',
        'WIP': 'in-progress',
        'Completed': 'completed'
    }
    return status_mapping.get(status, 'todo')


def calculate_new_duedate(start_date, iteration, frequency):
    """Calculate the new due date based on frequency."""
    return start_date + timedelta(days=(365 // frequency) * iteration)

def is_weekend_or_holiday(date):
    """Check if the date is a weekend or in the holidays list."""
    return date.weekday() >= 5  # Saturday (5) or Sunday (6)

def adjust_to_previous_working_day(date):
    """Adjust the given date to the previous working day if it falls on a weekend or holiday."""
    while is_weekend_or_holiday(date):
        date -= timedelta(days=1)
    return date


def schedule_email_reminder(subject, task, email, reminder_date, email_type='reminder'):
    """Schedule an email reminder by adding it to the database"""
    try:
        # Ensure reminder_date is a date object
        if isinstance(reminder_date, datetime):
            reminder_date = reminder_date.date()
            
        # Convert reminder_date to datetime with time component for the reminder
        reminder_time = time(9, 0)  # 9:00 AM
        
        # Create new reminder entry
        new_reminder = ReminderMail(
            task_id=task.task_id,
            message_des=f"{task.task_name} for {task.customer_name}",
            date=reminder_date,
            time=reminder_time,
            email_id=email,
            status="Pending",
            email_type=email_type
        )
        
        db.session.add(new_reminder)
        db.session.commit()
        
        print(f"✅ Reminder scheduled for {reminder_date} at {reminder_time} to {email}")
        return True
    except Exception as e:
        db.session.rollback()
        print(f"❌ Failed to schedule reminder: {e}")
        return False



def calculate_reminder_date(due_date, duration):
    """Calculate when to send a reminder based on task duration and due date"""
    if not due_date:
        return None
    
    # Convert due_date to date object if it's a datetime
    if isinstance(due_date, datetime):
        due_date = due_date.date()
        
    # For tasks with duration <= 1 day, remind 1 day before
    # For longer tasks, remind earlier based on duration
    if duration and duration > 1:
        days_before = min(int(duration), 7)  # Max 7 days before
    else:
        days_before = 1  # Default 1 day before
        
    reminder_date = due_date - timedelta(days=days_before)
    
    # Ensure reminder date is not in the past
    today = datetime.now().date()
    if reminder_date < today:
        reminder_date = today
        
    return reminder_date

def send_styled_email(subject, recipient, task, email_type='reassignment'):
    """
    Send a professionally styled HTML email for task operations
    email_type can be: 'assignment', 'reassignment', 'status_update', 'reminder', or 'due_today'
    """
    try:
        # Email configuration
        sender_email = "loukyarao68@gmail.com"
        password = "vafx kqve dwmj mvjv"
        
        # Create message container with the correct format for HTML emails
        msg = MIMEMultipart()
        msg['Subject'] = subject
        msg['From'] = sender_email
        msg['To'] = recipient
        
        # Prepare HTML content based on email type
        if email_type == 'assignment':
            # HTML content for new assignment with proper escaping of CSS curly braces
            html_body = f'''
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>New Task Assignment</title>
                <style>
                    body {{ margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #333333; background-color: #f7f7f7; }}
                    table {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; }}
                    td.header {{ background: linear-gradient(to right, #3498db, #2980b9); padding: 20px; text-align: center; color: white; }}
                    h1 {{ margin: 0; font-size: 28px; font-weight: bold; }}
                    h2 {{ margin: 10px 0 0 0; font-size: 20px; font-weight: normal; }}
                </style>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #333333; background-color: #f7f7f7;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                    <!-- Header with ProSync Logo -->
                    <tr>
                        <td style="background: linear-gradient(to right, #3498db, #2980b9); padding: 20px; text-align: center; color: white;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">ProSync</h1>
                            <h2 style="margin: 10px 0 0 0; font-size: 20px; font-weight: normal;">New Task Assignment</h2>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 30px 20px;">
                            <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>{task.assigned_to}</strong>,</p>
                            
                            <div style="background-color: #e8f4fc; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0;">
                                <p style="margin: 0; font-size: 15px;">A new task <strong>"{task.task_name}"</strong> has been assigned to you for customer <strong>"{task.customer_name}"</strong>.</p>
                            </div>
                            
                            <!-- Task Details Table -->
                            <table border="0" cellpadding="8" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 6px; margin: 20px 0;">
                                <tr>
                                    <td width="35%" style="font-weight: bold; color: #555555;">Task Name:</td>
                                    <td><strong>{task.task_name}</strong></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: bold; color: #555555;">Task ID:</td>
                                    <td>{task.task_id}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight: bold; color: #555555;">Customer:</td>
                                    <td>{task.customer_name}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight: bold; color: #555555;">Criticality:</td>
                                    <td style="color: {'#e74c3c' if task.criticality and task.criticality.lower() == 'high' else '#f39c12' if task.criticality and task.criticality.lower() == 'medium' else '#27ae60'};"><strong>{task.criticality}</strong></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: bold; color: #555555;">Due Date:</td>
                                    <td>{task.duedate.strftime('%d %b, %Y') if task.duedate else 'Not specified'}</td>
                                </tr>
                                <tr>
                                    <td style="font-weight: bold; color: #555555;">Status:</td>
                                    <td>{task.status}</td>
                                </tr>
                            </table>
                            
                            <p style="margin: 20px 0;">This task has been added to your calendar. Please review the details and begin work at your earliest convenience.</p>
                            
                            <!-- Action Button -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
                                <tr>
                                    <td>
                                        <a href="http://localhost:3000/tasks" style="display: inline-block; background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Task Details</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f1f5f9; padding: 15px; text-align: center; color: #666666; font-size: 12px;">
                            <p style="margin: 5px 0;">Best regards,<br>ProSync Team</p>
                            <p style="margin: 10px 0 0 0;">This is an automated message. Please do not reply to this email.</p>
                            <p style="margin: 5px 0;">&copy; {datetime.now().year} ProSync. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            '''
            
            # Plain text version as fallback
            text_body = f'''
Dear {task.assigned_to},

A new task '{task.task_name}' has been assigned to you for customer '{task.customer_name}'.

- Task Name: {task.task_name}
- Task ID: {task.task_id}
- Criticality: {task.criticality}
- Due Date: {task.duedate.strftime('%Y-%m-%d') if task.duedate else 'Not specified'}
- Status: {task.status}

This task has been added to your calendar. Please review the details and begin work at your earliest convenience.

You can view the task at: http://localhost:3000/tasks

Best regards,
ProSync Team
            '''
            
        elif email_type == 'reassignment':
            html_body = f'''
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1); }}
                    .header {{ background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 20px; text-align: center; }}
                    .header h1 {{ margin: 0; font-size: 24px; }}
                    .logo {{ font-weight: bold; font-size: 28px; margin-bottom: 10px; }}
                    .content {{ padding: 20px 30px; }}
                    .task-details {{ background-color: #f1f5f9; border-radius: 6px; padding: 15px; margin: 15px 0; }}
                    .detail-row {{ margin-bottom: 8px; display: flex; }}
                    .detail-label {{ font-weight: bold; width: 120px; color: #555; }}
                    .footer {{ text-align: center; padding: 15px; background-color: #f1f5f9; color: #666; font-size: 12px; }}
                    .button {{ display: inline-block; background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px; font-weight: bold; }}
                    .critical-high {{ color: #e74c3c; }}
                    .critical-medium {{ color: #f39c12; }}
                    .critical-low {{ color: #27ae60; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">ProSync</div>
                        <h1>Task Reassignment Notification</h1>
                    </div>
                    <div class="content">
                        <p>Hello {task.assigned_to},</p>
                        <p>A task has been reassigned to you in the ProSync system.</p>
                        
                        <div class="task-details">
                            <div class="detail-row">
                                <div class="detail-label">Task Name:</div>
                                <div>{task.task_name}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Task ID:</div>
                                <div>{task.task_id}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Customer:</div>
                                <div>{task.customer_name}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Criticality:</div>
                                <div class="{'critical-high' if task.criticality and task.criticality.lower() == 'high' else 'critical-medium' if task.criticality and task.criticality.lower() == 'medium' else 'critical-low'}">{task.criticality}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Due Date:</div>
                                <div>{task.duedate.strftime('%d %b, %Y') if task.duedate else 'Not specified'}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Status:</div>
                                <div>{task.status}</div>
                            </div>
                        </div>
                        
                        <p>Please review this task and ensure it is completed by the due date.</p>
                        
                        <a href="http://localhost:3000/tasks" class="button">View Task</a>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from ProSync. Please do not reply to this email.</p>
                        <p>&copy; {datetime.now().year} ProSync. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            '''
            
            # Plain text version as fallback
            text_body = f'''
Hello {task.assigned_to},

A task has been reassigned to you in the ProSync system.

- Task Name: {task.task_name}
- Task ID: {task.task_id}
- Customer: {task.customer_name}
- Criticality: {task.criticality}
- Due Date: {task.duedate.strftime('%d %b, %Y') if task.duedate else 'Not specified'}
- Status: {task.status}

Please review this task and ensure it is completed by the due date.

You can view the task at: http://localhost:3000/tasks

Best regards,
ProSync Team
            '''
            
        elif email_type == 'status_update':
            html_body = f'''
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1); }
                    .header { background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 20px; text-align: center; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .logo { font-weight: bold; font-size: 28px; margin-bottom: 10px; }
                    .content { padding: 20px 30px; }
                    .task-details { background-color: #f1f5f9; border-radius: 6px; padding: 15px; margin: 15px 0; }
                    .detail-row { margin-bottom: 8px; display: flex; }
                    .detail-label { font-weight: bold; width: 120px; color: #555; }
                    .footer { text-align: center; padding: 15px; background-color: #f1f5f9; color: #666; font-size: 12px; }
                    .button { display: inline-block; background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px; font-weight: bold; }
                    .critical-high { color: #e74c3c; }
                    .critical-medium { color: #f39c12; }
                    .critical-low { color: #27ae60; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">ProSync</div>
                        <h1>Task Status Update</h1>
                    </div>
                    <div class="content">
                        <p>Hello {task.assigned_to},</p>
                        <p>The status of your task has been updated in the ProSync system.</p>
                        
                        <div class="task-details">
                            <div class="detail-row">
                                <div class="detail-label">Task Name:</div>
                                <div>{task.task_name}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Task ID:</div>
                                <div>{task.task_id}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Customer:</div>
                                <div>{task.customer_name}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Criticality:</div>
                                <div class="{'critical-high' if task.criticality and task.criticality.lower() == 'high' else 'critical-medium' if task.criticality and task.criticality.lower() == 'medium' else 'critical-low'}">{task.criticality}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Due Date:</div>
                                <div>{task.duedate.strftime('%d %b, %Y') if task.duedate else 'Not specified'}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">New Status:</div>
                                <div><strong>{task.status}</strong></div>
                            </div>
                        </div>
                        
                        <p>Please check your ProSync dashboard for more details.</p>
                        
                        <a href="http://localhost:3000/tasks" class="button">View Dashboard</a>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from ProSync. Please do not reply to this email.</p>
                        <p>&copy; {datetime.now().year} ProSync. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            '''
            
            # Plain text version as fallback
            text_body = f'''
Hello {task.assigned_to},

The status of your task has been updated in the ProSync system.

- Task Name: {task.task_name}
- Task ID: {task.task_id}
- Customer: {task.customer_name}
- Criticality: {task.criticality}
- Due Date: {task.duedate.strftime('%d %b, %Y') if task.duedate else 'Not specified'}
- New Status: {task.status}

Please check your ProSync dashboard for more details.

You can view the task at: http://localhost:3000/tasks

Best regards,
ProSync Team
            '''
            
        elif email_type == 'reminder':
            html_body = f'''
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1); }
                    .header { background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 20px; text-align: center; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .logo { font-weight: bold; font-size: 28px; margin-bottom: 10px; }
                    .content { padding: 20px 30px; }
                    .task-details { background-color: #f1f5f9; border-radius: 6px; padding: 15px; margin: 15px 0; }
                    .detail-row { margin-bottom: 8px; display: flex; }
                    .detail-label { font-weight: bold; width: 120px; color: #555; }
                    .footer { text-align: center; padding: 15px; background-color: #f1f5f9; color: #666; font-size: 12px; }
                    .button { display: inline-block; background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px; font-weight: bold; }
                    .critical-high { color: #e74c3c; }
                    .critical-medium { color: #f39c12; }
                    .critical-low { color: #27ae60; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">ProSync</div>
                        <h1>Task Reminder</h1>
                    </div>
                    <div class="content">
                        <p>Hello {task.assigned_to},</p>
                        <p>This is a friendly reminder about your upcoming task deadline.</p>
                        
                        <div class="task-details">
                            <div class="detail-row">
                                <div class="detail-label">Task Name:</div>
                                <div>{task.task_name}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Task ID:</div>
                                <div>{task.task_id}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Customer:</div>
                                <div>{task.customer_name}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Criticality:</div>
                                <div class="{'critical-high' if task.criticality and task.criticality.lower() == 'high' else 'critical-medium' if task.criticality and task.criticality.lower() == 'medium' else 'critical-low'}">{task.criticality}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Due Date:</div>
                                <div>{task.duedate.strftime('%d %b, %Y') if task.duedate else 'Not specified'}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Status:</div>
                                <div>{task.status}</div>
                            </div>
                        </div>
                        
                        <div class="countdown">
                            Task is due in a few days!
                        </div>
                        
                        <p>Please ensure this task is completed on time. If you need any assistance, please contact your supervisor.</p>
                        
                        <a href="http://localhost:3000/tasks" class="button">Check Task</a>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from ProSync. Please do not reply to this email.</p>
                        <p>&copy; {datetime.now().year} ProSync. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            '''
            
            # Plain text version as fallback
            text_body = f'''
Hello {task.assigned_to},

This is a friendly reminder about your upcoming task deadline.

- Task Name: {task.task_name}
- Task ID: {task.task_id}
- Customer: {task.customer_name}
- Criticality: {task.criticality}
- Due Date: {task.duedate.strftime('%d %b, %Y') if task.duedate else 'Not specified'}
- Status: {task.status}

Task is due in a few days!

Please ensure this task is completed on time. If you need any assistance, please contact your supervisor.

You can check the task at: http://localhost:3000/tasks

Best regards,
ProSync Team
            '''
            
        elif email_type == 'due_today':
            html_body = f'''
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1); }
                    .header { background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 20px; text-align: center; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .logo { font-weight: bold; font-size: 28px; margin-bottom: 10px; }
                    .content { padding: 20px 30px; }
                    .task-details { background-color: #f1f5f9; border-radius: 6px; padding: 15px; margin: 15px 0; }
                    .detail-row { margin-bottom: 8px; display: flex; }
                    .detail-label { font-weight: bold; width: 120px; color: #555; }
                    .footer { text-align: center; padding: 15px; background-color: #f1f5f9; color: #666; font-size: 12px; }
                    .button { display: inline-block; background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px; font-weight: bold; }
                    .critical-high { color: #e74c3c; }
                    .critical-medium { color: #f39c12; }
                    .critical-low { color: #27ae60; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">ProSync</div>
                        <h1>TASK DUE TODAY</h1>
                    </div>
                    <div class="content">
                        <p>Hello {task.assigned_to},</p>
                        
                        <div class="urgent">
                            <p><strong>Important:</strong> Your task "{task.task_name}" for customer "{task.customer_name}" is due today!</p>
                        </div>
                        
                        <div class="task-details">
                            <div class="detail-row">
                                <div class="detail-label">Task Name:</div>
                                <div>{task.task_name}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Task ID:</div>
                                <div>{task.task_id}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Customer:</div>
                                <div>{task.customer_name}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Criticality:</div>
                                <div class="{'critical-high' if task.criticality and task.criticality.lower() == 'high' else 'critical-medium' if task.criticality and task.criticality.lower() == 'medium' else 'critical-low'}">{task.criticality}</div>
                            </div>
                            <div class="detail-row">
                                <div class="detail-label">Status:</div>
                                <div>{task.status}</div>
                            </div>
                        </div>
                        
                        <p>Please complete this task today. If you have already completed it, please update the status in the system.</p>
                        
                        <a href="http://localhost:3000/tasks" class="button">Go to Task</a>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from ProSync. Please do not reply to this email.</p>
                        <p>&copy; {datetime.now().year} ProSync. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            '''
            
            # Plain text version as fallback
            text_body = f'''
Hello {task.assigned_to},

Important: Your task "{task.task_name}" for customer "{task.customer_name}" is due today!

- Task Name: {task.task_name}
- Task ID: {task.task_id}
- Customer: {task.customer_name}
- Criticality: {task.criticality}
- Status: {task.status}

Please complete this task today. If you have already completed it, please update the status in the system.

You can go to the task at: http://localhost:3000/tasks

Best regards,
ProSync Team
            '''
        
        # Attach plain text and HTML parts
        text_part = MIMEText(text_body, 'plain')
        html_part = MIMEText(html_body, 'html')
        
        # The order is important - attach plain text first, then HTML
        msg.attach(text_part)
        msg.attach(html_part)
        
        # Send the email
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, password)
            server.send_message(msg)
            
        print(f"✅ Email sent successfully to {recipient}")
        return True
    except Exception as e:
        print(f"❌ Failed to send email: {str(e)}")
        traceback.print_exc()
        return False

def send_email_task(subject, to_email, task, email_type='reminder'):
    """Send an email notification about a task"""
    try:
        # Use the styled email function
        success = send_styled_email(subject, to_email, task, email_type)
        
        # Log the email status in the database
        try:
            if success:
                db.session.query(ReminderMail).filter_by(
                    email_id=to_email,
                    task_id=task.task_id,
                    status="Pending"
                ).update({'status': 'Sent'})
            else:
                db.session.query(ReminderMail).filter_by(
                    email_id=to_email,
                    task_id=task.task_id,
                    status="Pending"
                ).update({'status': 'Failed'})
                
            db.session.commit()
        except Exception as update_error:
            logging.error(f"Error updating reminder status: {update_error}")
            
        return success
    except Exception as e:
        logging.error(f"Error in send_email_task: {e}")
        return False

def send_email(subject, recipient, body):
    """Send an email using SMTP"""
    try:
        # Email configuration
        sender_email = "loukyarao68@gmail.com"  # Replace with your email
        password = "vafx kqve dwmj mvjv" # Replace with your app-specific password
        
        # Create message
        message = MIMEMultipart()
        message["From"] = sender_email
        message["To"] = recipient
        message["Subject"] = subject
        
        # Add body to email
        message.attach(MIMEText(body, "plain"))
        
        # Connect to server and send email
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(sender_email, password)
            server.sendmail(sender_email, recipient, message.as_string())
            
        print(f"✅ Email sent successfully to {recipient}")
        return True
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False

def adjust_due_date(date, criticality):
    """ Adjusts the due date based on weekends and holidays.
        - If criticality is 'High', shift backward.
        - Otherwise, shift forward. """

    try:
        # Fetch holiday dates correctly from the database
        holiday_dates = {holiday[0] for holiday in db.session.query(HolidayMaster.Date).all()}

        print(f"🔍 Checking Date: {date} | Criticality: {criticality}")

        # Adjust for weekends and holidays
        while date.weekday() >= 5 or date in holiday_dates:  # Saturday (5) or Sunday (6) or holiday
            if criticality.lower() == "high":
                date -= timedelta(days=1)  # Shift backward for high criticality
            else:
                date += timedelta(days=1)  # Shift forward for normal criticality
            print(f"🔄 Adjusted Date: {date}")

        return date
    except Exception as e:
        print(f"🚨 ERROR in adjust_due_date: {e}")
        return date  # Return original date if an error occurs

def calculate_time_taken(task_id):
    """Calculate total time taken from diary1 records for a task"""
    try:
        diary_records = Diary1.query.filter_by(task=str(task_id)).all()
        total_time = 0.0
       
        for record in diary_records:
            if record.start_time and record.end_time:
                # Convert time strings to datetime objects
                start = datetime.combine(record.date, record.start_time)
                end = datetime.combine(record.date, record.end_time)
               
                # Calculate difference in hours
                time_diff = (end - start).total_seconds() / 3600
                total_time += time_diff
       
        return round(total_time, 2)
    except Exception as e:
        print(f"Error calculating time taken: {e}")
        return 0.0



@tasks_bp.route('/tasks/<task_id>', methods=['PATCH'])
@cross_origin()
def update_task(task_id):
    try:
        # Get user information from request
        user_id = request.args.get('user_id')
        role_id = request.args.get('role_id')
        
        print(f"Received update request for task {task_id} from user {user_id} with role {role_id}")
        print(f"Request data: {request.json}")
        
        # Validate user authentication
        if not user_id or not role_id:
            return jsonify({
                "success": False, 
                "error": "Authentication required. Please provide user_id and role_id"
            }), 401
        
        # Get the task
        task = Task.query.filter_by(task_id=task_id).first()
        if not task:
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Check permissions - allow both the assigned user and admins to update
        if role_id != "11" and str(task.actor_id) != str(user_id):
            return jsonify({
                "success": False, 
                "error": "You don't have permission to update this task"
            }), 403
        
        # Get the data to update
        data = request.json
        
        # Store original values for comparison
        original_status = task.status
        original_assigned_to = task.assigned_to
        original_actor_id = task.actor_id
        original_duedate = task.duedate
        
        # Update the task
        if 'status' in data:
            task.status = data['status']
            print(f"Updating task status to: {task.status}")
            
            # If status is changed to Completed, calculate and update time_taken
            if task.status == 'Completed' and original_status != 'Completed':
                time_taken = calculate_time_taken(task_id)
                task.time_taken = time_taken
                task.actual_date = datetime.now().date()
                print(f"Task completed. Total time taken: {time_taken} hours")
        
        # Update remarks if provided
        if 'remarks' in data:
            task.remarks = data['remarks']
        
        # Save changes
        db.session.commit()
        print(f"✅ Successfully updated task {task_id} status to {task.status}")
        
        # Handle notifications (wrapped in try-except to prevent notification errors from failing the update)
        try:
            assigned_actor = Actor.query.filter_by(actor_id=task.actor_id).first()
            if assigned_actor and assigned_actor.email_id:
                # Send status update notification
                if original_status != task.status:
                    subject = f"Task Status Updated: {task.task_name}"
                    send_styled_email(subject, assigned_actor.email_id, task, 'status_update')
        except Exception as e:
            print(f"Warning: Failed to send notification: {e}")
            # Continue execution even if notification fails
        
        return jsonify({
            "success": True, 
            "message": "Task updated successfully",
            "task": {
                "id": task.task_id,
                "status": task.status,
                "remarks": task.remarks
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"🚨 ERROR in update_task: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
 

@tasks_bp.route('/tasks', methods=['POST'])
def create_task():
    try:
        # Get user information from request
        role_id = request.args.get('role_id')
        
        # Only admins can create tasks
        if role_id != "11":
            return jsonify({'error': 'Only administrators can create tasks'}), 403
            
        data = request.json
        
        # Create the new task
        new_task = Task(
            task_name=data['title'],
            status=data.get('status', 'Yet to Start'),  # Use the correct status values
            criticality=data.get('criticality', 'Medium'),
            actor_id=data.get('assignee'),
            duedate=datetime.strptime(data['due_date'], '%Y-%m-%d').date() if data.get('due_date') else None,
            activity_id=data.get('activity_id'),
            customer_name=data.get('customer_name', 'General'),
            initiator=data.get('initiator', 'Admin')
        )
        
        # If an assignee is provided, get the assignee name
        assignee_email = None
        if data.get('assignee'):
            assignee = Actor.query.filter_by(actor_id=data['assignee']).first()
            if assignee:
                new_task.assigned_to = assignee.actor_name
                assignee_email = assignee.email_id
        
        # Add the task to the database
        db.session.add(new_task)
        db.session.commit()
        
        # Send assignment email if there's an assignee
        if assignee_email:
            subject = f"ProSync - New Task Assignment: {new_task.task_name}"
            send_styled_email(subject, assignee_email, new_task, 'assignment')
            
            # Also schedule reminder emails
            if new_task.duedate:
                # Calculate reminder date
                reminder_date = calculate_reminder_date(new_task.duedate, new_task.duration)
                
                # Schedule the reminder email
                schedule_email_reminder(
                    f"ProSync - Reminder: {new_task.task_name}",
                    new_task,
                    assignee_email,
                    reminder_date,
                    'reminder'
                )
                
                # Schedule due date reminder
                schedule_email_reminder(
                    f"ProSync - Due Today: {new_task.task_name}",
                    new_task,
                    assignee_email,
                    new_task.duedate,
                    'due_today'
                )
        
        # Return the created task data
        return jsonify({
            'id': new_task.task_id,
            'title': new_task.task_name,
            'status': new_task.status,
            'criticality': new_task.criticality,
            'assignee': new_task.actor_id,
            'due_date': new_task.duedate.isoformat() if new_task.duedate else None,
            'email_sent': assignee_email is not None
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error creating task: {e}")
        traceback.print_exc()  # Add traceback for better debugging
        return jsonify({'error': f'Failed to create task: {str(e)}'}), 500

@tasks_bp.route('/assign_activity', methods=['POST'])
def assign_activity():
    try:
        data = request.form
        # ... existing validation code ...
        
        # Create the task
        new_task = Task(
            task_id=task_id,
            task_name=activity.activity_name,
            criticality=criticality,
            duration=duration,
            status=status,
            link=link,
            customer_name=customer.customer_name,
            duedate=due_date,
            actor_id=assigned_actor_id,
            assigned_to=assigned_to,
            activity_id=activity_id,
            initiator=initiator,
            activity_type=activity_type,
            stage_id=1,
            assigned_timestamp=current_timestamp
        )
        db.session.add(new_task)
        db.session.commit()
        
        # ... existing email and calendar code ...
        
        # Return the new task data along with success message
        return jsonify({
            'success': True,
            'message': 'Activity assigned successfully and notification sent',
            'email_sent': True,
            'calendar_added': calendar_event_id is not None,
            'reminders_scheduled': True,
            'task': {
                'id': str(new_task.task_id),
                'task_name': new_task.task_name,
                'link': new_task.link,
                'status': new_task.status,
                'criticality': new_task.criticality,
                'assignee': new_task.assigned_to,
                'actor_id': str(new_task.actor_id),
                'due_date': new_task.duedate.isoformat() if new_task.duedate else None,
                'initiator': new_task.initiator,
                'time_taken': new_task.duration,
                'customer_name': new_task.customer_name,
                'title': new_task.task_name,
                'remarks': new_task.remarks,
                'assigned_timestamp': new_task.assigned_timestamp.isoformat()
            }
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"🚨 Error Assigning Activity: {e}")
        return jsonify({'success': False, 'message': f'Failed to assign activity: {str(e)}'}), 500

@tasks_bp.route('/employees', methods=['GET'])
def get_employees():
    try:
        # Get user information from request
        user_id = request.args.get('user_id')
        role_id = request.args.get('role_id')
        
        # Only admins can see all employees
        if role_id == "11":
            employees = Actor.query.all()
        else:
            # Regular users can only see themselves
            employees = Actor.query.filter_by(actor_id=user_id).all()
        
        # Log the number of employees found for debugging
        print(f"Found {len(employees)} employees")
        
        # Return a simplified list with just id and name
        return jsonify([{
            'id': employee.actor_id,
            'name': employee.actor_name
        } for employee in employees])
    except Exception as e:
        print("Error fetching employees:", e)
        return jsonify({'error': 'Failed to fetch employees'}), 500

@tasks_bp.route('/api/actors', methods=['GET'])
def get_actors():
    try:
        # Get query parameters
        status = request.args.get('status', 'A')  # Default to 'A' if not provided
        role_id = request.args.get('role_id', '22')  # Default to '22' if not provided
        
        # Query active auditors with role_id 22
        actors = Actor.query.filter(
            Actor.status == status,
            Actor.role_id == role_id
        ).order_by(Actor.actor_name).all()  # Add ordering for consistency
        
        # Format the response - ensure IDs are strings for consistency
        actors_list = [{
            'id': str(actor.actor_id),  # Convert to string
            'name': actor.actor_name,
            'email': actor.email_id  # Include email for verification
        } for actor in actors]
        
        print(f"Fetched {len(actors_list)} actors: {actors_list}")  # Add logging
        return jsonify(actors_list)
    
    except Exception as e:
        print(f"Error fetching actors: {e}")
        return jsonify({'error': 'Failed to fetch actors'}), 500

@tasks_bp.route('/api/customers', methods=['GET'])
def get_customers():
    try:
        # Get status from query parameters, default to 'A'
        status = request.args.get('status', 'A')
        
        # Query active customers
        customers = Customer.query.filter_by(status=status).all()
        
        # Format the response
        customers_list = [{
            'customer_id': customer.customer_id,
            'customer_name': customer.customer_name
        } for customer in customers]
        
        return jsonify(customers_list)
    
    except Exception as e:
        print(f"Error fetching customers: {e}")
        return jsonify({'error': 'Failed to fetch customers'}), 500 