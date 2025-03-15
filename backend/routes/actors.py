from flask import Blueprint, jsonify, request
from models import db, Actor
from datetime import datetime
import traceback

actors_bp = Blueprint('actors', __name__)

@actors_bp.route('/actors', methods=['GET'])
def get_actors():
    try:
        actors = Actor.query.all()
        return jsonify([actor.to_dict() for actor in actors])
    except Exception as e:
        print("Error getting actors:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@actors_bp.route('/actors_assign', methods=['GET'])
def get_actors_assign():
    try:
        actors = Actor.query.with_entities(Actor.actor_name).all()
        return jsonify([{"actor_name": actor.actor_name} for actor in actors])
    except Exception as e:
        print("Error getting actors for assignment:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@actors_bp.route('/add_actor', methods=['POST'])
def add_actor():
    try:
        data = request.json
        print("Received actor data:", data)  # Debug: Log received data
        
        # Ensure required fields are present
        if not data.get('actor_name') or not data.get('mobile1') or not data.get('email_id'):
            missing_fields = []
            if not data.get('actor_name'): missing_fields.append('actor_name')
            if not data.get('mobile1'): missing_fields.append('mobile1')
            if not data.get('email_id'): missing_fields.append('email_id')
            error_msg = f"Missing required fields: {', '.join(missing_fields)}"
            print(error_msg)
            return jsonify({"error": error_msg}), 400
        
        # Debug: Check DOB format if present
        if data.get('DOB'):
            print(f"DOB value: {data.get('DOB')}")
        
        try:
            dob_date = datetime.strptime(data.get('DOB'), '%Y-%m-%d').date() if data.get('DOB') else None
        except ValueError as ve:
            print(f"Date format error: {ve}")
            return jsonify({"error": f"Invalid date format: {ve}"}), 400
        
        new_actor = Actor(
            actor_name=data.get('actor_name'),
            gender=data.get('gender'),
            DOB=dob_date,
            mobile1=data.get('mobile1'),
            mobile2=data.get('mobile2'),
            email_id=data.get('email_id'),
            password=data.get('password'),
            group_id=data.get('group_id'),
            role_id=data.get('role_id'),
            status=data.get('status')
        )
        
        print("Adding new actor to database")
        db.session.add(new_actor)
        db.session.commit()
        print("Actor added successfully")
        
        return jsonify({"message": "Actor added successfully"}), 201
    except Exception as e:
        db.session.rollback()
        print("Error adding actor:", e)
        traceback.print_exc()  # Print full traceback for more detailed debugging
        return jsonify({"error": f"Failed to add employee: {str(e)}"}), 500

@actors_bp.route('/delete_actor/<int:actor_id>', methods=['DELETE'])
def delete_actor(actor_id):
    try:
        actor = Actor.query.get_or_404(actor_id)
        db.session.delete(actor)
        db.session.commit()
        return jsonify({"message": "Actor deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        print("Error deleting actor:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@actors_bp.route('/update_actor', methods=['PUT'])
def update_actor():
    try:
        data = request.json
        print("Updating actor with data:", data)
        
        actor = Actor.query.get_or_404(data['actor_id'])
        
        actor.actor_name = data['actor_name']
        actor.mobile1 = data['mobile1']
        actor.email_id = data['email_id']
        actor.group_id = data['group_id']
        actor.role_id = data['role_id']
        
        db.session.commit()
        print("Actor updated successfully")
        return jsonify({"message": "Actor updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        print("Error updating actor:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500