import os
from datetime import datetime, timedelta
from flask import Flask, session, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_login import LoginManager
from config import Config
from models import db, Actor, Task
from routes.activities import activities_bp
from routes.actors import actors_bp
from routes.customers import customers_bp
from routes.tasks import tasks_bp
from routes.reports import reports_bp
from routes.messages import messages_bp, init_app
from routes.analysis import analysis_bp
from routes.auth import auth_bp
from routes.forgotpassword import forgotpassword_bp
from routes.profile import profile_bp
from routes.changepassword import changepassword_bp
from routes.diary import diary_bp
from flask_bcrypt import Bcrypt
from routes.users import users_bp
from flask_mail import Mail


app = Flask(__name__)
app.config.from_object(Config)
app.secret_key = 'your_secret_key'  # Make sure this is set for sessions to work

# Set session timeout to 30 minutes (1800 seconds)
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)
app.config['SESSION_REFRESH_EACH_REQUEST'] = True

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

@login_manager.user_loader
def load_user(user_id):
    return Actor.query.get(int(user_id))

# Setup CORS properly - this is critical to fix the error
CORS(app, supports_credentials=True, origins=["http://localhost:3000", "http://127.0.0.1:3000"], methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])

# Remove or comment out this section as it's redundant
# CORS(app, resources={
#     r"/customers/*": {"origins": "http://localhost:3000"},
#     r"/delete_customer/*": {"origins": "http://localhost:3000"},
#     r"/add_customer": {"origins": "http://localhost:3000"},
#     r"/update_customer": {"origins": "http://localhost:3000"}
# })

# Initialize extensions
db.init_app(app)
jwt = JWTManager(app)
bcrypt = Bcrypt(app)
 
# Register blueprints
app.register_blueprint(activities_bp)
app.register_blueprint(actors_bp)
app.register_blueprint(customers_bp)
app.register_blueprint(tasks_bp)
app.register_blueprint(reports_bp)
app.register_blueprint(messages_bp)
app.register_blueprint(analysis_bp, url_prefix='/analysis')
app.register_blueprint(auth_bp, url_prefix='/')
app.register_blueprint(profile_bp)
app.register_blueprint(changepassword_bp)
app.register_blueprint(diary_bp, url_prefix='/diary')
app.register_blueprint(forgotpassword_bp)
app.register_blueprint(users_bp, url_prefix='/users')

# Initialize the email thread
init_app(app)

# Mail settings
app.config['MAIL_SERVER'] = 'smtp.gmail.com'  # Or your mail server
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'your-email@gmail.com'  # Replace with your email
app.config['MAIL_PASSWORD'] = 'your-app-password'    # Replace with your app password
app.config['MAIL_DEFAULT_SENDER'] = ('ProSync Support', 'your-email@gmail.com')

mail = Mail(app)

@app.before_request
def make_session_permanent():
    session.permanent = True

@app.route('/')
def index():
    return "AAWE API Server is running"

# For Flask 2.0+, you may need more specific CORS configuration:
@app.after_request
def after_request(response):
    # Only add header if it doesn't exist
    origin = request.headers.get('Origin')
    allowed_origins = ['http://localhost:3000', 'http://127.0.0.1:3000']
    
    if origin in allowed_origins:
        if 'Access-Control-Allow-Origin' not in response.headers:
            response.headers.add('Access-Control-Allow-Origin', origin)
    else:
        if 'Access-Control-Allow-Origin' not in response.headers:
            response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
            
    if 'Access-Control-Allow-Headers' not in response.headers:
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    if 'Access-Control-Allow-Methods' not in response.headers:
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS')
    if 'Access-Control-Allow-Credentials' not in response.headers:
        response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

@app.route('/tasks/<task_id>/review-status', methods=['PATCH'])
def update_review_status(task_id):
    try:
        data = request.json
        reviewer_status = data.get('reviewer_status')
        user_id = data.get('user_id')
        role_id = data.get('role_id')

        if not all([reviewer_status, user_id, role_id]):
            return jsonify({
                'success': False,
                'message': 'Missing required fields'
            }), 400

        # Log the incoming request
        print(f"Updating review status for task {task_id} to {reviewer_status}")
        print(f"Request data: {data}")

        # Get the task
        task = Task.query.get(task_id)
        if not task:
            return jsonify({
                'success': False,
                'message': f'Task {task_id} not found'
            }), 404

        # Update the review status
        task.reviewer_status = reviewer_status
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Review status updated successfully',
            'task': task.to_dict()
        })

    except Exception as e:
        print(f"Error updating review status: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Error updating review status: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
