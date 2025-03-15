from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from models import db
from routes.activities import activities_bp
from routes.actors import actors_bp
from routes.customers import customers_bp
from routes.tasks import tasks_bp
from routes.reports import reports_bp
from routes.messages import messages_bp, init_app
from routes.analysis import analysis_bp
from routes.auth import auth_bp
from routes.frequency import frequency_bp
from routes.diary import diary_bp
app = Flask(__name__)
app.config.from_object(Config)
# Enable CORS for all routes
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
 
# Initialize extensions
db.init_app(app)
jwt = JWTManager(app)
 
# Register blueprints
app.register_blueprint(activities_bp)
app.register_blueprint(actors_bp)
app.register_blueprint(customers_bp)
app.register_blueprint(tasks_bp)
app.register_blueprint(reports_bp)
app.register_blueprint(messages_bp)
app.register_blueprint(analysis_bp, url_prefix='/analysis')
app.register_blueprint(auth_bp)
app.register_blueprint(frequency_bp)
app.register_blueprint(diary_bp, url_prefix='/diary')
# Initialize the email thread
init_app(app)
 
@app.route('/')
def index():
    return "AAWE API Server is running"
 
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)