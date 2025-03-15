from flask import Blueprint, jsonify, request, send_file
from models import db, Activity, Task, Actor
from datetime import datetime
import pandas as pd
from io import BytesIO

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/view_activity_report')
def view_activity_report():
    try:
        activities = Activity.query.with_entities(Activity.activity_id, Activity.activity_name).all()
        return jsonify([{
            "activity_id": activity.activity_id,
            "activity_name": activity.activity_name
        } for activity in activities])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@reports_bp.route('/get_activity_data', methods=['POST', 'GET'])
def get_activity_data():
    try:
        if request.method == 'POST':
            data = request.json
            activity_id = data.get("activity_id")
        else:
            activity_id = request.args.get("activity_id")
        
        if not activity_id:
            return jsonify({"error": "Activity ID is required"}), 400
        
        # Get standard time
        activity = Activity.query.get_or_404(activity_id)
        standard_time = activity.standard_time
        
        # Get all completed tasks for the activity with actor information
        tasks = db.session.query(
            Task, Actor.actor_name
        ).join(
            Actor, Task.actor_id == Actor.actor_id
        ).filter(
            Task.activity_id == activity_id,
            Task.status == 'completed'
        ).all()
        
        task_list = [{
            "employee_id": task[0].actor_id,
            "name": task[1],  # actor_name
            "task_id": task[0].task_id,
            "time_taken": task[0].time_taken if task[0].time_taken is not None else 0,
            "completion_date": task[0].actual_date.strftime('%Y-%m-%d') if task[0].actual_date else None,
        } for task in tasks]
        
        return jsonify({
            "tasks": task_list,
            "standard_time": standard_time
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@reports_bp.route('/generate_activity_report', methods=['GET'])
def generate_activity_report():
    try:
        activity_id = request.args.get("activity_id")
        if not activity_id:
            return jsonify({"error": "Activity ID is required"}), 400
            
        # Get activity details
        activity = Activity.query.get_or_404(activity_id)
        
        # Get all completed tasks for the activity with actor information
        tasks = db.session.query(
            Task, Actor.actor_name
        ).join(
            Actor, Task.actor_id == Actor.actor_id
        ).filter(
            Task.activity_id == activity_id,
            Task.status == 'completed'
        ).all()
        
        # Convert to DataFrame format
        task_data = [
            {
                "Employee ID": task[0].actor_id,
                "Name": task[1],  # actor_name
                "Task ID": task[0].task_id,
                "Time Taken": task[0].time_taken if task[0].time_taken is not None else 0,
                "Date of Completion": task[0].actual_date.strftime('%Y-%m-%d') if task[0].actual_date else None,
                "Standard Time": activity.standard_time,
                "Status": (
                    "ON-TIME" if task[0].time_taken == activity.standard_time
                    else "EARLY" if task[0].time_taken < activity.standard_time
                    else "DELAY"
                )
            }
            for task in tasks
        ]
        
        df = pd.DataFrame(task_data)
        
        # Create Excel file in memory
        excel_buffer = BytesIO()
        
        with pd.ExcelWriter(excel_buffer, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name=f"Activity_{activity_id}")
        
        # Return file for download
        excel_buffer.seek(0)
        current_date = datetime.now().strftime("%Y-%m-%d")
        file_name = f"{current_date}_Activity_{activity_id}_Report.xlsx"
        
        return send_file(
            excel_buffer,
            as_attachment=True,
            download_name=file_name,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@reports_bp.route('/view_employee_report', methods=['GET'])
def view_employee_report():
    try:
        actors = Actor.query.filter_by(role_id=22).all()
        return jsonify([{
            "actor_id": actor.actor_id,
            "actor_name": actor.actor_name
        } for actor in actors])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@reports_bp.route('/get_employee_data', methods=['POST'])
def get_employee_data():
    try:
        data = request.json
        actor_id = data.get("actor_id")
        
        # Get all completed tasks for this employee with activity and actor info
        tasks = db.session.query(
            Task, Activity.activity_name, Activity.standard_time, Actor.actor_name
        ).join(
            Activity, Task.activity_id == Activity.activity_id
        ).join(
            Actor, Task.actor_id == Actor.actor_id
        ).filter(
            Task.actor_id == actor_id,
            Task.status == 'completed'
        ).all()
        
        task_list = [{
            "activity_id": task[0].activity_id,
            "activity_name": task[1],
            "task_id": task[0].task_id,
            "task_name": task[0].task_name,
            "time_taken": task[0].time_taken,
            "completion_date": task[0].actual_date.strftime('%Y-%m-%d') if task[0].actual_date else None,
            "actor_id": task[0].actor_id,
            "actor_name": task[3],
            "standard_time": task[2]
        } for task in tasks]
        
        return jsonify({"tasks": task_list})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@reports_bp.route('/generate_employee_report', methods=['GET'])
def generate_employee_report():
    try:
        # Get all employees (actors with role_id=22)
        actors = Actor.query.filter_by(role_id=22).all()
        
        # Create Excel file in memory
        excel_buffer = BytesIO()
        
        with pd.ExcelWriter(excel_buffer, engine="openpyxl") as writer:
            for actor in actors:
                # Get completed tasks with activity info using join
                tasks = db.session.query(
                    Task, Activity.activity_name, Activity.standard_time
                ).join(
                    Activity, Task.activity_id == Activity.activity_id
                ).filter(
                    Task.actor_id == actor.actor_id,
                    Task.status == 'completed'
                ).all()
                
                # Convert to DataFrame format
                task_data = [
                    {
                        "Activity ID": task[0].activity_id,
                        "Activity Name": task[1],
                        "Task ID": task[0].task_id,
                        "Date of Completion": task[0].actual_date.strftime('%Y-%m-%d') if task[0].actual_date else None,
                        "Time Taken": task[0].time_taken if task[0].time_taken is not None else 0,
                        "Standard Time": task[2],
                        "Status": (
                            "Early" if (task[0].time_taken is not None and task[0].time_taken < task[2])
                            else "On-Time" if (task[0].time_taken == task[2])
                            else "Delay"
                        )
                    }
                    for task in tasks
                ]
                
                df = pd.DataFrame(task_data)
                
                # Create sheet name
                sheet_name = f"{actor.actor_id}_{actor.actor_name}"[:31]
                df.to_excel(writer, index=False, sheet_name=sheet_name)
        
        # Return file for download
        excel_buffer.seek(0)
        current_date = datetime.now().strftime("%Y-%m-%d")
        file_name = f"{current_date}_EmployeeReport.xlsx"
        
        return send_file(
            excel_buffer,
            as_attachment=True,
            download_name=file_name,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@reports_bp.route('/employee-performance/<int:actor_id>', methods=['GET'])
def get_employee_performance(actor_id):
    try:
        # Get all completed tasks for this employee with activity info
        tasks = db.session.query(
            Task, Activity.activity_name, Activity.standard_time
        ).join(
            Activity, Task.activity_id == Activity.activity_id
        ).filter(
            Task.actor_id == actor_id,
            Task.status == 'completed'
        ).all()
        
        task_list = [{
            "activity_id": task[0].activity_id,
            "activity_name": task[0].task_name,
            "task_id": task[0].task_id,
            "completion_date": task[0].actual_date.strftime('%Y-%m-%d') if task[0].actual_date else None,
            "time_taken": task[0].time_taken if task[0].time_taken is not None else 0,
            "standard_time": task[2],
            "status": (
                "ON-TIME" if task[0].time_taken == task[2]
                else "EARLY" if task[0].time_taken < task[2]
                else "DELAY"
            )
        } for task in tasks]
        
        return jsonify(task_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@reports_bp.route('/download-performance/<int:actor_id>', methods=['GET'])
def download_employee_performance(actor_id):
    try:
        # Get employee name
        actor = Actor.query.get_or_404(actor_id)
        
        # Get all completed tasks with activity info
        tasks = db.session.query(
            Task, Activity.activity_name, Activity.standard_time
        ).join(
            Activity, Task.activity_id == Activity.activity_id
        ).filter(
            Task.actor_id == actor_id,
            Task.status == 'completed'
        ).all()
        
        # Convert to DataFrame format
        task_data = [{
            "Activity ID": task[0].activity_id,
            "Activity Name": task[0].task_name,
            "Task ID": task[0].task_id,
            "Date of Completion": task[0].actual_date.strftime('%Y-%m-%d') if task[0].actual_date else None,
            "Time Taken": task[0].time_taken if task[0].time_taken is not None else 0,
            "Standard Time": task[2],
            "Status": (
                "ON-TIME" if task[0].time_taken == task[2]
                else "EARLY" if task[0].time_taken < task[2]
                else "DELAY"
            )
        } for task in tasks]
        
        df = pd.DataFrame(task_data)
        
        # Create Excel file in memory
        excel_buffer = BytesIO()
        
        with pd.ExcelWriter(excel_buffer, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name=f"Employee_{actor.actor_name}")
        
        # Return file for download
        excel_buffer.seek(0)
        current_date = datetime.now().strftime("%Y-%m-%d")
        file_name = f"{current_date}_{actor.actor_name}_Performance.xlsx"
        
        return send_file(
            excel_buffer,
            as_attachment=True,
            download_name=file_name,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500 