from flask import Blueprint, jsonify, request
from models import db, Task, ActivityAssignment, Actor
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import logging
import threading
import os
from models import ReminderMail, HolidayMaster
from flask_cors import cross_origin

from datetime import datetime, timedelta, time


tasks_bp = Blueprint('tasks', __name__)

@tasks_bp.route('/tasks', methods=['GET'])
def get_tasks():
    try:
        # Get user information from request
        user_id = request.args.get('user_id')
        role_id = request.args.get('role_id')
        
        print(f"User ID: {user_id}, Role ID: {role_id}")
        
        # If admin, get all tasks, otherwise filter by user's assigned tasks
        if role_id == "11":  # Admin role
            tasks = Task.query.all()
        else:
            # Filter tasks by assigned user
            if user_id:
                tasks = Task.query.filter_by(actor_id=user_id).all()
            else:
                # If no user_id provided, return empty list
                return jsonify([])
        
        return jsonify([{
            'id': task.task_id,
            'task_name': task.task_name,
            'link': task.link,
            'status': task.status,
            'criticality': task.criticality,
            'assignee': task.assigned_to,
            'due_date': task.duedate.isoformat() if task.duedate else None,
            'initiator': task.initiator,
            'time_taken': task.duration,
            'customer_name': task.customer_name,
            'title': task.task_name
        } for task in tasks])
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


def schedule_email_reminder(subject, task, email, reminder_date, email_type):
    """Schedule an email reminder by adding it to the database"""
    try:
        # Ensure reminder_date is a date object
        if isinstance(reminder_date, datetime):
            reminder_date = reminder_date.date()
            
        # Convert reminder_date to datetime with time component for the reminder
        reminder_time = time(9, 0)  # 9:00 AM
        
        # Create a new reminder record
        new_reminder = ReminderMail(
            task_id=task.task_id,
            message_des=f"{task.task_name} for {task.customer_name}",
            date=reminder_date,
            time=reminder_time,
            email_id=email,
            status="Pending",
            email_type=email_type  # Store the email type for rendering the correct template later
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
            # HTML content for new assignment
            html_body = f'''
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>New Task Assignment</title>
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
        traceback.print_exc()  # Add detailed traceback for debugging
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





@tasks_bp.route('/tasks/<task_id>', methods=['PATCH'])
@cross_origin()
def update_task(task_id):
    try:
        # Get user information from request
        user_id = request.args.get('user_id')
        role_id = request.args.get('role_id')
        
        print(f"Received update request for task {task_id} from user {user_id} with role {role_id}")
        print(f"Request data: {request.json}")
        
        # Get the task
        task = Task.query.filter_by(task_id=task_id).first()
        if not task:
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Check permissions
        if role_id != "11" and str(task.actor_id) != user_id:
            return jsonify({"success": False, "error": "You don't have permission to update this task"}), 403
        
        # Get the data to update
        data = request.json
        
        # Store original values for comparison
        original_status = task.status
        original_assigned_to = task.assigned_to
        original_actor_id = task.actor_id
        original_duedate = task.duedate
        
        # Update the task
        if 'status' in data:
            # Ensure we're using the correct status values
            task.status = data['status']
            print(f"Updating task status to: {task.status}")
        
        # Handle reassignment
        if 'assignee' in data:
            # Get the new assignee
            new_assignee = Actor.query.filter_by(actor_id=data['assignee']).first()
            if not new_assignee:
                return jsonify({"success": False, "error": "Assignee not found"}), 400
            
            # Update the task
            task.actor_id = new_assignee.actor_id
            task.assigned_to = new_assignee.actor_name
            assigned_actor_email = new_assignee.email_id
        else:
            assigned_actor_email = Actor.query.filter_by(actor_id=task.actor_id).first().email_id if task.actor_id else None
        
        # Update due date if provided
        if 'due_date' in data and data['due_date']:
            try:
                task.duedate = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({"success": False, "error": "Invalid date format"}), 400
        
        # Save changes
        db.session.commit()
        print(f"✅ Successfully updated task {task_id} status to {task.status}")
        
        # Send notifications based on what changed
        # If the assignee changed, send a reassignment notification
        if original_actor_id != task.actor_id or original_duedate != task.duedate:
            subject = f"ProSync - Task Reassigned: {task.task_name}"
            
            # Send styled email notification
            send_styled_email(subject, assigned_actor_email, task, 'reassignment')
            
            # Schedule new reminders for the reassigned person
            if original_duedate != task.duedate or original_assigned_to != task.assigned_to:
                # Calculate reminder date based on due date and duration
                reminder_date = calculate_reminder_date(task.duedate, task.duration)
                
                # Schedule reminder email
                schedule_email_reminder(
                    f"ProSync - Reminder: {task.task_name}",
                    task,
                    assigned_actor_email,
                    reminder_date,
                    'reminder'
                )
                
                # Schedule due date email
                schedule_email_reminder(
                    f"ProSync - Due Today: {task.task_name}",
                    task,
                    assigned_actor_email,
                    task.duedate,
                    'due_today'
                )
                
        # If only the status changed, send a status update notification
        elif original_status != task.status:
            subject = f"ProSync - Task Status Update: {task.task_name}"
            
            # Send styled email notification
            send_styled_email(subject, assigned_actor_email, task, 'status_update')
            
        return jsonify({"success": True, "message": "Task updated successfully"}), 200
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
        # Get user information from request
        role_id = request.args.get('role_id')
        
        # Only admins can assign activities
        if role_id != "11":
            return jsonify({'error': 'Only administrators can assign activities'}), 403
            
        data = request.json
        
        new_assignment = ActivityAssignment(
            activity_id=data['activity_id'],
            assignee_id=data['assignee_id'],
            customer_id=data['customer_id']
        )
        
        db.session.add(new_assignment)
        db.session.commit()
        
        return jsonify({"message": "Activity assigned successfully"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

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