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
import traceback

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

@reports_bp.route('/get_activity_data', methods=['GET'])
def get_activity_data():
    try:
        activity_id = request.args.get('activity_id')
        
        # Join with activities and customers tables to get task_name and customer_name
        tasks = db.session.query(
            Task.employee_id,
            Actor.actor_name.label('name'),
            Task.task_name,  # This will be the activity name
            Customer.customer_name,
            Task.time_taken,
            Task.completion_date,
            Activity.standard_time
        ).join(
            Actor, Task.employee_id == Actor.actor_id
        ).join(
            Customer, Task.customer_name == Customer.customer_name
        ).join(
            Activity, Task.task_name == Activity.activity_id
        ).filter(
            Task.task_name == activity_id
        ).all()

        # Convert the results to a list of dictionaries
        task_list = [{
            'employee_id': task.employee_id,
            'name': task.name,
            'task_name': task.task_name,
            'customer_name': task.customer_name,
            'time_taken': task.time_taken,
            'completion_date': task.completion_date.strftime('%Y-%m-%d') if task.completion_date else None
        } for task in tasks]

        # Get the standard time from the first result
        standard_time = tasks[0].standard_time if tasks else None

        return jsonify({
            'tasks': task_list,
            'standard_time': standard_time
        })

    except Exception as e:
        print(f"Error fetching activity data: {e}")
        return jsonify({'error': str(e)}), 500

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
        
        # Create the table with better styling
        col_widths = [100, 150, 70, 85, 80, 85, 70, 70]  # Significantly increased Task ID column width
        table = Table(table_data, colWidths=col_widths)
        
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
            
            # Create pie chart with improved styling
            plt.figure(figsize=(8, 8))
            
            # Define better colors for different statuses
            status_colors = {
                "COMPLETED": '#3498db',    # Blue
                "WIP": '#2ecc71',          # Green
                "PENDING": '#f1c40f',      # Yellow
                "YET TO START": '#e74c3c'  # Red
            }
            
            # Prepare data for pie chart
            labels = list(status_counts.keys())
            sizes = list(status_counts.values())
            colors_list = [status_colors.get(status, '#95a5a6') for status in labels]
            
            # Format the labels with counts
            formatted_labels = [f"{label}\n({count})" for label, count in zip(labels, sizes)]
            
            # Create the pie chart with clean styling
            plt.pie(sizes, 
                    labels=None,  # No labels inside the pie
                    colors=colors_list, 
                    autopct='%1.1f%%', 
                    startangle=90, 
                    shadow=False,  # Remove shadow
                    wedgeprops={'edgecolor': 'white', 'linewidth': 1},
                    textprops={'fontsize': 10, 'color': 'black', 'weight': 'bold'})
            
            # Add a legend outside the pie chart
            plt.legend(formatted_labels, 
                      loc="center right", 
                      bbox_to_anchor=(1.1, 0.5),
                      frameon=False)
            
            plt.axis('equal')
            plt.title('Task Status Distribution', fontsize=14, fontweight='bold', pad=15)
            plt.tight_layout()
            
            plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
            plt.close()
            
            # Add chart to PDF
            elements.append(Spacer(1, 24))
            chart_title = Paragraph("Task Completion Status Distribution", styles['Heading2'])
            elements.append(chart_title)
            elements.append(Spacer(1, 12))
            elements.append(Image(tmp.name, width=300, height=300))
            chart_files.append(tmp.name)
        
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
        # Get all completed tasks for this employee with activity and customer info
        tasks = db.session.query(
            Task, Activity.activity_name, Activity.standard_time, Customer.customer_name
        ).join(
            Activity, Task.activity_id == Activity.activity_id
        ).join(
            Customer, Task.customer_name == Customer.customer_name
        ).filter(
            Task.actor_id == actor_id,
            Task.status == 'completed'
        ).all()
        
        task_list = [{
            "activity_id": task[0].activity_id,
            "activity_name": task[1],  # Using activity_name instead of task_id
            "task_name": task[0].task_name,  # Adding task name
            "customer_name": task[3],  # Adding customer/client name
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
        
        # Get all tasks for this actor (not just completed ones)
        tasks = db.session.query(
            Task, Activity.activity_name, Activity.standard_time, Customer.customer_name
        ).join(
            Activity, Task.activity_id == Activity.activity_id
        ).join(
            Customer, Task.customer_name == Customer.customer_name
        ).filter(
            Task.actor_id == actor_id
        ).all()
        
        # Create a PDF file
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
        elements = []
        
        # Add title
        styles = getSampleStyleSheet()
        title_style = styles['Heading1']
        title_style.alignment = 1  # Center alignment
        title = Paragraph(f"Performance Report: {actor.actor_name}", title_style)
        elements.append(title)
        elements.append(Spacer(1, 20))
        
        # Add date
        date_style = styles['Normal']
        date_style.alignment = 1  # Center alignment
        date_text = Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d')}", date_style)
        elements.append(date_text)
        elements.append(Spacer(1, 20))
        
        # Convert to list format for PDF
        task_data = []
        for task, activity_name, standard_time, customer_name in tasks:
            # Safely handle None values
            time_taken = task.time_taken if task.time_taken is not None else 0
            std_time = standard_time if standard_time is not None else 0
            
            # Determine performance status for completed tasks
            if task.status == 'completed':
                if time_taken == std_time:
                        performance = "ON-TIME"
                elif time_taken < std_time:
                        performance = "EARLY"
                else:
                        performance = "DELAY"
            else:
                performance = "N/A"
                    
            task_data.append({
                "Activity Name": activity_name,
                "Task Name": task.task_name,
                "Client Name": customer_name,
                "Time Taken": time_taken,
                "Standard Time": std_time,
                "Status": task.status.upper() if task.status else "PENDING",
                "Performance": performance
            })

        if not task_data:
            # Handle empty data case
            no_data = Paragraph("No tasks found for this employee.", styles['Normal'])
            elements.append(no_data)
            doc.build(elements)
            buffer.seek(0)
            return send_file(
                buffer,
                as_attachment=True,
                download_name=f"{datetime.now().strftime('%Y-%m-%d')}_{actor.actor_name}_Performance.pdf",
                mimetype="application/pdf"
            )

        # Define column headers with better formatting
        headers = ["Activity Name", "Task Name", "Client Name", "Time Taken", "Standard Time", "Status", "Performance"]
        table_data = [headers]  # First row is headers
        
        # Add data rows
        for item in task_data:
            row = []
            for header in headers:
                value = item.get(header, "N/A")
                if isinstance(value, (int, float)) and header in ["Time Taken", "Standard Time"]:
                    value = f"{value:.1f}"
                row.append(str(value))
            table_data.append(row)
            
        # Create the table with better styling
        col_widths = [100, 150, 70, 85, 80, 85, 70, 70]  # Significantly increased Task ID column width
        table = Table(table_data, colWidths=col_widths)
        
        # Add style
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ])
        
        # Add row colors based on status
        for i, row in enumerate(task_data):
            status = row["Status"]
            performance = row["Performance"]
            
            if status == "COMPLETED":
                if performance == "EARLY":
                    style.add('BACKGROUND', (0, i), (-1, i), colors.lightgreen)
                elif performance == "DELAY":
                    style.add('BACKGROUND', (0, i), (-1, i), colors.lightcoral)
                else:  # ON-TIME
                    style.add('BACKGROUND', (0, i), (-1, i), colors.lightblue)
            elif status == "WIP":
                style.add('BACKGROUND', (0, i), (-1, i), colors.lightyellow)
            elif status == "PENDING":
                style.add('BACKGROUND', (0, i), (-1, i), colors.lightgrey)
        
        table.setStyle(style)
        elements.append(table)
        elements.append(Spacer(1, 30))
        
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
            
            if status_counts:
                # Create pie chart with improved styling
                plt.figure(figsize=(8, 8))
                
                # Define better colors for different statuses
                status_colors = {
                    "COMPLETED": '#3498db',    # Blue
                    "WIP": '#2ecc71',          # Green
                    "PENDING": '#f1c40f',      # Yellow
                    "YET TO START": '#e74c3c'  # Red
                }
                
                # Prepare data for pie chart
                labels = list(status_counts.keys())
                sizes = list(status_counts.values())
                colors_list = [status_colors.get(status, '#95a5a6') for status in labels]
                
                # Format the labels with counts
                formatted_labels = [f"{label}\n({count})" for label, count in zip(labels, sizes)]
                
                # Create the pie chart with clean styling
                plt.pie(sizes, 
                        labels=None,  # No labels inside the pie
                        colors=colors_list, 
                        autopct='%1.1f%%', 
                        startangle=90, 
                        shadow=False,  # Remove shadow
                        wedgeprops={'edgecolor': 'white', 'linewidth': 1},
                        textprops={'fontsize': 10, 'color': 'black', 'weight': 'bold'})
                
                # Add a legend outside the pie chart
                plt.legend(formatted_labels, 
                          loc="center right", 
                          bbox_to_anchor=(1.1, 0.5),
                          frameon=False)
                
                plt.axis('equal')
                plt.title('Task Status Distribution', fontsize=14, fontweight='bold', pad=15)
                plt.tight_layout()
                
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 30))
                elements.append(Paragraph("Task Status Distribution", styles['Heading2']))
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=350, height=350))
                chart_files.append(tmp.name)

        # 2. Task Completion Timeline (Bar chart)
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Collect completion dates
            completion_dates = []
            
            for item in task_data:
                if item["Status"] == "COMPLETED":
                    task_date = db.session.query(Task).filter_by(
                        task_name=item["Task Name"], 
                        actor_id=actor_id
                    ).first().actual_date
                    
                    if task_date:
                        # Check if task_date is already a date object or a datetime object
                        if hasattr(task_date, 'date'):
                            completion_dates.append(task_date.date())
                        else:
                            # It's already a date object
                            completion_dates.append(task_date)
            
            if completion_dates:
                # Count tasks per date
                from collections import Counter
                date_counts = Counter(completion_dates)
                dates = sorted(date_counts.keys())
                counts = [date_counts[date] for date in dates]
                
                plt.figure(figsize=(12, 6))
                plt.bar(dates, counts, color='#3498db', width=0.7, alpha=0.7)
                plt.xlabel('Date', fontsize=12)
                plt.ylabel('Number of Tasks', fontsize=12)
                plt.title('Task Completion Timeline', fontsize=14, fontweight='bold')
                plt.xticks(rotation=45)
                plt.grid(True, axis='y', linestyle='--', alpha=0.7)
                plt.tight_layout()
                
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                elements.append(Spacer(1, 30))
                elements.append(Paragraph("Task Completion Timeline", styles['Heading2']))
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=500, height=300))
                chart_files.append(tmp.name)
        
        # 3. Time Efficiency Analysis (Actual vs Standard time)
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Only include completed tasks with non-zero times
            completed_tasks = [item for item in task_data 
                              if item["Status"] == "COMPLETED" 
                              and item["Time Taken"] > 0 
                              and item["Standard Time"] > 0]
            
            if completed_tasks:
                # Get unique activity names for completed tasks
                activity_names = []
                time_taken_values = []
                standard_time_values = []
                
                # Aggregate by activity name
                activity_data = {}
                for task in completed_tasks:
                    activity = task["Activity Name"]
                    if activity not in activity_data:
                        activity_data[activity] = {
                            "time_taken": 0,
                            "standard_time": 0,
                            "count": 0
                        }
                    
                    # Convert string values to float if needed
                    time_taken = float(task["Time Taken"]) if isinstance(task["Time Taken"], str) else task["Time Taken"]
                    std_time = float(task["Standard Time"]) if isinstance(task["Standard Time"], str) else task["Standard Time"]
                    
                    activity_data[activity]["time_taken"] += time_taken
                    activity_data[activity]["standard_time"] += std_time
                    activity_data[activity]["count"] += 1
                
                # Prepare data for chart
                for activity, data in activity_data.items():
                    activity_names.append(activity)
                    time_taken_values.append(data["time_taken"])
                    standard_time_values.append(data["standard_time"])
                
                # Create the bar chart
                plt.figure(figsize=(10, 6))
            x = np.arange(len(activity_names))
            width = 0.35
            
            fig, ax = plt.subplots(figsize=(10, 6))
            rects1 = ax.bar(x - width/2, time_taken_values, width, label='Time Taken', color='#3498db')
            rects2 = ax.bar(x + width/2, standard_time_values, width, label='Standard Time', color='#e74c3c')
            
            ax.set_xlabel('Activities', fontsize=12)
            ax.set_ylabel('Time (hours)', fontsize=12)
            ax.set_title('Time Efficiency: Actual vs Standard', fontsize=14, fontweight='bold')
            ax.set_xticks(x)
                
                # Handle long activity names by shortening them
            short_names = [name[:15] + '...' if len(name) > 15 else name for name in activity_names]
            ax.set_xticklabels(short_names, rotation=45, ha='right')
            ax.legend()
            
                # Add value labels on bars
            def autolabel(rects):
                for rect in rects:
                    height = rect.get_height()
                    ax.annotate(f'{height:.1f}',
                              xy=(rect.get_x() + rect.get_width() / 2, height),
                              xytext=(0, 3),
                              textcoords="offset points",
                                  ha='center', va='bottom',
                                  fontsize=8)
            
            autolabel(rects1)
            autolabel(rects2)
            
            plt.grid(True, axis='y', linestyle='--', alpha=0.3)
            fig.tight_layout()
            plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
            plt.close()
            
            elements.append(Spacer(1, 30))
            elements.append(Paragraph("Time Efficiency Analysis", styles['Heading2']))
            elements.append(Spacer(1, 12))
            elements.append(Image(tmp.name, width=500, height=300))
            chart_files.append(tmp.name)

        # 4. Task Timeline Scatter Plot
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Get all tasks with their status and activity
            task_activities = []
            task_dates = []
            task_statuses = []
            
            for idx, item in enumerate(task_data):
                task_query = db.session.query(Task).filter_by(
                    task_name=item["Task Name"],
                    actor_id=actor_id
                ).first()
                
                # Get the date (either completion date or due date)
                task_date = None
                if item["Status"] == "COMPLETED" and task_query.actual_date:
                    task_date = task_query.actual_date
                elif task_query.duedate:
                    task_date = task_query.duedate
                
                if task_date:
                    task_activities.append(item["Activity Name"])
                    # Check if task_date is a datetime object and convert to date if needed
                    if hasattr(task_date, 'date'):
                        task_dates.append(task_date.date())
                    else:
                        # It's already a date object
                        task_dates.append(task_date)
                    task_statuses.append(item["Status"])
            
            if task_activities:
                # Create scatter plot
                plt.figure(figsize=(12, 8))
                
                # Define status colors
                status_colors = {
                    "COMPLETED": "green",
                    "WIP": "orange",
                    "PENDING": "red",
                    "YET TO START": "blue"
                }
                
                # Get unique activities to use as y-axis
                unique_activities = list(set(task_activities))
                activity_indices = {act: i for i, act in enumerate(unique_activities)}
                
                # Create y-positions based on activity
                y_positions = [activity_indices[act] for act in task_activities]
                
                # Create scatter plot with different colors for status
                for status in set(task_statuses):
                    indices = [i for i, s in enumerate(task_statuses) if s == status]
                    plt.scatter(
                        [task_dates[i] for i in indices],
                        [y_positions[i] for i in indices],
                        color=status_colors.get(status, "gray"),
                        label=status,
                        s=100,
                        alpha=0.7,
                        edgecolors='black'
                    )
                
                plt.yticks(range(len(unique_activities)), unique_activities)
                plt.xlabel('Completion Date', fontsize=12)
                plt.ylabel('Activities', fontsize=12)
                plt.title('Task Completion Timeline', fontsize=14, fontweight='bold')
                plt.legend(title="Task Status")
                plt.grid(True, linestyle='--', alpha=0.3)
                plt.tight_layout()
                
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                elements.append(Spacer(1, 30))
                elements.append(Paragraph("Task Timeline Distribution", styles['Heading2']))
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=500, height=300))
                chart_files.append(tmp.name)

        # 5. Add Performance Summary Table
        elements.append(Spacer(1, 30))
        elements.append(Paragraph("Performance Summary", styles['Heading2']))
        elements.append(Spacer(1, 12))
        
        # Count tasks by status
        status_summary = {
            "Total Tasks": len(task_data),
            "Completed Tasks": sum(1 for item in task_data if item["Status"] == "COMPLETED"),
            "Tasks in Progress": sum(1 for item in task_data if item["Status"] == "WIP"),
            "Pending Tasks": sum(1 for item in task_data if item["Status"] == "PENDING"),
            "Yet to Start": sum(1 for item in task_data if item["Status"] == "YET TO START")
        }
        
        # Create summary table
        summary_data = [["Performance Metrics", "Value"]]
        for metric, value in status_summary.items():
            summary_data.append([metric, str(value)])
        
        summary_table = Table(summary_data, colWidths=[200, 100])
        summary_style = TableStyle([
            ('BACKGROUND', (0, 0), (1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (1, -1), 12),
            ('BACKGROUND', (0, 1), (0, -1), colors.lightgrey),
            ('GRID', (0, 0), (1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (1, -1), 'MIDDLE'),
        ])
        summary_table.setStyle(summary_style)
        elements.append(summary_table)

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
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

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
        title_style = styles['Heading1']
        title_style.alignment = 1  # Center alignment
        title = Paragraph(f"Client Report: {customer.customer_name}", title_style)
        elements.append(title)
        elements.append(Spacer(1, 20))
        
        # Add date and client details
        date_style = styles['Normal']
        date_style.alignment = 1  # Center alignment
        date_text = Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d')}", date_style)
        elements.append(date_text)
        elements.append(Spacer(1, 20))
        
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
            file_name = f"{current_date}_{customer.customer_name.replace(' ', '_')}_Report.pdf"
            
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
            
            # Determine performance status for completed tasks
            if task.status == 'completed':
                if time_taken == std_time:
                    performance = "ON-TIME"
                elif time_taken < std_time:
                    performance = "EARLY"
                else:
                    performance = "DELAY"
            else:
                performance = "N/A"
                
            task_data.append({
                "Task ID": task.task_id,
                "Activity Name": activity_name,
                "Auditor Name": actor_name,
                "Due Date": task.duedate.strftime('%Y-%m-%d') if hasattr(task, 'duedate') and task.duedate else "N/A",
                "Completion Date": task.actual_date.strftime('%Y-%m-%d') if hasattr(task, 'actual_date') and task.actual_date else "Not Completed",
                "Status": task.status.upper() if task.status else "PENDING",
                "Time Taken": time_taken if task.status == 'completed' else "N/A",
                "Standard Time": std_time,
                "Performance": performance
            })
        
        # Create a paragraph for task summary
        tasks_summary = Paragraph(f"Tasks Summary ({len(task_data)} tasks total)", styles['Heading2'])
        elements.append(tasks_summary)
        elements.append(Spacer(1, 12))
        
        # Get headers for the table
        headers = ["Task ID", "Activity Name", "Auditor Name", "Due Date", "Status", "Time Taken", "Standard Time", "Performance"]
        table_data = [headers]  # First row is headers
        
        # Add data rows
        for item in task_data:
            row = []
            for header in headers:
                value = item.get(header, "N/A")
                if isinstance(value, (int, float)) and header in ["Time Taken", "Standard Time"]:
                    value = f"{value:.1f}"
                row.append(str(value))
            table_data.append(row)
        
        # Create the table with better styling
        col_widths = [100, 150, 70, 85, 80, 85, 70, 70]  # Significantly increased Task ID column width
        table = Table(table_data, colWidths=col_widths)
        
        # Add style
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4)
        ])
        
        # Add row colors based on status from the database values
        for i, row in enumerate(task_data):
            if i < len(table_data) - 1:  # Skip header row
                status = row["Status"]
                performance = row["Performance"]
                if status == "COMPLETED":
                    if performance == "EARLY":
                        style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.lightgreen)
                    elif performance == "DELAY":
                        style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.lightcoral)
                    else:  # ON-TIME
                        style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.lightblue)
                elif status == "WIP":
                    style.add('BACKGROUND', (0, i+1), (-1, i+1), colors.lightyellow)
                elif status == "PENDING":
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
            
            if status_counts:  # Only create chart if there's data
                # Create pie chart with improved styling
                plt.figure(figsize=(8, 8))
                
                # Define better colors for different statuses
                status_colors = {
                    "COMPLETED": '#3498db',    # Blue
                    "WIP": '#2ecc71',          # Green
                    "PENDING": '#f1c40f',      # Yellow
                    "YET TO START": '#e74c3c'  # Red
                }
                
                # Prepare data for pie chart
                labels = list(status_counts.keys())
                sizes = list(status_counts.values())
                colors_list = [status_colors.get(status, '#95a5a6') for status in labels]
                
                # Format the labels with counts
                formatted_labels = [f"{label}\n({count})" for label, count in zip(labels, sizes)]
                
                # Create the pie chart with clean styling
                plt.pie(sizes, 
                        labels=None,  # No labels inside the pie
                        colors=colors_list, 
                        autopct='%1.1f%%', 
                        startangle=90, 
                        shadow=False,  # Remove shadow
                        wedgeprops={'edgecolor': 'white', 'linewidth': 1},
                        textprops={'fontsize': 10, 'color': 'black', 'weight': 'bold'})
                
                # Add a legend outside the pie chart
                plt.legend(formatted_labels, 
                          loc="center right", 
                          bbox_to_anchor=(1.1, 0.5),
                          frameon=False)
                
                plt.axis('equal')
                plt.title('Task Status Distribution', fontsize=14, fontweight='bold', pad=15)
                plt.tight_layout()
                
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                # Add chart to PDF
                elements.append(Spacer(1, 30))
                elements.append(Paragraph("Task Status Distribution", styles['Heading2']))
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=350, height=350))
                chart_files.append(tmp.name)
        
        # 2. Task Completion Timeline
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Collect completion dates
            completion_dates = []
            activities = []
            
            for item in task_data:
                if item["Status"] == "COMPLETED":
                    task_date = db.session.query(Task).filter_by(
                        task_id=item["Task ID"]
                    ).first().actual_date
                    
                    if task_date:
                        # Check if task_date is already a date object or a datetime object
                        if hasattr(task_date, 'date'):
                            completion_dates.append(task_date.date())
                        else:
                            # It's already a date object
                            completion_dates.append(task_date)
                        activities.append(item["Activity Name"])
            
            if completion_dates:
                # Count tasks per date
                from collections import Counter
                date_counts = Counter(completion_dates)
                dates = sorted(date_counts.keys())
                counts = [date_counts[date] for date in dates]
                
                plt.figure(figsize=(12, 6))
                plt.bar(dates, counts, color='#3498db', width=0.7, alpha=0.7)
                plt.xlabel('Date', fontsize=12)
                plt.ylabel('Number of Tasks', fontsize=12)
                plt.title('Task Completion Timeline', fontsize=14, fontweight='bold')
                plt.xticks(rotation=45)
                plt.grid(True, axis='y', linestyle='--', alpha=0.7)
                plt.tight_layout()
                
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                elements.append(Spacer(1, 30))
                elements.append(Paragraph("Task Completion Timeline", styles['Heading2']))
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=500, height=300))
                chart_files.append(tmp.name)
        
        # 3. Task Timeline Scatter Plot
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Get all tasks with their status and activity
            task_activities = []
            task_dates = []
            task_statuses = []
            
            for idx, item in enumerate(task_data):
                task_date = None
                task_query = db.session.query(Task).filter_by(task_id=item["Task ID"]).first()
                
                # Get the date (either completion date or due date)
                if item["Status"] == "COMPLETED" and hasattr(task_query, 'actual_date') and task_query.actual_date:
                    task_date = task_query.actual_date
                elif hasattr(task_query, 'duedate') and task_query.duedate:
                    task_date = task_query.duedate
                
                if task_date:
                    task_activities.append(item["Activity Name"])
                    # Check if task_date is a datetime object and convert to date if needed
                    if hasattr(task_date, 'date'):
                        task_dates.append(task_date.date())
                    else:
                        # It's already a date object
                        task_dates.append(task_date)
                    task_statuses.append(item["Status"])
            
            if task_activities:
                # Create scatter plot
                plt.figure(figsize=(12, 8))
                
                # Define status colors
                status_colors = {
                    "COMPLETED": "green",
                    "WIP": "orange",
                    "PENDING": "red",
                    "YET TO START": "blue"
                }
                
                # Get unique activities to use as y-axis
                unique_activities = list(set(task_activities))
                activity_indices = {act: i for i, act in enumerate(unique_activities)}
                
                # Create y-positions based on activity
                y_positions = [activity_indices[act] for act in task_activities]
                
                # Create scatter plot with different colors for status
                for status in set(task_statuses):
                    indices = [i for i, s in enumerate(task_statuses) if s == status]
                    plt.scatter(
                        [task_dates[i] for i in indices],
                        [y_positions[i] for i in indices],
                        color=status_colors.get(status, "gray"),
                        label=status,
                        s=100,
                        alpha=0.7,
                        edgecolors='black'
                    )
                
                plt.yticks(range(len(unique_activities)), unique_activities)
                plt.xlabel('Completion Date', fontsize=12)
                plt.ylabel('Activities', fontsize=12)
                plt.title('Task Completion Timeline', fontsize=14, fontweight='bold')
                plt.legend(title="Task Status")
                plt.grid(True, linestyle='--', alpha=0.3)
                plt.tight_layout()
                
                plt.savefig(tmp.name, format='png', dpi=300, bbox_inches='tight')
                plt.close()
                
                elements.append(Spacer(1, 30))
                elements.append(Paragraph("Task Timeline Distribution", styles['Heading2']))
                elements.append(Spacer(1, 12))
                elements.append(Image(tmp.name, width=500, height=300))
                chart_files.append(tmp.name)
        
        # 4. Add Performance Summary Table
        elements.append(Spacer(1, 30))
        elements.append(Paragraph("Performance Summary", styles['Heading2']))
        elements.append(Spacer(1, 12))
        
        # Count tasks by status
        status_summary = {
            "Total Tasks": len(task_data),
            "Completed Tasks": sum(1 for item in task_data if item["Status"] == "COMPLETED"),
            "Tasks in Progress": sum(1 for item in task_data if item["Status"] == "WIP"),
            "Pending Tasks": sum(1 for item in task_data if item["Status"] == "PENDING"),
            "Yet to Start": sum(1 for item in task_data if item["Status"] == "YET TO START")
        }
        
        # Create summary table
        summary_data = [["Performance Metrics", "Value"]]
        for metric, value in status_summary.items():
            summary_data.append([metric, str(value)])
        
        summary_table = Table(summary_data, colWidths=[200, 100])
        summary_style = TableStyle([
            ('BACKGROUND', (0, 0), (1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (1, -1), 12),
            ('BACKGROUND', (0, 1), (0, -1), colors.lightgrey),
            ('GRID', (0, 0), (1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (1, -1), 'MIDDLE'),
        ])
        summary_table.setStyle(summary_style)
        elements.append(summary_table)
        
        # Build the PDF
        doc.build(elements)
        
        # Clean up temporary files
        for file_path in chart_files:
            if os.path.exists(file_path):
                os.unlink(file_path)
        
        # Return the PDF
        buffer.seek(0)
        current_date = datetime.now().strftime("%Y-%m-%d")
        file_name = f"{current_date}_{customer.customer_name.replace(' ', '_')}_Report.pdf"
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=file_name,
            mimetype="application/pdf"
        )
    except Exception as e:
        print(f"Error generating client report PDF: {str(e)}")
        traceback.print_exc()
        
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
