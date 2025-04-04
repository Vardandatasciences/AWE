from flask import Blueprint, jsonify, request,session
from models import db, Activity, Customer, Actor, CustomerActivity, Task
from datetime import datetime, timedelta, time
from sqlalchemy import text
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import logging
import threading
import os
from models import ReminderMail, HolidayMaster
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow





activities_bp = Blueprint('activities', __name__)

@activities_bp.route('/activities', methods=['GET'])
def get_activities():
    try:
        # Modified to get active activities in reverse chronological order
        activities = Activity.query.filter_by(status='A').order_by(Activity.activity_id.desc()).all()
        return jsonify([activity.to_dict() for activity in activities])
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

@activities_bp.route('/add_activity', methods=['POST'])
def add_activity():
    try:
        data = request.json
        
        new_activity = Activity(
            activity_name=data.get('activity_name', 'Unnamed Activity'),
            standard_time=data.get('standard_time', 0),
            act_des=data.get('act_des', ''),
            criticality=data.get('criticality', 'Low'),
            duration=data.get('duration', 0),
            role_id=data.get('role_id', 0),
            frequency=data.get('frequency', 0),
            due_by=datetime.strptime(data.get('due_by', '2000-01-01'), '%Y-%m-%d').date(),
            activity_type=data.get('activity_type', 'R')
        )
        
        db.session.add(new_activity)
        db.session.commit()
        
        # Return the newly created activity along with the success message
        return jsonify({
            "message": "Activity added successfully",
            "activity": new_activity.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@activities_bp.route('/delete_activity/<int:activity_id>', methods=['DELETE'])
def delete_activity(activity_id):
    try:
        # Get the activity
        activity = Activity.query.get_or_404(activity_id)
        
        # Check for incomplete tasks
        incomplete_tasks = Task.query.filter_by(
            activity_id=activity_id
        ).filter(
            Task.status != 'COMPLETED'
        ).first()
        
        if incomplete_tasks:
            return jsonify({
                "error": "Cannot delete activity",
                "message": "There are incomplete tasks associated with this activity. Please complete all tasks before deleting."
            }), 400
        
        # If all tasks are completed, update the activity status to 'O'
        activity.status = 'O'
        db.session.commit()
        
        return jsonify({
            "message": "Activity deleted successfully",
            "status": "success"
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@activities_bp.route('/update_activity', methods=['PUT'])
def update_activity():
    try:
        data = request.json
        activity = Activity.query.get_or_404(data['activity_id'])
        
        # Update all fields
        activity.activity_name = data.get('activity_name', activity.activity_name)
        activity.standard_time = data.get('standard_time', activity.standard_time)
        activity.act_des = data.get('act_des', activity.act_des)
        activity.criticality = data.get('criticality', activity.criticality)
        activity.duration = data.get('duration', activity.duration)
        activity.role_id = data.get('role_id', activity.role_id)
        activity.frequency = data.get('frequency', activity.frequency)
        activity.activity_type = data.get('activity_type', activity.activity_type)
        
        # Handle due_by date conversion
        if 'due_by' in data and data['due_by']:
            activity.due_by = datetime.strptime(data['due_by'], '%Y-%m-%d').date()
        
        db.session.commit()
        return jsonify({
            "message": "Activity updated successfully",
            "activity": activity.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@activities_bp.route('/activity_mappings/<int:activity_id>', methods=['GET'])
def get_activity_mappings(activity_id):
    try:
        # Query to get all customers and their assigned actors for a specific activity
        # This uses the CustomerActivity table from your app.py
        from models import db, Customer, Actor
        
        # Using raw SQL query to match your existing database structure
        query = text("""
            SELECT 
                c.customer_id, 
                c.customer_name, 
                ca.actor_id as assigned_employee,
                a.actor_name as employee_name
            FROM 
                customers c
            LEFT JOIN 
                customer_activity ca ON c.customer_id = ca.customer_id AND ca.activity_id = :activity_id
            LEFT JOIN
                actors a ON ca.actor_id = a.actor_id
            ORDER BY 
                c.customer_name
        """)
        
        result = db.session.execute(query, {"activity_id": activity_id})
        
        mappings = []
        for row in result:
            mappings.append({
                "id": f"{activity_id}_{row.customer_id}",
                "customer_id": row.customer_id,
                "customer_name": row.customer_name,
                "assigned_employee": row.assigned_employee,
                "employee_name": row.employee_name
            })
        
        return jsonify(mappings)
    except Exception as e:
        print(f"Error fetching activity mappings: {e}")
        return jsonify({"error": str(e)}), 500


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


@activities_bp.route('/get_frequency/<int:activity_id>', methods=['GET'])
def get_frequency(activity_id):
    try:
        activity = Activity.query.filter_by(activity_id=activity_id).first()
        if not activity:
            return jsonify({'error': 'Activity not found'}), 404
        
        return jsonify({'frequency': activity.frequency}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@activities_bp.route('/assign_activity', methods=['POST'])
def assign_activity():
    try:
        data = request.form
        print("📥 Received Data for Task Assignment:", data)

        activity_id = data.get('task_name')
        assigned_to = data.get('assigned_to')
        customer_id = data.get('customer_id')
        remarks = data.get('remarks', '')
        link = data.get('link', '')
        frequency = data.get('frequency', '1')
        status = data.get('status', 'Yet to Start')

        if not activity_id or not assigned_to or not customer_id:
            return jsonify({'success': False, 'message': '❌ Missing required fields'}), 400

        # Check if Activity Exists
        activity = Activity.query.filter_by(activity_id=activity_id).first()
        if not activity:
            return jsonify({'success': False, 'message': '❌ Invalid Activity'}), 400

        if data.get('actor_id'):
            actor = Actor.query.filter_by(actor_id=data.get('actor_id')).first()
            initiator = actor.actor_name if actor else None
        else:
            initiator = None
        if not initiator:
            return jsonify({'success': False, 'message': '❌ Initiator not found. Please log in again.'}), 400

        task_name = activity.activity_name
        criticality = activity.criticality
        duration = activity.duration if activity.duration else 0
        due_by = activity.due_by
        activity_type = activity.activity_type
        
        # Check if Employee Exists
        assigned_actor = Actor.query.filter_by(actor_name=assigned_to).first()
        if not assigned_actor:
            return jsonify({'success': False, 'message': '❌ Invalid Employee'}), 400
        assigned_actor_id = assigned_actor.actor_id
        assigned_actor_email = assigned_actor.email_id

        # Check if Customer Exists
        customer = Customer.query.filter_by(customer_id=customer_id).first()
        if not customer:
            return jsonify({'success': False, 'message': '❌ Invalid Customer'}), 400

        # Check if Activity Already Assigned
        existing_assignment = CustomerActivity.query.filter_by(
            customer_id=customer_id, activity_id=activity_id
        ).first()

        if existing_assignment:
            return jsonify({'success': False, 'message': '❌ Activity already assigned'}), 400

        # Insert into CustomerActivity table
        new_customer_activity = CustomerActivity(
            customer_id=customer_id, 
            activity_id=activity_id, 
            actor_id=assigned_actor_id, 
            remarks=remarks
        )
        db.session.add(new_customer_activity)
        
        # Create a task for this assignment
        try:
            # Calculate due date
            due_date = datetime.now() + timedelta(days=int(frequency))
            
            # Generate a unique task ID
            task_id = f"{activity_id}{customer_id}{due_date.strftime('%d%m%Y')}"
            
            # Get current timestamp for assignment
            current_timestamp = datetime.now()
            
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
                assigned_timestamp=current_timestamp  # Add the timestamp here
            )
            db.session.add(new_task)
            db.session.commit()
            
            # Add to Google Calendar
            calendar_event_id = None
            try:
                # Set up start and end times for the calendar event
                start_time = datetime.combine(due_date, time(9, 0))  # 9:00 AM
                end_time = datetime.combine(due_date, time(10, 0))   # 10:00 AM
                
                # Create description for the calendar event
                description = f"""
Task: {activity.activity_name}
Customer: {customer.customer_name}
Criticality: {criticality}
Remarks: {remarks}
Link: {link}
                """
                
                # Add to Google Calendar
                calendar_event_id = add_to_calendar(
                    task_name=f"{activity.activity_name} - {customer.customer_name}",
                    description=description,
                    start_date=start_time,
                    end_date=end_time,
                    employee_email=assigned_actor_email
                )
                
                if calendar_event_id:
                    print(f"✅ Added to Google Calendar with event ID: {calendar_event_id}")
                else:
                    print("⚠️ Failed to add to Google Calendar")
                    
                    # If calendar integration failed, let's try one more time with token refresh
                    token_path = os.path.join(os.path.dirname(__file__), '..', 'token.json')
                    if os.path.exists(token_path):
                        try:
                            os.remove(token_path)
                            print("🔄 Removed old token, trying again...")
                            
                            # Try again with fresh credentials
                            calendar_event_id = add_to_calendar(
                                task_name=f"{activity.activity_name} - {customer.customer_name}",
                                description=description,
                                start_date=start_time,
                                end_date=end_time,
                                employee_email=assigned_actor_email
                            )
                            
                            if calendar_event_id:
                                print(f"✅ Second attempt successful! Added to Google Calendar with event ID: {calendar_event_id}")
                        except Exception as retry_error:
                            print(f"❌ Second attempt also failed: {retry_error}")
            except Exception as calendar_error:
                print(f"❌ Calendar Error: {calendar_error}")
            
            # Schedule Email Reminders
            try:
                # Ensure due_date is a date object
                if isinstance(due_date, datetime):
                    due_date_for_reminder = due_date.date()
                else:
                    due_date_for_reminder = due_date
                
                # Calculate reminder date
                reminder_date = calculate_reminder_date(due_date_for_reminder, duration)
                
                # Prepare reminder email content
                reminder_email_subject = f"AWE-Reminder for '{activity.activity_name}' for '{customer.customer_name}'"
                reminder_email_content = f"""Hello {assigned_to},

The task '{activity.activity_name}' for '{customer.customer_name}' is due on '{due_date_for_reminder.strftime('%Y-%m-%d')}'.

- Task Name: {activity.activity_name}
- Task ID: {task_id}
- Criticality: {criticality}
- Status: {status}

Please review the task and complete it before the due date.

Regards,
AWE Team"""

                # Schedule reminder email
                schedule_email_reminder(
                    reminder_email_subject,
                    reminder_email_content,
                    assigned_actor_email,
                    activity.activity_name,
                    due_date_for_reminder,
                    customer.customer_name,
                    reminder_date,
                    task_id
                )

                # Schedule due date email reminder
                due_email_subject = f"AWE-Due of '{activity.activity_name}' for '{customer.customer_name}'"
                due_email_content = f"""Hello {assigned_to},

The task '{activity.activity_name}' for '{customer.customer_name}' is due today.

- Task Name: {activity.activity_name}
- Task ID: {task_id}
- Criticality: {criticality}
- Status: {status}

Please review the task and complete it today.
Ignore if completed.

Regards,
AWE Team"""

                # Schedule due date reminder
                schedule_email_reminder(
                    due_email_subject,
                    due_email_content,
                    assigned_actor_email,
                    activity.activity_name,
                    due_date_for_reminder,
                    customer.customer_name,
                    due_date_for_reminder,  # Reminder on the due date itself
                    task_id
                )
                
                print(f"✅ Email reminders scheduled for task {task_id}")
                
            except Exception as reminder_error:
                print(f"❌ Error scheduling reminders: {reminder_error}")
                print(f"Error details: {type(reminder_error).__name__}: {str(reminder_error)}")
            
            # Send immediate email notification
            try:
                # Prepare email content
                subject = f"AWE-New Task Assigned: {activity.activity_name}"
                content = f"""Dear {assigned_to},

A new task '{activity.activity_name}' has been assigned to you for customer '{customer.customer_name}'.

- Task Name: {activity.activity_name}
- Task ID: {task_id}
- Criticality: {criticality}
- Due Date: {due_date.strftime('%Y-%m-%d')}
- Status: {status}

{f"This task has been added to your Google Calendar." if calendar_event_id else ""}

Best regards,
AWE Team"""

                # Send email
                print(f"✉️ Email would be sent to {assigned_actor_email} with subject: {subject}")
                print(f"✉️ Email content: {content}")
                
                send_email(subject, assigned_actor_email, content)
                
                return jsonify({
                    'success': True, 
                    'message': 'Activity assigned successfully and notification sent',
                    'email_sent': True,
                    'calendar_added': calendar_event_id is not None,
                    'reminders_scheduled': True
                })
                
            except Exception as email_error:
                print(f"📧 Error sending email: {email_error}")
                # Even if email fails, the assignment was successful
                return jsonify({
                    'success': True, 
                    'message': 'Activity assigned successfully but notification failed',
                    'email_sent': False,
                    'calendar_added': calendar_event_id is not None,
                    'reminders_scheduled': True
                })
                
        except Exception as task_error:
            db.session.rollback()
            print(f"🚨 Error creating task: {task_error}")
            return jsonify({'success': False, 'message': f'Failed to create task: {str(task_error)}'}), 500
    
    except Exception as e:
        db.session.rollback()
        print(f"🚨 Error Assigning Activity: {e}")
        return jsonify({'success': False, 'message': f'Failed to assign activity: {str(e)}'}), 500

# Define the scopes for Google Calendar API
SCOPES = ['https://www.googleapis.com/auth/calendar']

def get_credentials():
    creds = None
    token_path = os.path.join(os.path.dirname(__file__), '..', 'token.json')
    credentials_path = os.path.join(os.path.dirname(__file__), '..', 'credentials.json')
    
    print(f"Looking for token at: {token_path}")
    print(f"Looking for credentials at: {credentials_path}")
    
    # The file token.json stores the user's access and refresh tokens
    if os.path.exists(token_path):
        try:
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
            print("✅ Loaded credentials from token.json")
        except Exception as e:
            print(f"❌ Error loading token.json: {e}")
            creds = None
    
    # If credentials don't exist or are invalid, we need to get new ones
    if not creds or not creds.valid:
        print("🔄 Credentials are invalid or missing, attempting to refresh or create new ones")
        
        if creds and creds.expired and creds.refresh_token:
            try:
                print("🔄 Refreshing expired credentials")
                creds.refresh(Request())
                print("✅ Credentials refreshed successfully")
            except Exception as e:
                print(f"❌ Error refreshing credentials: {e}")
                creds = None
        
        # If we still don't have valid credentials, we need to get new ones
        if not creds or not creds.valid:
            if not os.path.exists(credentials_path):
                print(f"❌ credentials.json not found at {credentials_path}")
                raise FileNotFoundError(f"credentials.json not found at {credentials_path}")
            
            try:
                print("🔑 Starting OAuth flow to get new credentials")
                flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
                creds = flow.run_local_server(port=0)
                print("✅ New credentials obtained successfully")
                
                # Save the credentials for the next run
                with open(token_path, 'w') as token:
                    token.write(creds.to_json())
                print(f"✅ New credentials saved to {token_path}")
            except Exception as e:
                print(f"❌ Error during OAuth flow: {e}")
                raise
    
    return creds

def add_to_calendar(task_name, description, start_date, end_date, employee_email):
    """Add a task to Google Calendar"""
    try:
        print(f"🗓️ Adding event to calendar: {task_name}")
        
        # Get credentials and build the service
        creds = get_credentials()
        service = build('calendar', 'v3', credentials=creds)
        
        # Create the event
        event = {
            'summary': task_name,
            'description': description,
            'start': {
                'dateTime': start_date.isoformat(),
                'timeZone': 'Asia/Kolkata',  # Use your local timezone
            },
            'end': {
                'dateTime': end_date.isoformat(),
                'timeZone': 'Asia/Kolkata',  # Use your local timezone
            },
            'attendees': [
                {'email': employee_email},
            ],
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},  # 1 day before
                    {'method': 'popup', 'minutes': 60},  # 1 hour before
                ],
            },
        }
        
        # Add the event to the primary calendar
        event = service.events().insert(calendarId='primary', body=event).execute()
        print(f'✅ Event created: {event.get("htmlLink")}')
        return event.get('id')
    except Exception as e:
        print(f'❌ Failed to add event to calendar: {e}')
        # If it's an authentication error, try to clear the token and get new credentials
        if 'invalid_grant' in str(e) or 'unauthorized' in str(e).lower():
            try:
                token_path = os.path.join(os.path.dirname(__file__), '..', 'token.json')
                if os.path.exists(token_path):
                    print(f"🗑️ Removing invalid token.json file")
                    os.remove(token_path)
                    print(f"✅ token.json removed. Please try again to trigger new authentication.")
            except Exception as remove_error:
                print(f"❌ Error removing token.json: {remove_error}")
        return None

@activities_bp.route('/auth/google', methods=['GET'])
def google_auth():
    """Endpoint to manually trigger Google authentication"""
    try:
        # Remove existing token if it exists
        token_path = os.path.join(os.path.dirname(__file__), '..', 'token.json')
        if os.path.exists(token_path):
            os.remove(token_path)
            print("🗑️ Removed existing token.json")
        
        # Get fresh credentials
        creds = get_credentials()
        
        if creds and creds.valid:
            return jsonify({
                "success": True,
                "message": "Google authentication successful! New token.json has been generated."
            })
        else:
            return jsonify({
                "success": False,
                "message": "Failed to authenticate with Google."
            }), 500
    except Exception as e:
        print(f"❌ Authentication error: {e}")
        return jsonify({
            "success": False,
            "message": f"Authentication error: {str(e)}"
        }), 500

@activities_bp.route('/tasks/client/<int:client_id>', methods=['GET'])
def get_client_tasks(client_id):
    try:
        # Get the customer name for this client ID
        customer = Customer.query.get(client_id)
        if not customer:
            return jsonify({"error": "Customer not found"}), 404

        # Query to get all tasks for this customer
        tasks = Task.query.filter_by(customer_name=customer.customer_name).all()
        
        # Extract unique activity IDs
        assigned_activities = list(set([str(task.activity_id) for task in tasks]))
        
        print(f"Found assigned activities for customer {customer.customer_name}: {assigned_activities}")
        
        return jsonify(assigned_activities)
    except Exception as e:
        print(f"Error fetching client tasks: {e}")
        return jsonify({"error": str(e)}), 500
