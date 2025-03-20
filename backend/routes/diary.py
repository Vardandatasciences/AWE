from flask import Blueprint, request, jsonify
from models import db, Diary1, Task, Actor
from sqlalchemy import func
from flask_cors import CORS
from datetime import datetime

diary_bp = Blueprint('diary', __name__)
CORS(diary_bp, resources={r"/*": {"origins": "http://localhost:3000", "supports_credentials": True}})


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
    try:
        data = request.get_json()
        if not data:
            print("❌ No JSON data received in save_entries")
            return jsonify({"error": "No data provided"}), 400
            
        entries = data.get('entries', [])
        actor_id = data.get('actor_id')
        
        if not actor_id:
            print("❌ No actor_id provided in save_entries")
            return jsonify({"error": "Actor ID is required"}), 400
            
        # Convert actor_id to integer if it's a string
        try:
            actor_id = int(actor_id)
        except (ValueError, TypeError):
            print(f"⚠️ Invalid actor_id format: {actor_id}")
            # If it's not convertible to int, keep it as is (might be a string ID)
            
        print(f"💾 Saving {len(entries)} entries for actor_id: {actor_id}")
        
        for entry_data in entries:
            print(f"Processing entry: {entry_data}")
            entry_id = entry_data.get('id')
            
            # Ensure actor_id is in the entry data
            entry_data['actor_id'] = actor_id
            
            # Handle date and time conversions
            if 'date' in entry_data and entry_data['date']:
                try:
                    if isinstance(entry_data['date'], str):
                        entry_data['date'] = datetime.strptime(entry_data['date'], '%Y-%m-%d').date()
                except Exception as e:
                    print(f"⚠️ Error parsing date: {entry_data['date']} - {str(e)}")
                    entry_data['date'] = None
                    
            if 'start_time' in entry_data and entry_data['start_time']:
                try:
                    if isinstance(entry_data['start_time'], str):
                        entry_data['start_time'] = datetime.strptime(entry_data['start_time'], '%H:%M').time()
                except Exception as e:
                    print(f"⚠️ Error parsing start_time: {entry_data['start_time']} - {str(e)}")
                    entry_data['start_time'] = None
                    
            if 'end_time' in entry_data and entry_data['end_time']:
                try:
                    if isinstance(entry_data['end_time'], str):
                        entry_data['end_time'] = datetime.strptime(entry_data['end_time'], '%H:%M').time()
                except Exception as e:
                    print(f"⚠️ Error parsing end_time: {entry_data['end_time']} - {str(e)}")
                    entry_data['end_time'] = None
            
            # Update existing entry
            if entry_id and entry_id > 0:
                entry = Diary1.query.get(entry_id)
                if entry:
                    print(f"✏️ Updating existing entry: {entry_id}")
                    
                    # Update fields
                    if 'date' in entry_data:
                        entry.date = entry_data['date']
                    if 'start_time' in entry_data:
                        entry.start_time = entry_data['start_time']
                    if 'end_time' in entry_data:
                        entry.end_time = entry_data['end_time']
                    if 'task' in entry_data:
                        entry.task = str(entry_data['task'])
                    if 'remarks' in entry_data:
                        entry.remarks = entry_data.get('remarks', '')
                else:
                    print(f"⚠️ Entry not found for update: {entry_id}, creating new entry")
                    new_entry = Diary1(
                        actor_id=actor_id,
                        date=entry_data.get('date'),
                        start_time=entry_data.get('start_time'),
                        end_time=entry_data.get('end_time'),
                        task=str(entry_data.get('task', '')),
                        remarks=entry_data.get('remarks', '')
                    )
                    db.session.add(new_entry)
            # Create new entry
            else:
                print(f"➕ Creating new entry for actor: {actor_id}")
                new_entry = Diary1(
                    actor_id=actor_id,
                    date=entry_data.get('date'),
                    start_time=entry_data.get('start_time'),
                    end_time=entry_data.get('end_time'),
                    task=str(entry_data.get('task', '')),
                    remarks=entry_data.get('remarks', '')
                )
                db.session.add(new_entry)
        
        db.session.commit()
        print(f"✅ Successfully saved entries for actor_id: {actor_id}")
        return jsonify({'message': 'Entries saved successfully'})
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"❌ Error in save_entries: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

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
