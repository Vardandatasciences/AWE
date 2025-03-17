from flask import Blueprint, request, jsonify
from models import db, Diary1, Task, Actor
from sqlalchemy import func
from flask_cors import CORS

diary_bp = Blueprint('diary', __name__)
CORS(diary_bp, resources={r"/*": {"origins": "*"}})


@diary_bp.route('/entries', methods=['GET'])
def get_entries():
    actor_id = request.args.get('actor_id')
    
    if actor_id:
        entries = Diary1.query.filter_by(actor_id=actor_id).all()
    else:
        entries = Diary1.query.all()
        
    return jsonify([entry.to_dict() for entry in entries])

@diary_bp.route('/wip-tasks', methods=['GET'])
def get_wip_tasks():
    actor_id = request.args.get('actor_id')
    print(f"Received request for WIP tasks with actor_id: {actor_id}")

    if not actor_id:
        return jsonify({"error": "Actor ID is required"}), 400

    try:
        # Convert actor_id to integer
        actor_id = int(actor_id)

        # Step 1: Get actor name from actors table
        actor = db.session.execute(
            db.select(Actor).filter_by(actor_id=actor_id)
        ).scalar_one_or_none()

        if not actor:
            print(f"⚠️ No actor found with actor_id {actor_id}")
            return jsonify({"error": "Actor not found"}), 404

        actor_name = actor.actor_name  # Get actor's name
        print(f"🟢 Found actor: {actor_name}")

        # Step 2: Fetch tasks where assigned_to = actor's name
        tasks = db.session.execute(
            db.select(Task).filter_by(status="WIP", assigned_to=actor_name)
        ).scalars().all()

        if not tasks:
            print(f"⚠️ No WIP tasks found for actor: {actor_name}")

        # Convert ORM objects to JSON
        task_list = [{"task_id": task.task_id, "task_name": task.task_name} for task in tasks]

        return jsonify(task_list)

    except ValueError:
        print("❌ Invalid actor_id format")
        return jsonify({"error": "Invalid actor_id"}), 400
    except Exception as e:
        print(f"❌ Error fetching WIP tasks: {str(e)}")
        return jsonify({"error": "Internal Server Error"}), 500






@diary_bp.route('/save', methods=['POST'])
def save_entries():
    data = request.get_json()
    entries = data.get('entries', [])
    actor_id = data.get('actor_id')
    
    for entry_data in entries:
        entry_id = entry_data.get('id')
        
        # Update existing entry
        if entry_id and entry_id > 0:
            entry = Diary1.query.get(entry_id)
            if entry:
                entry.date = entry_data['date']
                entry.start_time = entry_data['start_time']
                entry.end_time = entry_data['end_time']
                entry.task = entry_data['task']
                entry.remarks = entry_data['remarks']
        # Create new entry
        else:
            new_entry = Diary1(
                actor_id=actor_id,
                date=entry_data['date'],
                start_time=entry_data['start_time'],
                end_time=entry_data['end_time'],
                task=entry_data['task'],
                remarks=entry_data['remarks']
            )
            db.session.add(new_entry)
    
    db.session.commit()
    return jsonify({'message': 'Entries saved successfully'})

@diary_bp.route('/entries/<int:entry_id>', methods=['DELETE'])
def delete_entry(entry_id):
    actor_id = request.args.get('actor_id')
    
    entry = Diary1.query.get_or_404(entry_id)
    
    # If actor_id provided, ensure the entry belongs to the actor
    if actor_id and str(entry.actor_id) != str(actor_id):
        return jsonify({"error": "Unauthorized"}), 403
        
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'message': 'Entry deleted successfully'})
