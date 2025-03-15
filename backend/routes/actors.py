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
        
        actor.actor_name = data['actor_name']
        actor.mobile1 = data['mobile1']
        actor.email_id = data['email_id']
        actor.group_id = data['group_id']
        actor.role_id = data['role_id']
        
        db.session.commit()
        return jsonify({"message": "Actor updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500 
