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
from datetime import timedelta


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

# ✅ Enable CORS globally for all routes
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)

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

@app.before_request
def make_session_permanent():
    session.permanent = True

@app.route('/')
def index():
    return "AAWE API Server is running"

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
