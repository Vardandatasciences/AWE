from flask import Blueprint, jsonify, request
from models import db, Actor, Task
from datetime import datetime
import traceback

actors_bp = Blueprint('actors', __name__)

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
        actors = Actor.query.with_entities(Actor.actor_name).all()
        return jsonify([{"actor_name": actor.actor_name} for actor in actors])
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
        
        new_actor = Actor(
            actor_name=data.get('actor_name'),
            gender=data.get('gender'),
            DOB=datetime.strptime(data.get('DOB'), '%Y-%m-%d').date() if data.get('DOB') else None,
            mobile1=data.get('mobile1'),
            mobile2=data.get('mobile2'),
            email_id=data.get('email_id'),
            password=data.get('password'),
            group_id=data.get('group_id'),
            role_id=data.get('role_id'),
            status=data.get('status')
        )
        
        db.session.add(new_actor)
        db.session.commit()
        
        return jsonify({"message": "Actor added successfully"}), 201
    except Exception as e:
        db.session.rollback()
        print("Error:", e)
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
            actor.gender = data['gender']
        
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
