from flask import Blueprint, jsonify, request, session
from models import db, Actor
import bcrypt
import hashlib
from datetime import datetime

changepassword_bp = Blueprint('changepassword', __name__)

@changepassword_bp.route('/api/verify_password', methods=['POST'])
def verify_password():
    try:
        actor_id = session.get('actor_id')
        print(f"Session actor_id: {actor_id}")  # Debug print
        
        if not actor_id:
            return jsonify({
                'success': False,
                'message': 'Not authenticated'
            }), 401

        data = request.json
        current_password = data.get('current_password')
        print(f"Verifying password for actor_id: {actor_id}")  # Debug print
        
        if not current_password:
            return jsonify({
                'success': False,
                'message': 'Current password is required'
            }), 400

        actor = Actor.query.filter_by(actor_id=actor_id).first()
        if not actor:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404

        # Try both hashing methods (bcrypt and sha256)
        sha256_hash = hashlib.sha256(current_password.encode()).hexdigest()
        print(f"Stored password: {actor.password}")  # Debug print
        print(f"SHA256 hash: {sha256_hash}")  # Debug print

        # Check if password matches either hash
        if sha256_hash == actor.password:
            print("Password verified with SHA256")  # Debug print
            return jsonify({
                'success': True,
                'message': 'Password verified successfully'
            })
        
        try:
            if bcrypt.checkpw(current_password.encode('utf-8'), actor.password.encode('utf-8')):
                print("Password verified with bcrypt")  # Debug print
                return jsonify({
                    'success': True,
                    'message': 'Password verified successfully'
                })
        except Exception as e:
            print(f"Bcrypt verification error: {e}")  # Debug print
            pass

        return jsonify({
            'success': False,
            'message': 'Current password is incorrect'
        }), 400

    except Exception as e:
        print(f"Error in verify_password: {e}")  # Debug print
        return jsonify({
            'success': False,
            'message': f'Internal server error: {str(e)}'
        }), 500

@changepassword_bp.route('/api/changepassword', methods=['POST'])
def change_password():
    try:
        actor_id = session.get('actor_id')
        if not actor_id:
            return jsonify({
                'success': False,
                'message': 'Not authenticated'
            }), 401

        data = request.json
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_new_password')

        if not new_password or not confirm_password:
            return jsonify({
                'success': False,
                'message': 'New password and confirmation are required'
            }), 400

        if new_password != confirm_password:
            return jsonify({
                'success': False,
                'message': 'Passwords do not match'
            }), 400

        # Password validation
        if len(new_password) < 8:
            return jsonify({
                'success': False,
                'message': 'Password must be at least 8 characters long'
            }), 400

        if not any(c.isupper() for c in new_password):
            return jsonify({
                'success': False,
                'message': 'Password must contain at least one uppercase letter'
            }), 400

        if not any(c.islower() for c in new_password):
            return jsonify({
                'success': False,
                'message': 'Password must contain at least one lowercase letter'
            }), 400

        if not any(c.isdigit() for c in new_password):
            return jsonify({
                'success': False,
                'message': 'Password must contain at least one number'
            }), 400

        if not any(c in "@$!%*?&" for c in new_password):
            return jsonify({
                'success': False,
                'message': 'Password must contain at least one special character (@$!%*?&)'
            }), 400

        actor = Actor.query.filter_by(actor_id=actor_id).first()
        if not actor:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404

        # Use SHA256 for password hashing to match existing system
        hashed_password = hashlib.sha256(new_password.encode()).hexdigest()
        actor.password = hashed_password
        
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Password changed successfully'
        })

    except Exception as e:
        db.session.rollback()
        print(f"Error in change_password: {e}")
        return jsonify({
            'success': False,
            'message': f'Internal server error: {str(e)}'
        }), 500 