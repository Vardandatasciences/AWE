@tasks_bp.route('/tasks/<task_id>/review-status', methods=['PATCH'])
@cross_origin()
def update_review_status(task_id):
    try:
        data = request.json
        reviewer_status = data.get('reviewer_status')
        
        # Validate input
        if not reviewer_status:
            return jsonify({
                "success": False, 
                "error": "Reviewer status is required"
            }), 400
            
        # Get the task
        task = Task.query.filter_by(task_id=task_id).first()
        if not task:
            return jsonify({"success": False, "error": "Task not found"}), 404
            
        # Update the reviewer status
        task.reviewer_status = reviewer_status
        
        # If the reviewer rejected the task, change the status back to WIP
        if reviewer_status == 'Rejected':
            task.status = 'WIP'
            print(f"Task {task_id} was rejected, status reset to WIP for reassignment")
            
            # Attempt to send notification about the task being reassigned
            try:
                assigned_actor = Actor.query.filter_by(actor_id=task.actor_id).first()
                if assigned_actor and assigned_actor.email_id:
                    subject = f"Task Rejected and Reassigned: {task.task_name}"
                    send_styled_email(subject, assigned_actor.email_id, task, 'reassignment')
            except Exception as e:
                print(f"Warning: Failed to send reassignment notification: {e}")
        
        db.session.commit()
        
        print(f"✅ Successfully updated task {task_id} reviewer status to {reviewer_status}")
        
        return jsonify({
            "success": True,
            "message": "Reviewer status updated successfully",
            "status": task.status
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating reviewer status: {e}")
        return jsonify({"success": False, "error": str(e)}), 500 