import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './Activities.css';
import AssignActivity from './AssignActivity';
import { API_ENDPOINTS } from '../config/api';
import AssignActivityForm from './AssignActivityForm';

const Activities = () => {
    const [activities, setActivities] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingActivity, setEditingActivity] = useState(null);
    const [formData, setFormData] = useState({
        activity_name: "",
        standard_time: "",
        act_des: "",
        criticality: "Low",
        duration: "",
        role_id: "",
        frequency: "0",
        due_by: "",
        activity_type: "R",
        group_id: "",
        status: "A"
    });
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assignActivity, setAssignActivity] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    
    // Activity mapping state
    const [showActivityMapping, setShowActivityMapping] = useState(false);
    const [activityMappings, setActivityMappings] = useState([]);
    const [mappingLoading, setMappingLoading] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [assigningActivityId, setAssigningActivityId] = useState(null);
    const [assignSuccess, setAssignSuccess] = useState(null);
    const [selectedActivity, setSelectedActivity] = useState(null);

    // Add this to your state
    const [showAssignForm, setShowAssignForm] = useState(false);
    const [assigningCustomer, setAssigningCustomer] = useState(null);

    // Add new states for report modal
    const [showReportModal, setShowReportModal] = useState(false);
    const [selectedActivityReport, setSelectedActivityReport] = useState(null);
    const [reportData, setReportData] = useState([]);
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [standardTime, setStandardTime] = useState(null);

    useEffect(() => {
        fetchActivities();
        fetchGroups();
        fetchEmployees();
    }, []);

    const fetchActivities = async () => {
        setLoading(true);
        try {
            const response = await axios.get(API_ENDPOINTS.ACTIVITIES);
            setActivities(response.data);
        } catch (error) {
            console.error('Error fetching activities:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchGroups = async () => {
        try {
            const response = await axios.get('/groups');
            setGroups(response.data);
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    };
    
    const fetchEmployees = async () => {
        try {
            const response = await axios.get('/actors');
            setEmployees(response.data);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };
    
    const fetchActivityMappings = async (activityId) => {
        setMappingLoading(true);
        try {
            const response = await axios.get(`/activity_mappings/${activityId}`);
            setActivityMappings(response.data);
        } catch (error) {
            console.error('Error fetching activity mappings:', error);
            setActivityMappings([]);
        } finally {
            setMappingLoading(false);
        }
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingActivity) {
                await axios.put(API_ENDPOINTS.UPDATE_ACTIVITY, formData);
            } else {
                await axios.post(API_ENDPOINTS.ADD_ACTIVITY, formData);
            }
            fetchActivities();
            setShowForm(false);
            setEditingActivity(null);
            setFormData({
                activity_name: "",
                standard_time: "",
                act_des: "",
                criticality: "Low",
                duration: "",
                role_id: "",
                frequency: "0",
                due_by: "",
                activity_type: "R",
                group_id: "",
                status: "A"
            });
        } catch (error) {
            console.error('Error saving activity:', error);
        }
    };

    const handleEdit = (activity) => {
        setEditingActivity(activity);
        setFormData({
            activity_name: activity.activity_name,
            standard_time: activity.standard_time,
            act_des: activity.act_des,
            criticality: activity.criticality,
            duration: activity.duration,
            role_id: activity.role_id,
            frequency: activity.frequency,
            due_by: activity.due_by,
            activity_type: activity.activity_type,
            group_id: activity.group_id,
            status: activity.status
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this activity?')) {
            try {
                await axios.delete(API_ENDPOINTS.DELETE_ACTIVITY(id));
                fetchActivities();
            } catch (error) {
                console.error('Error deleting activity:', error);
            }
        }
    };

    const handleAssign = (activity) => {
        setAssignActivity(activity);
    };
    
    const handleAssignEmployee = (customerId, customerName) => {
        setAssigningCustomer({
            id: customerId,
            name: customerName
        });
        setShowAssignForm(true);
    };

    const handleAssignSuccess = (response) => {
        // Show success message with email notification status
        const emailStatus = response.email_sent 
            ? 'Email notification sent!' 
            : 'Assignment successful, but email notification failed.';
        
        const calendarStatus = response.calendar_added
            ? 'Added to Google Calendar.' 
            : '';
            
        const reminderStatus = response.reminders_scheduled
            ? 'Reminders scheduled.' 
            : '';
            
        setAssignSuccess({
            type: 'success',
            message: `Activity assigned successfully! ${emailStatus} ${calendarStatus} ${reminderStatus}`
        });
        
        // Refresh the mappings
        fetchActivityMappings(assigningActivityId);
        
        // Close the form
        setShowAssignForm(false);
        
        // Clear the success message after 5 seconds
        setTimeout(() => {
            setAssignSuccess(null);
        }, 5000);
    };

    const closeAssignModal = () => {
        setAssignActivity(null);
    };
    
    const closeActivityMapping = () => {
        setShowActivityMapping(false);
        setActivityMappings([]);
        setAssigningActivityId(null);
        setAssignSuccess(null);
        setSelectedActivity(null);
    };

    const filteredActivities = activities.filter(activity => {
        return !searchTerm || 
            (activity.activity_name && activity.activity_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (activity.act_des && activity.act_des.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (activity.criticality && activity.criticality.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (activity.duration && activity.duration.toString().includes(searchTerm)) ||
            (activity.due_by && activity.due_by.includes(searchTerm));
    });

    const getGroupName = (groupId) => {
        const group = groups.find(g => g.id === groupId);
        return group ? group.group_name : 'Unknown Group';
    };
    
    const getEmployeeName = (employeeId) => {
        const employee = employees.find(emp => emp.actor_id === employeeId);
        return employee ? employee.actor_name : `Employee ID: ${employeeId}`;
    };

    // Handle status button click - directly open the mapping screen
    const handleStatusClick = (event, activity) => {
        setSelectedActivity(activity);
        setAssigningActivityId(activity.activity_id);
        fetchActivityMappings(activity.activity_id);
        setShowActivityMapping(true);
    };

    // Add new function to fetch report data
    const fetchActivityReport = async (activityId) => {
        try {
            const response = await axios.get(`/get_activity_data?activity_id=${activityId}`);
            setReportData(response.data.tasks);
            setStandardTime(response.data.standard_time);
        } catch (error) {
            console.error('Error fetching report data:', error);
        }
    };

    // Add function to handle report button click
    const handleReportClick = (activity) => {
        setSelectedActivityReport(activity);
        fetchActivityReport(activity.activity_id);
        setShowReportModal(true);
    };

    // Add function to handle pie chart segment click
    const handlePieSegmentClick = (status) => {
        setSelectedStatus(status === selectedStatus ? null : status);
    };

    // Add function to download report
    const handleDownloadReport = async (activityId) => {
        try {
            const response = await axios.get(`/generate_activity_report?activity_id=${activityId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `activity_report_${activityId}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error downloading report:', error);
        }
    };

    return (
        <div className="activities-container">
            <div className="page-header">
                <h1><i className="fas fa-clipboard-list"></i> Activity Management</h1>
                <p>Create, update, and assign activities to your team members</p>
            </div>

            <div className="controls-container">
                <div className="search-filter-container">
                    <div className="search-box">
                        <i className="fas fa-search"></i>
                        <input
                            type="text"
                            placeholder="Search activities..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    
                    <div className="view-toggle">
                        <button 
                            className={viewMode === 'grid' ? 'active' : ''} 
                            onClick={() => setViewMode('grid')}
                        >
                            <i className="fas fa-th-large"></i>
                        </button>
                        <button 
                            className={viewMode === 'list' ? 'active' : ''} 
                            onClick={() => setViewMode('list')}
                        >
                            <i className="fas fa-list"></i>
                        </button>
                    </div>
                </div>
                
                <button className="add-button" onClick={() => {
                    setEditingActivity(null);
                    setFormData({
                        activity_name: "",
                        standard_time: "",
                        act_des: "",
                        criticality: "Low",
                        duration: "",
                        role_id: "",
                        frequency: "0",
                        due_by: "",
                        activity_type: "R",
                        group_id: "",
                        status: "A"
                    });
                    setShowForm(true);
                }}>
                    <i className="fas fa-plus"></i> Add Activity
                </button>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading activities...</p>
                </div>
            ) : filteredActivities.length > 0 ? (
                <div className={viewMode === 'grid' ? 'activity-grid' : 'activity-list'}>
                    {filteredActivities.map(activity => (
                        <div 
                            key={activity.activity_id} 
                            className="activity-card"
                            data-priority={activity.criticality || "Low"}
                        >
                            <div className="activity-card-header">
                                <div className="activity-icon">
                                    <i className="fas fa-clipboard-check"></i>
                                </div>
                                <button 
                                    className="report-btn"
                                    onClick={() => handleReportClick(activity)}
                                    title="View Activity Performance Report"
                                >
                                    <i className="fas fa-chart-pie"></i>
                                </button>
                            </div>
                            
                            <div className="activity-card-body">
                                <h3>{activity.activity_name}</h3>
                                <p className="activity-description">{activity.act_des || 'No description provided'}</p>
                                <div className="activity-details">
                                    <div className="detail-item">
                                        <i className="fas fa-users"></i>
                                        <span>{getGroupName(activity.group_id)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <i className="fas fa-clock"></i>
                                        <span>Duration: {activity.duration || 'N/A'}</span>
                                    </div>
                                    <div className="detail-item">
                                        <i className="fas fa-exclamation-circle"></i>
                                        <span>Priority: {activity.criticality || 'Low'}</span>
                                    </div>
                                    <div className="detail-item">
                                        <i className="fas fa-calendar-alt"></i>
                                        <span>Due by: {activity.due_by || 'Not set'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="activity-card-actions">
                                <button 
                                    className="status-btn" 
                                    onClick={(event) => handleStatusClick(event, activity)}
                                >
                                    <i className="fas fa-users"></i> Mapping
                                </button>
                                <button 
                                    className="download-btn"
                                    onClick={() => handleDownloadReport(activity.activity_id)}
                                    title="Download Activity Performance Report"
                                >
                                    <i className="fas fa-download"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <i className="fas fa-clipboard"></i>
                    <h3>No activities found</h3>
                    <p>Create your first activity to get started</p>
                    <button 
                        className="add-button" 
                        onClick={() => {
                            setFormData({
                                activity_name: "",
                                standard_time: "",
                                act_des: "",
                                criticality: "Low",
                                duration: "",
                                role_id: "",
                                frequency: "0",
                                due_by: "",
                                activity_type: "R",
                                group_id: "",
                                status: "A"
                            });
                            setShowForm(true);
                        }}
                    >
                        <i className="fas fa-plus"></i> Create Activity
                    </button>
                </div>
            )}

            {showForm && (
                <div className="modal-overlay">
                    <div className="activity-form-modal">
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-clipboard-check"></i>
                                {editingActivity ? 'Edit Activity' : 'Add New Activity'}
                            </h2>
                            <button className="close-btn" onClick={() => setShowForm(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Activity Name:</label>
                                <input
                                    type="text"
                                    name="activity_name"
                                    value={formData.activity_name}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Standard Time:</label>
                                <input
                                    type="number"
                                    name="standard_time"
                                    value={formData.standard_time}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Activity Description:</label>
                                <textarea
                                    name="act_des"
                                    value={formData.act_des}
                                    onChange={handleInputChange}
                                    rows="4"
                                ></textarea>
                            </div>
                            <div className="form-group">
                                <label>Criticality:</label>
                                <select
                                    name="criticality"
                                    value={formData.criticality}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Duration:</label>
                                <input
                                    type="number"
                                    name="duration"
                                    value={formData.duration}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Role ID:</label>
                                <input
                                    type="number"
                                    name="role_id"
                                    value={formData.role_id}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Frequency:</label>
                                <select
                                    name="frequency"
                                    value={formData.frequency}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="0">Onetime</option>
                                    <option value="1">Yearly</option>
                                    <option value="12">Monthly</option>
                                    <option value="4">Quarterly</option>
                                    <option value="26">Fortnightly</option>
                                    <option value="52">Weekly</option>
                                    <option value="365">Daily</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Due By:</label>
                                <input
                                    type="date"
                                    name="due_by"
                                    value={formData.due_by}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Activity Type:</label>
                                <select
                                    name="activity_type"
                                    value={formData.activity_type}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="R">Regulatory</option>
                                    <option value="I">Internal</option>
                                    <option value="C">Customer</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Group:</label>
                                <select
                                    name="group_id"
                                    value={formData.group_id}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">Select a group</option>
                                    {groups.map(group => (
                                        <option key={group.id} value={group.id}>
                                            {group.group_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Status:</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                >
                                    <option value="A">Active</option>
                                    <option value="I">Inactive</option>
                                </select>
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="btn-save">
                                    <i className="fas fa-save"></i> Save
                                </button>
                                <button 
                                    type="button" 
                                    className="btn-cancel" 
                                    onClick={() => setShowForm(false)}
                                >
                                    <i className="fas fa-times"></i> Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {assignActivity && (
                <AssignActivity 
                    activity={assignActivity} 
                    onClose={closeAssignModal} 
                />
            )}
            
            {/* Activity Mapping Modal */}
            {showActivityMapping && (
                <div className="modal-overlay">
                    <div className="activity-mapping-modal">
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-project-diagram"></i>
                                Activity Mapping
                                {selectedActivity && <span> - {selectedActivity.activity_name}</span>}
                            </h2>
                            <button className="close-btn" onClick={closeActivityMapping}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        
                        {assignSuccess && (
                            <div className={`notification-message ${assignSuccess.type}`}>
                                <i className={`fas ${assignSuccess.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                                <span>{assignSuccess.message}</span>
                            </div>
                        )}
                        
                        <div className="mapping-content">
                            {mappingLoading ? (
                                <div className="loading-container">
                                    <div className="spinner"></div>
                                    <p>Loading mappings...</p>
                                </div>
                            ) : (
                                <table className="mapping-table">
                                    <thead>
                                        <tr>
                                            <th>CUSTOMER NAME</th>
                                            <th>ASSIGNED EMPLOYEE</th>
                                            <th>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activityMappings.length > 0 ? (
                                            activityMappings.map(mapping => (
                                                <tr key={mapping.id}>
                                                    <td>{mapping.customer_name}</td>
                                                    <td>
                                                        {mapping.assigned_employee ? 
                                                            getEmployeeName(mapping.assigned_employee) : 
                                                            'Not Assigned'}
                                                    </td>
                                                    <td>
                                                        {!mapping.assigned_employee ? (
                                                            <button 
                                                                className="assign-btn"
                                                                onClick={() => handleAssignEmployee(mapping.customer_id, mapping.customer_name)}
                                                            >
                                                                Assign
                                                            </button>
                                                        ) : (
                                                            <span className="assigned-label">Assigned</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="3" className="no-data">
                                                    No mappings found for this activity
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={closeActivityMapping}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAssignForm && (
                <AssignActivityForm
                    customerId={assigningCustomer.id}
                    customerName={assigningCustomer.name}
                    activityId={assigningActivityId}
                    activityName={selectedActivity?.activity_name || ''}
                    onClose={() => setShowAssignForm(false)}
                    onSuccess={handleAssignSuccess}
                />
            )}

            {/* Add Report Modal */}
            {showReportModal && (
                <div className="modal-overlay">
                    <div className="report-modal">
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-chart-pie"></i>
                                Activity Report
                                {selectedActivityReport && 
                                    <span> - {selectedActivityReport.activity_name}</span>
                                }
                            </h2>
                            <div className="standard-time">
                                Standard Time: {standardTime} hours
                            </div>
                            <button 
                                className="close-btn" 
                                onClick={() => setShowReportModal(false)}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <div className="report-content">
                            <div className="report-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Employee ID</th>
                                            <th>Name</th>
                                            <th>Task ID</th>
                                            <th>Time Taken</th>
                                            <th>Date of Completion</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.map(task => {
                                            const status = 
                                                task.time_taken === standardTime ? 'ON-TIME' :
                                                task.time_taken < standardTime ? 'EARLY' : 'DELAY';
                                            
                                            return (
                                                <tr 
                                                    key={task.task_id}
                                                    className={selectedStatus === status ? 'highlighted' : ''}
                                                >
                                                    <td>{task.employee_id}</td>
                                                    <td>{task.name}</td>
                                                    <td>{task.task_id}</td>
                                                    <td>{task.time_taken}</td>
                                                    <td>{task.completion_date}</td>
                                                    <td className={`status-${status.toLowerCase()}`}>
                                                        {status}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="report-chart">
                                <PieChart
                                    data={[
                                        {
                                            title: 'ON-TIME',
                                            value: reportData.filter(t => t.time_taken === standardTime).length,
                                            color: '#2ecc71'
                                        },
                                        {
                                            title: 'EARLY',
                                            value: reportData.filter(t => t.time_taken < standardTime).length,
                                            color: '#3498db'
                                        },
                                        {
                                            title: 'DELAY',
                                            value: reportData.filter(t => t.time_taken > standardTime).length,
                                            color: '#e74c3c'
                                        }
                                    ]}
                                    onSegmentClick={handlePieSegmentClick}
                                    selectedSegment={selectedStatus}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Add PieChart component
const PieChart = ({ data, onSegmentClick, selectedSegment }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = 0;

    return (
        <div className="pie-chart-container">
            <svg viewBox="0 0 100 100">
                {data.map((item, index) => {
                    if (item.value === 0) return null;
                    
                    const angle = (item.value / total) * 360;
                    const startAngle = currentAngle;
                    currentAngle += angle;
                    
                    const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                    const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                    const x2 = 50 + 40 * Math.cos(((startAngle + angle) * Math.PI) / 180);
                    const y2 = 50 + 40 * Math.sin(((startAngle + angle) * Math.PI) / 180);
                    
                    const largeArcFlag = angle > 180 ? 1 : 0;
                    
                    return (
                        <path
                            key={item.title}
                            d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                            fill={item.color}
                            stroke="white"
                            strokeWidth="1"
                            className={selectedSegment === item.title ? 'selected' : ''}
                            onClick={() => onSegmentClick(item.title)}
                        />
                    );
                })}
            </svg>
            <div className="pie-chart-legend">
                {data.map(item => (
                    <div 
                        key={item.title} 
                        className={`legend-item ${selectedSegment === item.title ? 'selected' : ''}`}
                        onClick={() => onSegmentClick(item.title)}
                    >
                        <span className="color-box" style={{ backgroundColor: item.color }}></span>
                        <span className="label">{item.title} ({item.value})</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Activities;