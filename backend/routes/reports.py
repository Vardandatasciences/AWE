import matplotlib
matplotlib.use('Agg')  # Set non-interactive backend before importing pyplot

from flask import Blueprint, jsonify, request, send_file
from models import db, Activity, Task, Actor, Customer
from datetime import datetime, timedelta
import pandas as pd
from io import BytesIO
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet
import numpy as np
import os
import tempfile

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

@reports_bp.route('/get_activity_data', methods=['POST'])
def get_activity_data():
    try:
        data = request.json
        activity_id = data.get("activity_id")
        
        # Get standard time
        activity = Activity.query.get_or_404(activity_id)
        standard_time = activity.standard_time
        
        # Get all completed tasks for the activity
        tasks = Task.query.filter_by(activity_id=activity_id, status='completed').all()
        
        task_list = [{
            "employee_id": task.actor_id,
            "name": task.assigned_to,
            "task_id": task.task_id,
            "time_taken": task.time_taken,
            "completion_date": task.actual_date.strftime('%Y-%m-%d') if task.actual_date else None
        } for task in tasks]
        
        return jsonify({"tasks": task_list, "standard_time": standard_time})
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
        
        # Create a PDF file
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
        elements = []
        
        # Add title
        styles = getSampleStyleSheet()
        title = Paragraph(f"Activity Report: {activity.activity_name}", styles['Heading1'])
        elements.append(title)
        elements.append(Spacer(1, 12))
        
        # Add date
        date_text = Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d')}", styles['Normal'])
        elements.append(date_text)
        elements.append(Spacer(1, 12))
        
        # Check if we have any data
        if not tasks:
            # No data case
            no_data = Paragraph("No completed tasks found for this activity.", styles['Normal'])
            elements.append(no_data)
            doc.build(elements)
            
            buffer.seek(0)
            current_date = datetime.now().strftime("%Y-%m-%d")
            file_name = f"{current_date}_Activity_{activity_id}_Report.pdf"
            
            return send_file(
                buffer,
                as_attachment=True,
                download_name=file_name,
                mimetype="application/pdf"
            )
        
        # Convert to list format for PDF
        task_data = []
        for task, actor_name in tasks:
            # Safely handle None values for time_taken
            time_taken = task.time_taken if task.time_taken is not None else 0
            standard_time = activity.standard_time if activity.standard_time is not None else 0
            
            # Determine status safely
            if time_taken == standard_time:
                status = "ON-TIME"
            elif time_taken < standard_time:
                status = "EARLY"
            else:
                status = "DELAY"
                
            task_data.append({
                "Employee ID": task.actor_id,
                "Name": actor_name,
                "Task ID": task.task_id,
                "Time Taken": time_taken,
                "Date of Completion": task.actual_date.strftime('%Y-%m-%d') if task.actual_date else "N/A",
                "Standard Time": standard_time,
                "Status": status
            })
        
        # Get headers from the first dictionary
        headers = list(task_data[0].keys())
        table_data = [headers]  # First row is headers
        
        # Add data rows
        for item in task_data:
            table_data.append([str(item[col]) for col in headers])
        
        # Create the table
        table = Table(table_data)
        
        # Add style
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ])
        
        # Add row colors based on status
        for i, row in enumerate(task_data):
            if i < len(table_data) - 1:  # Skip header row
                status = row["Status"]
                if status == "EARLY":
                    style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.lightgreen)
                elif status == "DELAY":
                    style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.lightcoral)
        
        table.setStyle(style)
        elements.append(table)
        
        # Create temporary files for charts
        chart_files = []
        
        # 1. Original Pie Chart for Status Distribution
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Count statuses
            status_counts = {"EARLY": 0, "ON-TIME": 0, "DELAY": 0}
            for item in task_data:
                status_counts[item["Status"]] += 1
            
            # Create pie chart
            plt.figure(figsize=(6, 6))
            labels = list(status_counts.keys())
            sizes = list(status_counts.values())
            colors_list = ['lightgreen', 'lightskyblue', 'lightcoral']
            
            # Only include non-zero values
            non_zero_labels = []
            non_zero_sizes = []
            non_zero_colors = []
            
            for i, size in enumerate(sizes):
                if size > 0:
                    non_zero_labels.append(labels[i])
                    non_zero_sizes.append(size)
                    non_zero_colors.append(colors_list[i])
            
            if non_zero_sizes:  # Only create pie chart if there's data
                plt.pie(non_zero_sizes, labels=non_zero_labels, colors=non_zero_colors, autopct='%1.1f%%', startangle=90)
                plt.axis('equal')
                plt.title('Task Completion Status')
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 24))
                chart_title = Paragraph("Task Completion Status Distribution", styles['Heading2'])
                elements.append(chart_title)
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=300, height=300))
                chart_files.append(tmp.name)
            else:
                # No data for pie chart
                elements.append(Spacer(1, 24))
                no_chart_data = Paragraph("No status distribution data available for pie chart.", styles['Normal'])
                elements.append(no_chart_data)
            
        # 2. Time Efficiency Bar Chart
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            plt.figure(figsize=(10, 6))
            
            # Extract data for the chart
            names = [item["Name"] for item in task_data]
            time_taken = [item["Time Taken"] for item in task_data]
            standard_time = [item["Standard Time"] for item in task_data]
            
            # Create bar chart
            x = np.arange(len(names))
            width = 0.35
            
            fig, ax = plt.subplots(figsize=(10, 6))
            rects1 = ax.bar(x - width/2, time_taken, width, label='Time Taken', color='#3498db')
            rects2 = ax.bar(x + width/2, standard_time, width, label='Standard Time', color='#e74c3c')
            
            # Add labels and title
            ax.set_xlabel('Employees')
            ax.set_ylabel('Time (hours)')
            ax.set_title('Time Efficiency: Actual vs Standard')
            ax.set_xticks(x)
            ax.set_xticklabels(names, rotation=45, ha='right')
            ax.legend()
            
            # Add value labels on bars
            def autolabel(rects):
                for rect in rects:
                    height = rect.get_height()
                    ax.annotate(f'{height}',
                                xy=(rect.get_x() + rect.get_width() / 2, height),
                                xytext=(0, 3),  # 3 points vertical offset
                                textcoords="offset points",
                                ha='center', va='bottom')
            
            autolabel(rects1)
            autolabel(rects2)
            
            fig.tight_layout()
            plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
            plt.close()
            
            # Add chart to PDF
            elements.append(Spacer(1, 24))
            chart_title = Paragraph("Time Efficiency: Actual vs Standard", styles['Heading2'])
            elements.append(chart_title)
            elements.append(Spacer(1, 12))
            elements.append(Image(tmp.name, width=500, height=300))
            chart_files.append(tmp.name)
        
        # 3. Status Timeline
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            plt.figure(figsize=(10, 6))
            
            # Extract data for the chart
            completion_dates = []
            statuses = []
            names = []
            
            for item in task_data:
                if item["Date of Completion"] != "N/A":
                    completion_dates.append(datetime.strptime(item["Date of Completion"], '%Y-%m-%d'))
                    statuses.append(item["Status"])
                    names.append(item["Name"])
            
            # Sort by date
            sorted_data = sorted(zip(completion_dates, statuses, names))
            if sorted_data:
                completion_dates, statuses, names = zip(*sorted_data)
                
                # Create figure and axis
                fig, ax = plt.subplots(figsize=(10, 6))
                
                # Define colors for statuses
                status_colors = {
                    "EARLY": "green",
                    "ON-TIME": "blue",
                    "DELAY": "red"
                }
                
                # Plot points
                for i, (date, status, name) in enumerate(zip(completion_dates, statuses, names)):
                    ax.scatter(date, i, color=status_colors[status], s=100, label=status if status not in ax.get_legend_handles_labels()[1] else "")
                    ax.text(date, i, f"  {name}", verticalalignment='center')
                
                # Set labels and title
                ax.set_yticks([])
                ax.set_xlabel('Completion Date')
                ax.set_title('Task Completion Timeline')
                
                # Add legend (only once for each status)
                handles, labels = [], []
                for status, color in status_colors.items():
                    if status in statuses:
                        handles.append(plt.Line2D([0], [0], marker='o', color='w', markerfacecolor=color, markersize=10))
                        labels.append(status)
                
                ax.legend(handles, labels, loc='upper left')
                
                # Format x-axis as dates
                fig.autofmt_xdate()
                
                plt.tight_layout()
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 24))
                chart_title = Paragraph("Task Completion Timeline", styles['Heading2'])
                elements.append(chart_title)
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=500, height=300))
                chart_files.append(tmp.name)
        
        # 4. Time Savings Chart
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            plt.figure(figsize=(10, 6))
            
            # Calculate time difference (savings or excess)
            names = []
            time_diff = []
            bar_colors = []  # Renamed from 'colors' to avoid conflict
            
            for item in task_data:
                names.append(item["Name"])
                diff = item["Standard Time"] - item["Time Taken"]
                time_diff.append(diff)
                if diff > 0:
                    bar_colors.append('green')  # Time saved
                elif diff < 0:
                    bar_colors.append('red')    # Time exceeded
                else:
                    bar_colors.append('blue')   # On time
            
            # Create horizontal bar chart
            fig, ax = plt.subplots(figsize=(10, 6))
            y_pos = np.arange(len(names))
            
            bars = ax.barh(y_pos, time_diff, align='center', color=bar_colors)  # Use bar_colors instead of colors
            ax.set_yticks(y_pos)
            ax.set_yticklabels(names)
            ax.invert_yaxis()  # Labels read top-to-bottom
            ax.set_xlabel('Time Saved/Exceeded (hours)')
            ax.set_title('Time Efficiency Analysis')
            
            # Add a vertical line at x=0
            ax.axvline(x=0, color='black', linestyle='-', linewidth=0.5)
            
            # Add value labels
            for i, bar in enumerate(bars):
                width = bar.get_width()
                label_pos = width + 0.1 if width > 0 else width - 0.1
                alignment = 'left' if width > 0 else 'right'
                ax.text(label_pos, bar.get_y() + bar.get_height()/2, f'{width:.1f}', 
                        ha=alignment, va='center')
            
            plt.tight_layout()
            plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
            plt.close()
            
            # Add chart to PDF
            elements.append(Spacer(1, 24))
            chart_title = Paragraph("Time Efficiency Analysis", styles['Heading2'])
            elements.append(chart_title)
            elements.append(Spacer(1, 12))
            elements.append(Image(tmp.name, width=500, height=300))
            chart_files.append(tmp.name)
        
        # 5. Completion Rate Gauge
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Calculate completion rate
            total_tasks = len(task_data)
            completed_tasks = sum(1 for item in task_data if item["Status"] in ["EARLY", "ON-TIME", "DELAY"])
            completion_rate = (completed_tasks / total_tasks) * 100 if total_tasks > 0 else 0
            
            # Create gauge chart
            fig, ax = plt.subplots(figsize=(8, 8), subplot_kw={'projection': 'polar'})
            
            # Gauge settings
            gauge_min = 0
            gauge_max = 100
            gauge_range = gauge_max - gauge_min
            
            # Determine color based on completion rate
            if completion_rate < 50:
                color = 'red'
            elif completion_rate < 75:
                color = 'orange'
            else:
                color = 'green'
            
            # Plot gauge
            angle = (completion_rate / gauge_range) * np.pi
            ax.set_theta_offset(np.pi/2)
            ax.set_theta_direction(-1)
            
            # Set ticks and labels
            ax.set_xticks(np.linspace(0, np.pi, 6))
            ax.set_xticklabels([f'{int(x)}%' for x in np.linspace(0, 100, 6)])
            
            # Remove radial ticks and labels
            ax.set_yticks([])
            
            # Plot gauge bar
            ax.bar(np.linspace(0, angle, 100), np.ones(100), width=0.1, color=color, alpha=0.8)
            
            # Add completion rate text
            ax.text(0, 0, f"{completion_rate:.1f}%", ha='center', va='center', fontsize=24, fontweight='bold')
            ax.text(0, -0.2, "Completion Rate", ha='center', va='center', fontsize=12)
            
            # Set limits
            ax.set_rlim(0, 1)
            
            plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
            plt.close()
            
            # Add chart to PDF
            elements.append(Spacer(1, 24))
            chart_title = Paragraph("Task Completion Rate", styles['Heading2'])
            elements.append(chart_title)
            elements.append(Spacer(1, 12))
            elements.append(Image(tmp.name, width=300, height=300))
            chart_files.append(tmp.name)
        
        # Build the PDF
        doc.build(elements)
        
        # Clean up temporary files
        for file_path in chart_files:
            if os.path.exists(file_path):
                os.unlink(file_path)
        
        # Return the PDF
        buffer.seek(0)
        current_date = datetime.now().strftime("%Y-%m-%d")
        file_name = f"{current_date}_Activity_{activity_id}_Report.pdf"
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=file_name,
            mimetype="application/pdf"
        )
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        
        # Create a simple error PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        
        styles = getSampleStyleSheet()
        title = Paragraph("Error Report", styles['Heading1'])
        elements.append(title)
        elements.append(Spacer(1, 12))
        
        error_msg = Paragraph(f"An error occurred while generating the report: {str(e)}", styles['Normal'])
        elements.append(error_msg)
        
        doc.build(elements)
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name="error_report.pdf",
            mimetype="application/pdf"
        )

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
        
        # Create a PDF file
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
        elements = []
        
        # Add title
        styles = getSampleStyleSheet()
        title = Paragraph(f"Employee Performance Report: {actor.actor_name}", styles['Heading1'])
        elements.append(title)
        elements.append(Spacer(1, 12))
        
        # Add date
        date_text = Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d')}", styles['Normal'])
        elements.append(date_text)
        elements.append(Spacer(1, 12))
        
        # Check if we have any data
        if not tasks:
            # No data case
            no_data = Paragraph("No completed tasks found for this employee.", styles['Normal'])
            elements.append(no_data)
            doc.build(elements)
            
            buffer.seek(0)
            current_date = datetime.now().strftime("%Y-%m-%d")
            file_name = f"{current_date}_{actor.actor_name}_Performance.pdf"
            
            return send_file(
                buffer,
                as_attachment=True,
                download_name=file_name,
                mimetype="application/pdf"
            )
        
        # Convert to list format for PDF
        task_data = []
        for task, activity_name, standard_time in tasks:
            # Safely handle None values
            time_taken = task.time_taken if task.time_taken is not None else 0
            std_time = standard_time if standard_time is not None else 0
            
            # Determine status safely
            if time_taken == std_time:
                status = "ON-TIME"
            elif time_taken < std_time:
                status = "EARLY"
            else:
                status = "DELAY"
                
            task_data.append({
                "Activity ID": task.activity_id,
                "Activity Name": activity_name,
                "Task ID": task.task_id,
                "Date of Completion": task.actual_date.strftime('%Y-%m-%d') if task.actual_date else "N/A",
                "Time Taken": time_taken,
                "Standard Time": std_time,
                "Status": status,
                "Activity Type": task.activity_type if task.activity_type else "Unknown"
            })
        
        # Get headers from the first dictionary
        headers = list(task_data[0].keys())
        table_data = [headers]  # First row is headers
        
        # Add data rows
        for item in task_data:
            table_data.append([str(item[col]) for col in headers])
        
        # Create the table
        table = Table(table_data)
        
        # Add style
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ])
        
        # Add row colors based on status
        for i, row in enumerate(task_data):
            if i < len(table_data) - 1:  # Skip header row
                status = row["Status"]
                if status == "EARLY":
                    style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.lightgreen)
                elif status == "DELAY":
                    style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.lightcoral)
        
        table.setStyle(style)
        elements.append(table)
        
        # Create temporary files for charts
        chart_files = []
        
        # 1. Original Pie Chart for Status Distribution
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Count statuses
            status_counts = {"EARLY": 0, "ON-TIME": 0, "DELAY": 0}
            for item in task_data:
                status_counts[item["Status"]] += 1
            
            # Create pie chart
            plt.figure(figsize=(6, 6))
            labels = list(status_counts.keys())
            sizes = list(status_counts.values())
            colors_list = ['lightgreen', 'lightskyblue', 'lightcoral']
            
            # Only include non-zero values
            non_zero_labels = []
            non_zero_sizes = []
            non_zero_colors = []
            
            for i, size in enumerate(sizes):
                if size > 0:
                    non_zero_labels.append(labels[i])
                    non_zero_sizes.append(size)
                    non_zero_colors.append(colors_list[i])
            
            if non_zero_sizes:  # Only create pie chart if there's data
                plt.pie(non_zero_sizes, labels=non_zero_labels, colors=non_zero_colors, autopct='%1.1f%%', startangle=90)
                plt.axis('equal')
                plt.title('Task Completion Status')
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 24))
                chart_title = Paragraph("Task Completion Status Distribution", styles['Heading2'])
                elements.append(chart_title)
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=300, height=300))
                chart_files.append(tmp.name)
            else:
                # No data for pie chart
                elements.append(Spacer(1, 24))
                no_chart_data = Paragraph("No status distribution data available for pie chart.", styles['Normal'])
                elements.append(no_chart_data)
            
        # 2. Status Distribution Donut Chart
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Count statuses
            status_counts = {"EARLY": 0, "ON-TIME": 0, "DELAY": 0}
            for item in task_data:
                status_counts[item["Status"]] += 1
            
            # Create donut chart
            plt.figure(figsize=(6, 6))
            labels = list(status_counts.keys())
            sizes = list(status_counts.values())
            colors_list = ['#2ecc71', '#3498db', '#e74c3c']  # Green, Blue, Red
            
            # Only include non-zero values
            non_zero_labels = []
            non_zero_sizes = []
            non_zero_colors = []
            
            for i, size in enumerate(sizes):
                if size > 0:
                    non_zero_labels.append(labels[i])
                    non_zero_sizes.append(size)
                    non_zero_colors.append(colors_list[i])
            
            if non_zero_sizes:  # Only create donut chart if there's data
                plt.pie(non_zero_sizes, labels=non_zero_labels, colors=non_zero_colors, 
                       autopct='%1.1f%%', startangle=90, wedgeprops=dict(width=0.5))
                plt.axis('equal')
                plt.title('Task Status Distribution (Donut Chart)')
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 24))
                chart_title = Paragraph("Task Status Distribution (Donut Chart)", styles['Heading2'])
                elements.append(chart_title)
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=300, height=300))
                chart_files.append(tmp.name)
        
        # 3. Performance Variance Chart
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            plt.figure(figsize=(10, 6))
            
            # Calculate variance percentages
            task_ids = []
            variances = []
            bar_colors = []
            
            for item in task_data:
                task_ids.append(f"Task {item['Task ID']}")
                std_time = item["Standard Time"]
                time_taken = item["Time Taken"]
                
                if std_time > 0:  # Avoid division by zero
                    variance_pct = ((std_time - time_taken) / std_time) * 100
                else:
                    variance_pct = 0
                
                variances.append(variance_pct)
                
                # Color based on variance
                if variance_pct > 0:
                    bar_colors.append('#2ecc71')  # Green for positive variance (faster)
                elif variance_pct < 0:
                    bar_colors.append('#e74c3c')  # Red for negative variance (slower)
                else:
                    bar_colors.append('#3498db')  # Blue for no variance
            
            # Create bar chart
            plt.figure(figsize=(10, 6))
            bars = plt.bar(task_ids, variances, color=bar_colors)
            
            # Add a horizontal line at y=0
            plt.axhline(y=0, color='black', linestyle='-', alpha=0.3)
            
            # Add labels and title
            plt.xlabel('Tasks')
            plt.ylabel('Variance from Standard Time (%)')
            plt.title('Performance Variance by Task')
            plt.xticks(rotation=45, ha='right')
            
            # Add value labels on bars
            for bar in bars:
                height = bar.get_height()
                plt.text(bar.get_x() + bar.get_width()/2., 
                        height + (5 if height >= 0 else -15),
                        f'{height:.1f}%',
                        ha='center', va='bottom' if height >= 0 else 'top')
            
            plt.tight_layout()
            plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
            plt.close()
            
            # Add chart to PDF
            elements.append(Spacer(1, 24))
            chart_title = Paragraph("Performance Variance by Task", styles['Heading2'])
            elements.append(chart_title)
            elements.append(Spacer(1, 12))
            elements.append(Image(tmp.name, width=500, height=300))
            chart_files.append(tmp.name)
        
        # 4. Task Type Performance Comparison
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Group by activity type
            activity_types = {}
            
            for item in task_data:
                act_type = item["Activity Type"]
                if act_type not in activity_types:
                    activity_types[act_type] = {
                        "time_taken": [],
                        "standard_time": []
                    }
                
                activity_types[act_type]["time_taken"].append(item["Time Taken"])
                activity_types[act_type]["standard_time"].append(item["Standard Time"])
            
            if activity_types:
                # Calculate averages for each type
                types = []
                avg_time_taken = []
                avg_standard_time = []
                
                for act_type, data in activity_types.items():
                    if data["time_taken"]:  # Make sure there's data
                        types.append(act_type)
                        avg_time_taken.append(sum(data["time_taken"]) / len(data["time_taken"]))
                        avg_standard_time.append(sum(data["standard_time"]) / len(data["standard_time"]))
                
                # Create grouped bar chart
                plt.figure(figsize=(10, 6))
                x = np.arange(len(types))
                width = 0.35
                
                fig, ax = plt.subplots(figsize=(10, 6))
                rects1 = ax.bar(x - width/2, avg_time_taken, width, label='Avg Time Taken', color='#3498db')
                rects2 = ax.bar(x + width/2, avg_standard_time, width, label='Avg Standard Time', color='#e74c3c')
                
                # Add labels and title
                ax.set_xlabel('Activity Types')
                ax.set_ylabel('Time (hours)')
                ax.set_title('Performance by Activity Type')
                ax.set_xticks(x)
                ax.set_xticklabels(types)
                ax.legend()
                
                # Add value labels on bars
                def autolabel(rects):
                    for rect in rects:
                        height = rect.get_height()
                        ax.annotate(f'{height:.1f}',
                                    xy=(rect.get_x() + rect.get_width() / 2, height),
                                    xytext=(0, 3),  # 3 points vertical offset
                                    textcoords="offset points",
                                    ha='center', va='bottom')
                
                autolabel(rects1)
                autolabel(rects2)
                
                fig.tight_layout()
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 24))
                chart_title = Paragraph("Performance by Activity Type", styles['Heading2'])
                elements.append(chart_title)
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=500, height=300))
                chart_files.append(tmp.name)
        
        # 5. Efficiency Timeline
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Prepare data for timeline
            dates = []
            efficiency_ratios = []
            
            # Filter out items with no completion date
            dated_tasks = [item for item in task_data if item["Date of Completion"] != "N/A"]
            
            # Sort by completion date
            dated_tasks.sort(key=lambda x: x["Date of Completion"])
            
            for item in dated_tasks:
                if item["Standard Time"] > 0:  # Avoid division by zero
                    dates.append(datetime.strptime(item["Date of Completion"], '%Y-%m-%d'))
                    efficiency_ratio = item["Time Taken"] / item["Standard Time"]
                    efficiency_ratios.append(efficiency_ratio)
            
            if dates and efficiency_ratios:
                plt.figure(figsize=(10, 6))
                
                # Plot efficiency ratio (lower is better)
                plt.plot(dates, efficiency_ratios, marker='o', linestyle='-', color='#3498db')
                
                # Add a horizontal line at y=1 (where time taken equals standard time)
                plt.axhline(y=1, color='red', linestyle='--', alpha=0.7, label='Standard Time')
                
                # Add shaded regions for good/bad performance
                plt.fill_between(dates, 0, 1, alpha=0.2, color='green', label='Faster than Standard')
                plt.fill_between(dates, 1, max(efficiency_ratios) + 0.5, alpha=0.2, color='red', label='Slower than Standard')
                
                # Add labels and title
                plt.xlabel('Completion Date')
                plt.ylabel('Efficiency Ratio (Time Taken / Standard Time)')
                plt.title('Efficiency Timeline')
                plt.legend()
                
                # Format x-axis as dates
                plt.gcf().autofmt_xdate()
                
                plt.tight_layout()
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 24))
                chart_title = Paragraph("Efficiency Timeline", styles['Heading2'])
                elements.append(chart_title)
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=500, height=300))
                chart_files.append(tmp.name)
        
        # 6. Timeline of Due Dates
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Filter tasks with due dates
            tasks_with_due_dates = [item for item in task_data if item["Due Date"] != "N/A"]
            
            if tasks_with_due_dates:
                # Parse dates and prepare data
                for task in tasks_with_due_dates:
                    task["parsed_due_date"] = datetime.strptime(task["Due Date"], '%Y-%m-%d')
                
                # Sort by due date
                tasks_with_due_dates.sort(key=lambda x: x["parsed_due_date"])
                
                # Create figure
                plt.figure(figsize=(10, 6))
                
                # Create categories for current month, next month, and later
                current_date = datetime.now()
                current_month = current_date.replace(day=1)
                next_month = (current_month.replace(day=28) + timedelta(days=4)).replace(day=1)
                
                # Function to categorize tasks
                def categorize_due_date(due_date):
                    if due_date < current_date:
                        return "Overdue"
                    elif due_date < current_month.replace(day=28):
                        return "This Month"
                    elif due_date < next_month.replace(day=28):
                        return "Next Month"
                    else:
                        return "Future"
                
                # Group tasks by category
                categories = {"Overdue": 0, "This Month": 0, "Next Month": 0, "Future": 0}
                
                for task in tasks_with_due_dates:
                    category = categorize_due_date(task["parsed_due_date"])
                    categories[category] += 1
                
                # Define colors for the categories
                category_colors = {
                    "Overdue": '#e74c3c',     # Red
                    "This Month": '#f39c12',  # Orange
                    "Next Month": '#3498db',  # Blue
                    "Future": '#2ecc71'       # Green
                }
                
                # Create bar chart
                cat_names = list(categories.keys())
                cat_values = list(categories.values())
                bar_colors = [category_colors[cat] for cat in cat_names]
                
                plt.bar(cat_names, cat_values, color=bar_colors)
                
                # Add value labels
                for i, v in enumerate(cat_values):
                    plt.text(i, v + 0.5, str(v), ha='center')
                
                plt.ylabel('Number of Tasks')
                plt.title('Tasks by Due Date Category')
                plt.tight_layout()
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 24))
                chart_title = Paragraph("Tasks by Due Date Category", styles['Heading2'])
                elements.append(chart_title)
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=500, height=300))
                chart_files.append(tmp.name)
        
        # Build the PDF
        doc.build(elements)
        
        # Clean up temporary files
        for file_path in chart_files:
            if os.path.exists(file_path):
                os.unlink(file_path)
        
        # Return the PDF
        buffer.seek(0)
        current_date = datetime.now().strftime("%Y-%m-%d")
        file_name = f"{current_date}_{actor.actor_name}_Performance.pdf"
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=file_name,
            mimetype="application/pdf"
        )
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        
        # Create a simple error PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        
        styles = getSampleStyleSheet()
        title = Paragraph("Error Report", styles['Heading1'])
        elements.append(title)
        elements.append(Spacer(1, 12))
        
        error_msg = Paragraph(f"An error occurred while generating the report: {str(e)}", styles['Normal'])
        elements.append(error_msg)
        
        doc.build(elements)
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name="error_report.pdf",
            mimetype="application/pdf"
        )

@reports_bp.route('/download-customer-report/<int:customer_id>', methods=['GET'])
def download_customer_report(customer_id):
    try:
        # Get customer info
        customer = Customer.query.get_or_404(customer_id)
        
        # Get all tasks associated with this customer with activity and actor info
        tasks = db.session.query(
            Task, Activity.activity_name, Activity.standard_time, Actor.actor_name
        ).join(
            Activity, Task.activity_id == Activity.activity_id
        ).join(
            Actor, Task.actor_id == Actor.actor_id
        ).filter(
            Task.customer_name == customer.customer_name  # Use customer_name instead of customer_id
        ).all()
        
        # Create a PDF file
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
        elements = []
        
        # Add title
        styles = getSampleStyleSheet()
        title = Paragraph(f"Client Report: {customer.customer_name}", styles['Heading1'])
        elements.append(title)
        elements.append(Spacer(1, 12))
        
        # Add date and client details
        date_text = Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d')}", styles['Normal'])
        elements.append(date_text)
        elements.append(Spacer(1, 12))
        
        # Add client information box
        client_info = [
            ["Client Information"],
            [f"Name: {customer.customer_name}"],
            [f"Email: {customer.email_id}" if hasattr(customer, 'email_id') and customer.email_id else "Email: Not Available"],
            [f"Phone: {customer.mobile1}" if hasattr(customer, 'mobile1') and customer.mobile1 else "Phone: Not Available"],
            [f"City: {customer.city}" if hasattr(customer, 'city') and customer.city else "City: Not Available"],
            [f"Status: {'Active' if customer.status == 'A' else 'Inactive'}"]
        ]
        
        client_table = Table(client_info, colWidths=400)
        client_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ]))
        
        elements.append(client_table)
        elements.append(Spacer(1, 20))
        
        # Check if we have any data
        if not tasks:
            # No data case
            no_data = Paragraph("No tasks found for this client.", styles['Normal'])
            elements.append(no_data)
            doc.build(elements)
            
            buffer.seek(0)
            current_date = datetime.now().strftime("%Y-%m-%d")
            file_name = f"{current_date}_{customer.customer_name}_Report.pdf"
            
            return send_file(
                buffer,
                as_attachment=True,
                download_name=file_name,
                mimetype="application/pdf"
            )
        
        # Convert to list format for PDF
        task_data = []
        for task, activity_name, standard_time, actor_name in tasks:
            # Safely handle None values
            time_taken = task.time_taken if hasattr(task, 'time_taken') and task.time_taken is not None else 0
            std_time = standard_time if standard_time is not None else 0
            
            # Map database status to report status
            # Adjusted to match your actual status values from the database
            if task.status == 'completed':
                if time_taken == std_time:
                    status = "ON-TIME"
                elif time_taken < std_time:
                    status = "EARLY"
                else:
                    status = "DELAY"
            else:
                # Use the database status directly
                status = task.status.upper() if task.status else "PENDING"
                
            task_data.append({
                "Task ID": task.task_id,
                "Activity Name": activity_name,
                "Auditor Name": actor_name,
                "Due Date": task.due_date.strftime('%Y-%m-%d') if hasattr(task, 'due_date') and task.due_date else "N/A",
                "Completion Date": task.actual_date.strftime('%Y-%m-%d') if hasattr(task, 'actual_date') and task.actual_date else "Not Completed",
                "Status": status,
                "Time Taken": time_taken if task.status == 'completed' else "N/A",
                "Standard Time": std_time,
                "Activity Type": task.activity_type if hasattr(task, 'activity_type') and task.activity_type else "R"
            })
        
        # Create a paragraph for task summary
        tasks_summary = Paragraph(f"Tasks Summary ({len(task_data)} tasks total)", styles['Heading2'])
        elements.append(tasks_summary)
        elements.append(Spacer(1, 12))
        
        # Get headers from the first dictionary
        headers = list(task_data[0].keys())
        table_data = [headers]  # First row is headers
        
        # Add data rows
        for item in task_data:
            table_data.append([str(item[col]) for col in headers])
        
        # Create the table
        table = Table(table_data)
        
        # Add style
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ])
        
        # Add row colors based on status from the database values
        for i, row in enumerate(task_data):
            if i < len(table_data) - 1:  # Skip header row
                status = row["Status"]
                if status == "EARLY":
                    style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.lightgreen)
                elif status == "DELAY":
                    style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.lightcoral)
                elif status == "COMPLETED":
                    style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.lightblue)
                elif status == "PENDING":
                    style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.lightyellow)
                elif status == "WIP":
                    style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.lightgrey)
        
        table.setStyle(style)
        elements.append(table)
        
        # Create temporary files for charts
        chart_files = []
        
        # 1. Task Status Distribution Pie Chart
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Count task statuses
            status_counts = {}
            for item in task_data:
                status = item["Status"]
                if status not in status_counts:
                    status_counts[status] = 0
                status_counts[status] += 1
            
            # Create pie chart
            plt.figure(figsize=(6, 6))
            
            # Define colors for different statuses - updated to match your database values
            status_colors = {
                "EARLY": '#2ecc71',           # Green
                "ON-TIME": '#3498db',         # Blue
                "DELAY": '#e74c3c',           # Red
                "PENDING": '#f39c12',         # Orange
                "WIP": '#9b59b6',             # Purple
                "COMPLETED": '#1abc9c',       # Teal
                "YET TO START": '#34495e'     # Dark blue
            }
            
            # Default color for any other status
            default_color = '#95a5a6'    # Gray
            
            # Prepare data for pie chart
            labels = list(status_counts.keys())
            sizes = list(status_counts.values())
            colors_list = [status_colors.get(status, default_color) for status in labels]
            
            # Create the pie chart
            plt.pie(sizes, labels=labels, colors=colors_list, autopct='%1.1f%%', startangle=90)
            plt.axis('equal')
            plt.title('Task Status Distribution')
            plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
            plt.close()
            
            # Add chart to PDF
            elements.append(Spacer(1, 24))
            chart_title = Paragraph("Task Status Distribution", styles['Heading2'])
            elements.append(chart_title)
            elements.append(Spacer(1, 12))
            elements.append(Image(tmp.name, width=300, height=300))
            chart_files.append(tmp.name)
        
        # 2. Auditor Assignment Distribution
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Count tasks by auditor
            auditor_counts = {}
            for item in task_data:
                auditor = item["Auditor Name"]
                if auditor not in auditor_counts:
                    auditor_counts[auditor] = 0
                auditor_counts[auditor] += 1
            
            # Sort auditors by number of tasks (descending)
            sorted_auditors = sorted(auditor_counts.items(), key=lambda x: x[1], reverse=True)
            
            # Prepare data for horizontal bar chart
            auditors = [item[0] for item in sorted_auditors]
            task_counts = [item[1] for item in sorted_auditors]
            
            # Create horizontal bar chart
            plt.figure(figsize=(10, max(6, len(auditors) * 0.5)))  # Adjust height based on number of auditors
            plt.barh(auditors, task_counts, color='#3498db')
            
            # Add count labels
            for i, count in enumerate(task_counts):
                plt.text(count + 0.1, i, str(count), va='center')
            
            # Add labels and title
            plt.xlabel('Number of Tasks')
            plt.ylabel('Auditor Name')
            plt.title('Tasks Distribution by Auditor')
            plt.tight_layout()
            plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
            plt.close()
            
            # Add chart to PDF
            elements.append(Spacer(1, 24))
            chart_title = Paragraph("Tasks Distribution by Auditor", styles['Heading2'])
            elements.append(chart_title)
            elements.append(Spacer(1, 12))
            elements.append(Image(tmp.name, width=500, height=max(300, len(auditors) * 25)))
            chart_files.append(tmp.name)
        
        # 3. Task Completion Timeline (for completed tasks)
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Filter completed tasks with actual dates
            completed_tasks = [item for item in task_data if item["Completion Date"] != "Not Completed"]
            
            if completed_tasks:
                # Parse dates and prepare data
                for task in completed_tasks:
                    task["parsed_date"] = datetime.strptime(task["Completion Date"], '%Y-%m-%d')
                
                # Sort by completion date
                completed_tasks.sort(key=lambda x: x["parsed_date"])
                
                # Create figure
                plt.figure(figsize=(10, 6))
                
                # Extract data for plotting
                dates = [task["parsed_date"] for task in completed_tasks]
                task_ids = [f"Task {task['Task ID']}" for task in completed_tasks]
                statuses = [task["Status"] for task in completed_tasks]
                
                # Define colors for statuses
                status_colors = {
                    "EARLY": '#2ecc71',
                    "ON-TIME": '#3498db',
                    "DELAY": '#e74c3c',
                    "COMPLETED": '#1abc9c'
                }
                
                # Plot points
                for i, (date, task_id, status) in enumerate(zip(dates, task_ids, statuses)):
                    color = status_colors.get(status, '#95a5a6')
                    plt.scatter(date, i, color=color, s=100)
                    plt.text(date, i, f"  {task_id}", va='center')
                
                # Add legend
                legend_elements = [plt.Line2D([0], [0], marker='o', color='w', markerfacecolor=color, markersize=10, label=status)
                                for status, color in status_colors.items() if status in statuses]
                plt.legend(handles=legend_elements, loc='upper left')
                
                # Format plot
                plt.yticks([])  # Hide y-axis labels
                plt.xlabel('Completion Date')
                plt.title('Task Completion Timeline')
                plt.grid(axis='x', linestyle='--', alpha=0.7)
                plt.gcf().autofmt_xdate()
                
                plt.tight_layout()
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 24))
                chart_title = Paragraph("Task Completion Timeline", styles['Heading2'])
                elements.append(chart_title)
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=500, height=300))
                chart_files.append(tmp.name)
        
        # 3.5. Activity Type Distribution Chart
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Group by activity type
            activity_types = {}
            for item in task_data:
                act_type = item["Activity Type"]
                if act_type not in activity_types:
                    activity_types[act_type] = 0
                activity_types[act_type] += 1
            
            if activity_types:
                # Prepare data for pie chart
                types = list(activity_types.keys())
                counts = list(activity_types.values())
                
                # Define colors for activity types
                type_colors = {
                    'R': '#3498db',  # Blue for regular tasks
                    'U': '#e74c3c',  # Red for urgent tasks
                    'S': '#2ecc71',  # Green for special tasks
                    'C': '#f39c12'   # Orange for custom tasks
                }
                
                # Use default color for unknown types
                colors_list = [type_colors.get(t, '#95a5a6') for t in types]
                
                # Create pie chart
                plt.figure(figsize=(6, 6))
                plt.pie(counts, labels=types, colors=colors_list, autopct='%1.1f%%', startangle=90)
                plt.axis('equal')
                plt.title('Activity Type Distribution')
                
                # Add legend with activity type descriptions
                type_descriptions = {
                    'R': 'Regular',
                    'U': 'Urgent',
                    'S': 'Special',
                    'C': 'Custom'
                }
                
                legend_labels = [f"{t} - {type_descriptions.get(t, 'Unknown')}" for t in types]
                plt.legend(legend_labels, loc='lower left', bbox_to_anchor=(0.0, -0.1))
                
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 24))
                chart_title = Paragraph("Activity Type Distribution", styles['Heading2'])
                elements.append(chart_title)
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=300, height=300))
                chart_files.append(tmp.name)
        
        # 4. Task Standard Time vs. Activity Chart
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Group by activity
            activity_data = {}
            for item in task_data:
                activity = item["Activity Name"]
                if activity not in activity_data:
                    activity_data[activity] = {
                        "standard_times": [],
                        "count": 0
                    }
                
                activity_data[activity]["standard_times"].append(
                    float(item["Standard Time"]) if isinstance(item["Standard Time"], (int, float, str)) and item["Standard Time"] != "N/A" else 0
                )
                activity_data[activity]["count"] += 1
            
            if activity_data:
                # Calculate average standard time for each activity
                activities = []
                avg_std_times = []
                task_counts = []
                
                for activity, data in activity_data.items():
                    activities.append(activity)
                    avg_std_times.append(sum(data["standard_times"]) / len(data["standard_times"]))
                    task_counts.append(data["count"])
                
                # Sort by task count
                sorted_data = sorted(zip(activities, avg_std_times, task_counts), key=lambda x: x[2], reverse=True)
                activities, avg_std_times, task_counts = zip(*sorted_data) if sorted_data else ([], [], [])
                
                # Create bar chart
                fig, ax1 = plt.subplots(figsize=(10, 6))
                
                # Plot average standard time bars
                x = np.arange(len(activities))
                width = 0.35
                bars1 = ax1.bar(x, avg_std_times, width, color='#3498db', label='Avg Standard Time (hours)')
                
                # Format y-axis for hours
                ax1.set_ylabel('Average Standard Time (hours)')
                ax1.set_ylim(0, max(avg_std_times) * 1.2 if avg_std_times else 10)
                
                # Create secondary y-axis for task counts
                ax2 = ax1.twinx()
                ax2.plot(x, task_counts, 'r-', marker='o', linewidth=2, markersize=8, label='Task Count')
                ax2.set_ylabel('Number of Tasks')
                ax2.set_ylim(0, max(task_counts) * 1.2 if task_counts else 10)
                
                # Set x-axis labels
                ax1.set_xticks(x)
                ax1.set_xticklabels(activities, rotation=45, ha='right')
                
                # Add title and legends
                plt.title('Activity Analysis: Standard Time and Task Count')
                ax1.legend(loc='upper left')
                ax2.legend(loc='upper right')
                
                # Add value labels on bars
                for i, bar in enumerate(bars1):
                    height = bar.get_height()
                    ax1.text(bar.get_x() + bar.get_width()/2., height + 0.1,
                            f'{height:.1f}h', ha='center', va='bottom')
                
                plt.tight_layout()
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 24))
                chart_title = Paragraph("Activity Analysis: Standard Time and Task Count", styles['Heading2'])
                elements.append(chart_title)
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=500, height=300))
                chart_files.append(tmp.name)
        
        # 5. Task Status by Auditor (Heat Map)
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Group task status by auditor
            auditor_status_data = {}
            unique_statuses = set()
            
            for item in task_data:
                auditor = item["Auditor Name"]
                status = item["Status"]
                
                if auditor not in auditor_status_data:
                    auditor_status_data[auditor] = {}
                
                if status not in auditor_status_data[auditor]:
                    auditor_status_data[auditor][status] = 0
                
                auditor_status_data[auditor][status] += 1
                unique_statuses.add(status)
            
            if auditor_status_data and unique_statuses:
                # Convert to matrix format for heatmap
                auditors = list(auditor_status_data.keys())
                statuses = sorted(list(unique_statuses))
                
                # Create matrix with counts
                data_matrix = np.zeros((len(auditors), len(statuses)))
                
                for i, auditor in enumerate(auditors):
                    for j, status in enumerate(statuses):
                        if status in auditor_status_data[auditor]:
                            data_matrix[i, j] = auditor_status_data[auditor][status]
                
                # Create heatmap
                plt.figure(figsize=(12, max(6, len(auditors) * 0.5)))
                
                # Define colors for heatmap
                cmap = plt.cm.Blues
                norm = plt.Normalize(vmin=0, vmax=np.max(data_matrix) if np.max(data_matrix) > 0 else 1)
                
                # Create heatmap
                plt.imshow(data_matrix, cmap=cmap, norm=norm, aspect='auto')
                
                # Add labels
                plt.yticks(np.arange(len(auditors)), auditors)
                plt.xticks(np.arange(len(statuses)), statuses, rotation=45, ha='right')
                
                # Add colorbar
                cbar = plt.colorbar()
                cbar.set_label('Number of Tasks')
                
                # Add values on cells
                for i in range(len(auditors)):
                    for j in range(len(statuses)):
                        if data_matrix[i, j] > 0:
                            plt.text(j, i, int(data_matrix[i, j]), ha='center', va='center', 
                                    color='white' if data_matrix[i, j] > np.max(data_matrix)/2 else 'black')
                
                plt.title('Task Status by Auditor')
                plt.tight_layout()
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 24))
                chart_title = Paragraph("Task Status by Auditor", styles['Heading2'])
                elements.append(chart_title)
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=600, height=max(300, len(auditors) * 30)))
                chart_files.append(tmp.name)
        
        # 6. Timeline of Due Dates
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Filter tasks with due dates
            tasks_with_due_dates = [item for item in task_data if item["Due Date"] != "N/A"]
            
            if tasks_with_due_dates:
                # Parse dates and prepare data
                for task in tasks_with_due_dates:
                    task["parsed_due_date"] = datetime.strptime(task["Due Date"], '%Y-%m-%d')
                
                # Sort by due date
                tasks_with_due_dates.sort(key=lambda x: x["parsed_due_date"])
                
                # Create figure
                plt.figure(figsize=(10, 6))
                
                # Create categories for current month, next month, and later
                current_date = datetime.now()
                current_month = current_date.replace(day=1)
                next_month = (current_month.replace(day=28) + timedelta(days=4)).replace(day=1)
                
                # Function to categorize tasks
                def categorize_due_date(due_date):
                    if due_date < current_date:
                        return "Overdue"
                    elif due_date < current_month.replace(day=28):
                        return "This Month"
                    elif due_date < next_month.replace(day=28):
                        return "Next Month"
                    else:
                        return "Future"
                
                # Group tasks by category
                categories = {"Overdue": 0, "This Month": 0, "Next Month": 0, "Future": 0}
                
                for task in tasks_with_due_dates:
                    category = categorize_due_date(task["parsed_due_date"])
                    categories[category] += 1
                
                # Define colors for the categories
                category_colors = {
                    "Overdue": '#e74c3c',     # Red
                    "This Month": '#f39c12',  # Orange
                    "Next Month": '#3498db',  # Blue
                    "Future": '#2ecc71'       # Green
                }
                
                # Create bar chart
                cat_names = list(categories.keys())
                cat_values = list(categories.values())
                bar_colors = [category_colors[cat] for cat in cat_names]
                
                plt.bar(cat_names, cat_values, color=bar_colors)
                
                # Add value labels
                for i, v in enumerate(cat_values):
                    plt.text(i, v + 0.5, str(v), ha='center')
                
                plt.ylabel('Number of Tasks')
                plt.title('Tasks by Due Date Category')
                plt.tight_layout()
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 24))
                chart_title = Paragraph("Tasks by Due Date Category", styles['Heading2'])
                elements.append(chart_title)
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=500, height=300))
                chart_files.append(tmp.name)
        
        # Build the PDF
        doc.build(elements)
        
        # Clean up temporary files
        for file_path in chart_files:
            if os.path.exists(file_path):
                os.unlink(file_path)
        
        # Return the PDF
        buffer.seek(0)
        current_date = datetime.now().strftime("%Y-%m-%d")
        file_name = f"{current_date}_{customer.customer_name}_Report.pdf"
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=file_name,
            mimetype="application/pdf"
        )
    except Exception as e:
        print(f"Error generating client report PDF: {str(e)}")
        
        # Create a simple error PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        
        styles = getSampleStyleSheet()
        title = Paragraph("Error Report", styles['Heading1'])
        elements.append(title)
        elements.append(Spacer(1, 12))
        
        error_msg = Paragraph(f"An error occurred while generating the client report: {str(e)}", styles['Normal'])
        elements.append(error_msg)
        
        doc.build(elements)
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name="error_report.pdf",
            mimetype="application/pdf"
        ) 
