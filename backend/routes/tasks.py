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


def schedule_email_reminder(subject, content, email, task_name, due_date, customer_name, reminder_date, task_id):
    """Schedule an email reminder by adding it to the database"""
    try:
        # Ensure reminder_date is a date object
        if isinstance(reminder_date, datetime):
            reminder_date = reminder_date.date()
            
        # Convert reminder_date to datetime with time component for the reminder
        reminder_time = time(9, 0)  # 9:00 AM
        
        # Create a new reminder record
        new_reminder = ReminderMail(
            task_id=task_id,
            message_des=f"{task_name} for {customer_name}",
            date=reminder_date,
            time=reminder_time,
            email_id=email,
            status="Pending"
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

def send_email_task(subject, body, to_email,task_id):
    from_email = 'loukyarao68@gmail.com'
    password = 'vafx kqve dwmj mvjv'

    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email  # Ensure this is a valid email address
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        # Establish connection to SMTP server
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(from_email, password)
        text = msg.as_string()

        # Send email
        server.sendmail(from_email, to_email, text)
        server.quit()

        logging.info(f'Email sent to {to_email}')

        # Logging success in the database
        try:
            with db.engine.connect() as connection:
                db.session.query(ReminderMail).filter_by(
                    message_des=body,
                    email_id=to_email,
                    date=datetime.now().date(),
                    time=datetime.now().time(),
                    task_id=task_id
                ).update({'status': 'Sent'})
 
                db.session.commit()
                logging.info(f"Reminder mails updated to 'Sent' for email to {to_email}")
        except Exception as update_error:
            logging.error(f"Error updating reminder mails status: {update_error}")

    except Exception as e:
        logging.error(f'Failed to send email to {to_email}: {e}')

        # Logging failure in the database
        try:
            with db.engine.connect() as connection:
                db.session.query(ReminderMail).filter_by(
                    message_des=body,
                    email_id=to_email,
                    date=datetime.now().date(),
                    time=datetime.now().time(),
                    task_id=task_id
                ).update({'status': f'Failed: {e}'})
 
                db.session.commit()
                logging.info(f"Reminder mails updated to 'Failed' for email to {to_email}")
        except Exception as update_error:
            logging.error(f"Error updating reminder mails status after failure: {update_error}")

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
            subject = f"AWE-Task Reassigned: {task.task_name}"
            content = f"""Dear {task.assigned_to},

A task has been reassigned to you:

- Task Name: {task.task_name}
- Task ID: {task.task_id}
- Criticality: {task.criticality}
- Due Date: {task.duedate.strftime('%Y-%m-%d')}
- Status: {task.status}
- Customer: {task.customer_name}

Please review this task and complete it by the due date.

Best regards,
AWE Team"""

            # Send email notification
            send_email_task(subject, content, assigned_actor_email, task.task_id)
            
            # Schedule new reminders for the reassigned person
            if original_duedate != task.duedate or original_assigned_to != task.assigned_to:
                # Calculate reminder date based on due date and duration
                reminder_date = calculate_reminder_date(task.duedate, task.duration)
               
                # Early reminder email
                reminder_email_subject = f"AWE-Reminder for '{task.task_name}' for '{task.customer_name}'"
                reminder_email_content = f"""Hello {task.assigned_to},

The task '{task.task_name}' for '{task.customer_name}' is due on '{task.duedate}'.

- Task Name: {task.task_name}
- Task ID: {task.task_id}
- Criticality: {task.criticality}
- Status: {task.status}

Please review the task and complete it before the due date.

Regards,
AWE Team"""

                schedule_email_reminder(
                    reminder_email_subject,
                    reminder_email_content,
                    assigned_actor_email,
                    task.task_name,
                    task.duedate,
                    task.customer_name,
                    reminder_date,
                    task.task_id
                )

                # Due date reminder email
                due_email_subject = f"AWE-Due of '{task.task_name}' for '{task.customer_name}'"
                due_email_content = f"""Hello {task.assigned_to},

The task '{task.task_name}' for '{task.customer_name}' is due today.

- Task Name: {task.task_name}
- Task ID: {task.task_id}
- Criticality: {task.criticality}
- Status: {task.status}

Please review the task and complete it today.
Ignore if completed.

Regards,
AWE Team"""

                schedule_email_reminder(
                    due_email_subject,
                    due_email_content,
                    assigned_actor_email,
                    task.task_name,
                    task.duedate,
                    task.customer_name,
                    task.duedate,
                    task.task_id
                )
       
        # If only the status changed, send a status update notification
        elif original_status != task.status:
            subject = f"AWE-Task Status Updated: {task.task_name}"
            content = f"""Dear {task.assigned_to},

The status of task '{task.task_name}' for customer '{task.customer_name}' has been updated.

- Task Name: {task.task_name}
- Task ID: {task.task_id}
- Criticality: {task.criticality}
- Due Date: {task.duedate}
- Status: {task.status} (Previously: {original_status})

Best regards,
AWE Team"""

            send_email_task(subject, assigned_actor_email, content, task.task_id)
           
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
        new_task = Task(
            task_name=data['title'],
            status=data.get('status', 'todo'),
            priority=data.get('priority', 'medium'),
            actor_id=data.get('assignee'),
            due_date=datetime.strptime(data['due_date'], '%Y-%m-%d') if data.get('due_date') else None,
            activity_id=data.get('activity_id')
        )
        db.session.add(new_task)
        db.session.commit()
        
        return jsonify({
            'id': new_task.task_id,
            'title': new_task.task_name,
            'status': new_task.status,
            'priority': new_task.priority,
            'assignee': new_task.actor_id,
            'due_date': new_task.due_date.isoformat() if new_task.due_date else None
        }), 201
    except Exception as e:
        db.session.rollback()
        print("Error creating task:", e)
        return jsonify({'error': 'Failed to create task'}), 500

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