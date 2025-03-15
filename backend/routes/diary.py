from flask import Blueprint, request, jsonify
from models import db, Diary1, Task
from sqlalchemy import func

diary_bp = Blueprint('diary', __name__)

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

    if not actor_id:
        return jsonify({"error": "Missing actor_id"}), 400

    print(f"🔍 Fetching WIP tasks for actor_id: {actor_id}")

    try:
        wip_tasks = Task.query.filter_by(assigned_to=actor_id, status="WIP").all()
        
        if not wip_tasks:
            print("⚠️ No WIP tasks found for this actor_id")

        # Ensure response is always a list
        return jsonify([task.to_dict() for task in wip_tasks])
    except Exception as e:
        print(f"❌ Error fetching WIP tasks: {str(e)}")
        return jsonify({"error": str(e)}), 500





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
