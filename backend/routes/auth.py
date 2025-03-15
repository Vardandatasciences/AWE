from flask import Blueprint, jsonify, request
from models import db, Actor
from flask_jwt_extended import create_access_token
import datetime
import bcrypt

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        actor_id = data.get('actorId')
        password = data.get('password')
        
        print(f"Login attempt with Actor ID: {actor_id}")
        
        if not actor_id or not password:
            return jsonify({"error": "Actor ID and password are required"}), 400
        
        # Find user by actor_id
        try:
            # Convert actor_id to integer if it's a string
            if isinstance(actor_id, str) and actor_id.isdigit():
                actor_id = int(actor_id)
                
            user = Actor.query.filter_by(actor_id=actor_id).first()
            
            if not user:
                print(f"No user found with actor_id: {actor_id}")
                return jsonify({"error": "Invalid credentials"}), 401
                
            print(f"User found: {user.actor_name}")
            
        except Exception as e:
            print(f"Database error: {e}")
            return jsonify({"error": "Database error occurred"}), 500
        
        # Check password (in a real app, you'd use password hashing)
        if hasattr(user, 'password'):
            if not bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
                print("Password mismatch")
                return jsonify({"error": "Invalid credentials"}), 401
        else:
            # If the user doesn't have a password field, use a default check
            # This is just for development - in production, all users should have passwords
            print("User has no password field, using default check")
            if password != "default":
                return jsonify({"error": "Invalid credentials"}), 401
        
        # Check if user is active (if status field exists)
        if hasattr(user, 'status') and user.status != 'A':
            print(f"User account is inactive: {user.status}")
            return jsonify({"error": "Account is inactive"}), 403
        
        # Determine if user is admin based on role_id
        is_admin = False
        if hasattr(user, 'role_id'):
            is_admin = user.role_id == 11
        
        # Create user identity object
        user_identity = {
            "user_id": user.actor_id,
            "name": user.actor_name,
            "email": user.email_id if hasattr(user, 'email_id') else "",
            "role": "admin" if is_admin else "user",
            "role_id": user.role_id if hasattr(user, 'role_id') else None
          
        }
        
        # Create access token
        access_token = create_access_token(
            identity=user_identity,
            expires_delta=datetime.timedelta(days=1)
        )
        
        print(f"Login successful for user: {user.actor_name}, role: {'admin' if is_admin else 'user'}")
        
        return jsonify({
            "token": access_token,
            "user": user_identity
        }), 200
        
    except Exception as e:
        print("Login error:", e)
        return jsonify({"error": "An error occurred during login"}), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    # In a stateless JWT system, the client simply discards the token
    # Here we just return a success message
    return jsonify({"message": "Logged out successfully"}), 200 