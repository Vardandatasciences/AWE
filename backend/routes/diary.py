from flask import Blueprint, request, jsonify
from models import db, Diary1, Task

diary_bp = Blueprint('diary', __name__)

@diary_bp.route('/entries', methods=['GET'])
def get_entries():
    entries = Diary1.query.all()
    return jsonify([entry.to_dict() for entry in entries])

@diary_bp.route('/wip-tasks', methods=['GET'])
def get_wip_tasks():
    actor_id = request.args.get('actor_id')  # Get actor_id from query parameters
    if actor_id:
        wip_tasks = Task.query.filter(Task.status == 'WIP', Task.actor_id == actor_id).all()
    else:
        wip_tasks = Task.query.filter(Task.status == 'WIP').all()  # Fallback if no actor_id is provided
    return jsonify([task.to_dict() for task in wip_tasks])

@diary_bp.route('/save', methods=['POST'])
def save_entries():
    data = request.get_json()
    entries = data.get('entries', [])
    for entry_data in entries:
        new_entry = Diary1(
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
    entry = Diary1.query.get_or_404(entry_id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'message': 'Entry deleted successfully'})
 