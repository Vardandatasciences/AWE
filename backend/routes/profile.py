from flask import Blueprint, jsonify, request, session
from models import db, Actor
from datetime import datetime
from flask_login import current_user, login_required
import bcrypt

profile_bp = Blueprint('profile', __name__)

@profile_bp.route('/profile', methods=['GET'])
# @login_required
def get_profile():
    try:
        # Get actor_id from query parameters
        actor_id = request.args.get('actor_id')
        print(f"Session actor_id: {actor_id}")  # Debug print
        
        if not actor_id:
            return jsonify({
                'success': False,
                'message': 'Not authenticated'
            }), 401

        actor = Actor.query.filter_by(actor_id=actor_id).first()
        print(f"Found actor: {actor}")  # Debug print
        
        if not actor:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404

        # Format the date properly
        dob = actor.DOB.strftime('%Y-%m-%d') if actor.DOB else None
        
        user_data = {
            'actor_id': actor.actor_id,
            'actor_name': actor.actor_name,
            'gender': actor.gender,
            'DOB': dob,
            'mobile1': actor.mobile1,
            'mobile2': actor.mobile2,
            'email_id': actor.email_id,
            'group_id': actor.group_id,
            'role_id': actor.role_id,
            'status': actor.status
        }
        
        print(f"Sending user data: {user_data}")  # Debug print
        
        return jsonify({
            'success': True,
            'user': user_data
        })

    except Exception as e:
        print(f"Error in get_profile: {e}")  # Debug print
        return jsonify({
            'success': False,
            'message': f'Internal server error: {str(e)}'
        }), 500

@profile_bp.route('/profile/update', methods=['POST'])
# @login_required - uncomment when ready to enforce authentication
def update_profile():
    try:
        data = request.json
        actor_id = data.get('actor_id')
        
        if not actor_id:
            return jsonify({
                'success': False,
                'message': 'Not authenticated'
            }), 401

        actor = Actor.query.filter_by(actor_id=actor_id).first()
        if not actor:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404

        # Update only allowed fields
        if 'email_id' in data:
            # Check if email already exists for another user
            existing_actor = Actor.query.filter(
                Actor.email_id == data['email_id'],
                Actor.actor_id != actor_id
            ).first()
            if existing_actor:
                return jsonify({
                    'success': False,
                    'message': 'Email already in use'
                }), 400
            actor.email_id = data['email_id']

        if 'mobile1' in data:
            # Check if mobile number already exists for another user
            existing_actor = Actor.query.filter(
                Actor.mobile1 == data['mobile1'],
                Actor.actor_id != actor_id
            ).first()
            if existing_actor:
                return jsonify({
                    'success': False,
                    'message': 'Mobile number already in use'
                }), 400
            actor.mobile1 = data['mobile1']

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Profile updated successfully'
        })

    except Exception as e:
        db.session.rollback()
        print(f"Error in update_profile: {e}")
        return jsonify({
            'success': False,
            'message': f'Internal server error: {str(e)}'
        }), 500

@profile_bp.route('/verify-current-password', methods=['POST'])
def verify_current_password():
    try:
        data = request.json
        actor_id = data.get('actor_id')
        password = data.get('password')
        
        print(f"Verifying password for actor_id: {actor_id}")  # Debug log
        
        if not actor_id or not password:
            return jsonify({
                'success': False,
                'message': 'Both actor ID and password are required'
            }), 400

        actor = Actor.query.filter_by(actor_id=actor_id).first()
        
        if not actor:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404

        # Check if password is stored as bytes or needs to be converted
        stored_password = actor.password
        if isinstance(stored_password, str):
            stored_password = stored_password.encode('utf-8')
            
        # Verify the password
        if bcrypt.checkpw(password.encode('utf-8'), stored_password):
            return jsonify({
                'success': True,
                'message': 'Password verified'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Incorrect password'
            }), 400

    except Exception as e:
        print(f"Error in verify_current_password: {e}")
        import traceback
        traceback.print_exc()  # Print full traceback for debugging
        return jsonify({
            'success': False,
            'message': f'Internal server error: {str(e)}'
        }), 500 