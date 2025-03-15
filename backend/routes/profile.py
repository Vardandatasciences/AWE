from flask import Blueprint, jsonify, request, session
from models import db, Actor
from datetime import datetime
from flask_login import current_user, login_required

profile_bp = Blueprint('profile', __name__)

@profile_bp.route('/profile', methods=['GET'])
@login_required
def get_profile():
    try:
        # Get actor_id from session or current_user
        actor_id = current_user.actor_id if current_user.is_authenticated else session.get('actor_id')
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
@login_required
def update_profile():
    try:
        actor_id = current_user.actor_id if current_user.is_authenticated else session.get('actor_id')
        if not actor_id:
            return jsonify({
                'success': False,
                'message': 'Not authenticated'
            }), 401

        data = request.json
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
            'message': 'Internal server error'
        }), 500 