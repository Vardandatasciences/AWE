from flask import Blueprint, jsonify, request
from models import db, Actor, Task
from datetime import datetime
import traceback
from flask_bcrypt import Bcrypt
from flask import current_app
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

actors_bp = Blueprint('actors', __name__)

# Initialize Bcrypt with your Flask app
bcrypt = Bcrypt()

# Email configuration
SENDER_EMAIL = "loukyarao68@gmail.com"  # Use the email from your tasks.py
EMAIL_PASSWORD = "vafx kqve dwmj mvjv"  # Use the password from your tasks.py

def send_welcome_email(recipient_email, actor_name, actor_id, password):
    try:
        # Create message container
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "Welcome to ProSync - Your Account Details"
        msg['From'] = SENDER_EMAIL
        msg['To'] = recipient_email

        # Create the HTML version of your message
        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #3498db; color: white; padding: 15px; text-align: center; }}
                .content {{ padding: 20px; background-color: #f9f9f9; }}
                .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #999; }}
                .credentials {{ background-color: #f0f0f0; padding: 15px; margin: 15px 0; border-left: 4px solid #3498db; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to ProSync!</h1>
                </div>
                <div class="content">
                    <p>Hello {actor_name},</p>
                    
                    <p>Welcome to ProSync! Your account has been successfully created. We're excited to have you on board.</p>
                    
                    <div class="credentials">
                        <p><strong>Your login credentials:</strong></p>
                        <p>Actor ID: {actor_id}</p>
                        <p>Password: {password}</p>
                    </div>
                    
                    <p>Please keep this information secure. We recommend changing your password after your first login.</p>
                    
                    <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                    
                    <p>Best regards,<br>The ProSync Team</p>
                </div>
                <div class="footer">
                    <p>This is an automated message, please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        # Attach parts to the message
        part = MIMEText(html, 'html')
        msg.attach(part)

        # Setup the server
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(SENDER_EMAIL, EMAIL_PASSWORD)
        
        # Send the message
        server.sendmail(SENDER_EMAIL, recipient_email, msg.as_string())
        server.quit()
        
        print(f"Welcome email sent successfully to {recipient_email}")
        return True
    except Exception as e:
        print(f"Failed to send welcome email: {str(e)}")
        traceback.print_exc()
        return False

@actors_bp.route('/actors', methods=['GET'])
def get_actors():
    try:
        actors = Actor.query.all()
        return jsonify([actor.to_dict() for actor in actors])
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

@actors_bp.route('/actors_assign', methods=['GET'])
def get_actors_assign():
    try:
        # Fetch actors but exclude those with role_id = 11
        actors = Actor.query.filter(Actor.role_id != 11, Actor.status != 'O').all()
        
        return jsonify([
    {"actor_id": actor.actor_id, "actor_name": actor.actor_name, "role_id": actor.role_id} 
    for actor in actors
])

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

@actors_bp.route('/add_actor', methods=['POST'])
def add_actor():
    try:
        data = request.json
        
        # Ensure required fields are present
        if not data.get('actor_name') or not data.get('mobile1') or not data.get('email_id'):
            return jsonify({"error": "Missing required fields"}), 400
        
        # Format gender to match database column size
        gender = data.get('gender')
        if gender:
            if gender.lower() == 'male':
                gender = 'M'
            elif gender.lower() == 'female':
                gender = 'F'
            else:
                gender = gender[:1]  # Take first character if it's something else
        
        # Store original password for email
        original_password = data.get('password')
        
        # Hash the password if provided
        hashed_password = None
        if original_password:
            hashed_password = bcrypt.generate_password_hash(original_password).decode('utf-8')
        
        # Create a new actor without specifying actor_id (let it be auto-generated)
        new_actor = Actor(
            actor_name=data.get('actor_name'),
            gender=gender,
            DOB=datetime.strptime(data.get('DOB'), '%Y-%m-%d').date() if data.get('DOB') else None,
            mobile1=data.get('mobile1'),
            mobile2=data.get('mobile2'),
            email_id=data.get('email_id'),
            password=hashed_password,  # Store the hashed password
            group_id=data.get('group_id'),
            role_id=data.get('role_id'),
            status=data.get('status')
        )
        
        db.session.add(new_actor)
        db.session.commit()
        
        # Send welcome email with account details
        email_sent = False
        if data.get('email_id') and original_password:
            email_sent = send_welcome_email(
                data.get('email_id'),
                data.get('actor_name'),
                new_actor.actor_id,
                original_password
            )
        
        response = {
            "message": "Actor added successfully", 
            "actor_id": new_actor.actor_id,
            "email_sent": email_sent
        }
        
        return jsonify(response), 201
    except Exception as e:
        db.session.rollback()
        print("Error:", e)
        traceback.print_exc()  # Add traceback for better debugging
        return jsonify({"error": str(e)}), 500

@actors_bp.route('/delete_actor/<int:actor_id>', methods=['DELETE'])
def delete_actor(actor_id):
    try:
        actor = Actor.query.get_or_404(actor_id)
        db.session.delete(actor)
        db.session.commit()
        return jsonify({"message": "Actor deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@actors_bp.route('/update_actor', methods=['PUT'])
def update_actor():
    try:
        data = request.json
        actor = Actor.query.get_or_404(data['actor_id'])
        
        # Update all fields that might be sent from the frontend
        if 'actor_name' in data:
            actor.actor_name = data['actor_name']
        if 'email_id' in data:
            actor.email_id = data['email_id']
        if 'mobile1' in data:
            actor.mobile1 = data['mobile1']
        if 'mobile2' in data:
            actor.mobile2 = data['mobile2']
        if 'group_id' in data:
            actor.group_id = data['group_id']
        if 'role_id' in data:
            actor.role_id = data['role_id']
        if 'status' in data:
            actor.status = data['status']
        if 'gender' in data:
            gender = data['gender']
            if gender.lower() == 'male':
                actor.gender = 'M'
            elif gender.lower() == 'female':
                actor.gender = 'F'
            else:
                actor.gender = gender[:1]  # Take first character if it's something else
        
        db.session.commit()
        return jsonify({"message": "Actor updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        print("Error:", e)
        traceback.print_exc()  # Print full traceback for better debugging
        return jsonify({"error": str(e)}), 500

@actors_bp.route('/deactivate_actor', methods=['PUT'])
def deactivate_actor():
    try:
        data = request.json
        actor_id = data.get('actor_id')
        
        if not actor_id:
            return jsonify({"error": "Actor ID is required"}), 400
            
        # Get the actor
        actor = Actor.query.get_or_404(actor_id)
        actor_name = actor.actor_name
        
        # Change actor status to inactive ('O')
        actor.status = 'O'
        
        # Find all tasks assigned to this actor (not just active ones)
        # First, get active tasks that need to be moved to pending
        active_tasks = Task.query.filter_by(actor_id=actor_id, status='A').all()
        
        # Collect task details for the response
        task_details = []
        for task in active_tasks:
            # Change status to pending
            task.status = 'Pending'  # Changed from 'P' to 'Pending'
            
            # Add to task details
            task_details.append({
                'task_id': task.task_id,
                'task_name': task.task_name if hasattr(task, 'task_name') else f"Task #{task.task_id}",
                'activity_id': task.activity_id if hasattr(task, 'activity_id') else None,
                'due_date': task.due_date.strftime('%Y-%m-%d') if hasattr(task, 'due_date') and task.due_date else None,
                'status': 'Pending'  # Changed from 'P' to 'Pending'
            })
        
        # Log the number of tasks found for debugging
        print(f"Found {len(active_tasks)} active tasks for actor {actor_id}")
        print(f"Changed status to 'Pending' for all tasks")
        
        db.session.commit()
        
        return jsonify({
            "message": f"Actor '{actor_name}' deactivated successfully and tasks moved to pending",
            "affected_tasks": len(task_details),
            "task_details": task_details,
            "actor_id": actor_id,
            "actor_name": actor_name
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print("Error:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500 
