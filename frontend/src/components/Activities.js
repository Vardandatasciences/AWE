import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useWorkflow } from '../context/WorkflowContext';
import { showWorkflowGuide } from '../App';
import './Activities.css';
import AssignActivity from './AssignActivity';
import { API_ENDPOINTS } from '../config/api';
import AssignActivityForm from './AssignActivityForm';
import { toast } from 'react-hot-toast';

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
        // group_id: "",
        status: "A"
    });
    // const [groups, setGroups] = useState([]);
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

    const [stats, setStats] = useState({
        total: 0,
        regulatory: 0,
        internal: 0,
        customer: 0,
        active: 0,
        inactive: 0
    });

    const { completeStep, workflowSteps } = useWorkflow();
    
    // Check if we're in the workflow process - now check for step 3 (employee assignment)
    const isInWorkflow = workflowSteps.some(step => 
        (step.status === 'in-progress' && step.id === 2) || 
        (step.status === 'in-progress' && step.id === 3)
    );
    
    // Specifically check if we're in step 3 (employee assignment)
    const isInEmployeeAssignmentStep = workflowSteps.some(step => 
        step.status === 'in-progress' && step.id === 3
    );

    // Add these state variables in your component
    const [currentPage, setCurrentPage] = useState(1);
    const [activitiesPerPage] = useState(12);
    const [totalPages, setTotalPages] = useState(1);

    // Add new state for subtasks
    const [subtasks, setSubtasks] = useState([]);
    const [subtaskCounter, setSubtaskCounter] = useState(1);

    // Add a new state for the subtask workflow popup
    const [showSubtaskWorkflow, setShowSubtaskWorkflow] = useState(false);
    const [selectedSubtasks, setSelectedSubtasks] = useState([]);

    // Add state for selectedEmployee
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [assignmentRemarks, setAssignmentRemarks] = useState('');
    const [assignmentLink, setAssignmentLink] = useState('');
    const [frequency, setFrequency] = useState('1');
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        // Ensure activityMappings is always an array
        setActivityMappings([]);
        fetchActivities();
        // fetchGroups();
        fetchEmployees();
    }, []);

    useEffect(() => {
        if (activities) {
            setTotalPages(Math.ceil(activities.length / activitiesPerPage));
        }
    }, [activities, activitiesPerPage]);

    const fetchActivities = async () => {
        setLoading(true);
        try {
            const response = await axios.get(API_ENDPOINTS.ACTIVITIES);
            setActivities(response.data);

            // Calculate stats
            const total = response.data.length;
            const regulatory = response.data.filter(activity => activity.activity_type === 'R').length;
            const internal = response.data.filter(activity => activity.activity_type === 'I').length;
            const customer = response.data.filter(activity => activity.activity_type === 'C').length;
            const active = response.data.filter(activity => activity.status === 'A').length;
            const inactive = response.data.filter(activity => activity.status === 'I').length;

            setStats({
                total,
                regulatory,
                internal,
                customer,
                active,
                inactive
            });
        } catch (error) {
            console.error('Error fetching activities:', error);
        } finally {
            setLoading(false);
        }
    };

    // const fetchGroups = async () => {
    //     try {
    //         const response = await axios.get('/groups');
    //         setGroups(response.data);
    //     } catch (error) {
    //         console.error('Error fetching groups:', error);
    //     }
    // };
    
    const fetchEmployees = async () => {
        try {
            // Use the full URL with protocol and host
            const response = await axios.get('http://127.0.0.1:5000/actors');
            setEmployees(response.data);
        } catch (error) {
            console.error('Error fetching employees:', error);
            setEmployees([]);
        }
    };
    
    const fetchActivityMappings = async (activityId) => {
        setMappingLoading(true);
        try {
            // Make sure the URL is correct and includes proper protocol/host
            const response = await axios.get(`http://127.0.0.1:5000/activity_mappings/${activityId}`);
            
            console.log("Activity mappings response:", response);
            
            // Ensure response.data is an array
            if (Array.isArray(response.data)) {
                setActivityMappings(response.data);
            } else {
                console.error('Expected array but received:', response.data);
                setActivityMappings([]); // Set empty array as fallback
            }
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

    // Add function to handle subtask input change
    const handleSubtaskChange = (index, field, value) => {
        const updatedSubtasks = [...subtasks];
        updatedSubtasks[index][field] = value;
        setSubtasks(updatedSubtasks);
        
        // Calculate total time
        calculateTotalTime(updatedSubtasks);
    };

    // Function to calculate total standard time from subtasks
    const calculateTotalTime = (updatedSubtasks) => {
        const totalTime = updatedSubtasks.reduce((sum, subtask) => {
            return sum + (parseFloat(subtask.time) || 0);
        }, 0);
        
        // Update the form data with calculated total time
        setFormData(prev => ({
            ...prev,
            standard_time: totalTime.toString()
        }));
    };

    // Add function to add new subtask
    const addSubtask = () => {
        setSubtasks([...subtasks, { 
            id: subtaskCounter,
            name: '', 
            description: '', 
            time: '0' 
        }]);
        setSubtaskCounter(prev => prev + 1);
    };

    // Add function to remove subtask
    const removeSubtask = (index) => {
        const updatedSubtasks = subtasks.filter((_, i) => i !== index);
        setSubtasks(updatedSubtasks);
        calculateTotalTime(updatedSubtasks);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Include subtasks in the data sent to the server, but use "sub_activities" as the key
            const dataToSubmit = {
                ...formData,
                sub_activities: subtasks.length > 0 ? subtasks : null
            };
            
            let response;
            if (editingActivity) {
                // Make sure to use full URL to backend
                response = await axios.put(`${API_ENDPOINTS.BASE_URL}/update_activity`, dataToSubmit);
                if (response.data.activity) {
                    // Update the activity in the local state
                    setActivities(activities.map(activity => 
                        activity.activity_id === response.data.activity.activity_id 
                            ? response.data.activity 
                            : activity
                    ));
                }
            } else {
                // Make sure to use full URL to backend
                response = await axios.post(`${API_ENDPOINTS.BASE_URL}/add_activity`, dataToSubmit);
                // Refresh activities list after adding
                fetchActivities();
            }
            
            // Show success message
            alert(response.data.message);
            
            // Reset form and close modal
            setShowForm(false);
            setEditingActivity(null);
            resetFormData();
            
            // If we're in the workflow process, mark this step as completed
            if (isInWorkflow) {
                completeStep(2);
                setTimeout(() => {
                    showWorkflowGuide();
                }, 500);
            }
        } catch (error) {
            console.error('Error saving activity:', error);
            alert(error.response?.data?.error || 'Error saving activity');
        }
    };

    // Add function to reset form data including subtasks
    const resetFormData = () => {
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
            status: "A"
        });
        setSubtasks([]);
        setSubtaskCounter(1);
    };

    // Modify the edit function to handle subtasks
    const handleEdit = (activity) => {
        setEditingActivity(activity);
        setFormData({
            activity_id: activity.activity_id,
            activity_name: activity.activity_name,
            standard_time: activity.standard_time,
            act_des: activity.act_des || '',
            criticality: activity.criticality || 'Low',
            duration: activity.duration || '',
            role_id: activity.role_id || '',
            frequency: activity.frequency || '0',
            due_by: activity.due_by || '',
            activity_type: activity.activity_type || 'R',
            status: activity.status || 'A'
        });
        
        // If activity has subtasks, load them - use sub_activities as the field name
        if (activity.sub_activities && Array.isArray(activity.sub_activities)) {
            setSubtasks(activity.sub_activities);
            setSubtaskCounter(activity.sub_activities.length + 1);
        } else {
            setSubtasks([]);
            setSubtaskCounter(1);
        }
        
        setShowForm(true);
    };

    const handleDelete = async (activityId) => {
        if (!window.confirm('Are you sure you want to delete this activity?')) {
            return;
        }
        
        try {
            const response = await axios.delete(`/delete_activity/${activityId}`);
            
            if (response.data.status === 'success') {
                // Remove the activity from the local state
                setActivities(activities.filter(activity => activity.activity_id !== activityId));
                // Show success message
                alert('Activity deleted successfully');
            }
        } catch (error) {
            if (error.response && error.response.data) {
                // Show the specific error message from the backend
                alert(error.response.data.message || 'Failed to delete activity');
            } else {
                alert('An error occurred while deleting the activity');
            }
            console.error('Error deleting activity:', error);
        }
    };

    const handleAssign = (activity) => {
        setSelectedActivity(activity);
        setShowActivityMapping(true);
        fetchActivityMappings(activity.activity_id);
        setAssigningActivityId(activity.activity_id);
    };
    
    const handleAssignEmployee = (customerId, customerName) => {
        // Before creating FormData, check if employee is selected
        if (!selectedEmployee) {
            toast.error("Please select an employee first");
            return;
        }
        
        // Create form data with all necessary information
        const formData = new FormData();
        formData.append('task_name', selectedActivity.activity_id);
        formData.append('assigned_to', selectedEmployee);
        formData.append('customer_id', customerId);
        formData.append('customer_name', customerName);
        formData.append('actor_id', currentUser?.id || sessionStorage.getItem('userId'));
        formData.append('remarks', assignmentRemarks || '');
        formData.append('link', assignmentLink || '');
        formData.append('frequency', frequency || '1');
        
        // Add subtasks information
        if (selectedActivity.sub_activities) {
            formData.append('sub_tasks', JSON.stringify(selectedActivity.sub_activities));
        }
        
        // Send API request
        axios.post('/api/assign_activity', formData)
            .then(response => {
                handleAssignSuccess(response.data);
            })
            .catch(error => {
                console.error('Error assigning activity:', error);
                toast.error('Failed to assign activity');
            });
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
        
        // If we're in the employee assignment step of the workflow, mark it as completed
        if (isInEmployeeAssignmentStep) {
            completeStep(3);
            
            // Show the workflow guide again to show completion
            setTimeout(() => {
                showWorkflowGuide();
            }, 1000);
        }
        
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

    // const getGroupName = (groupId) => {
    //     const group = groups.find(g => g.id === groupId);
    //     return group ? group.group_name : 'Unknown Group';
    // };
    
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


const fetchActivityReport = async (activityId) => {
        try {
            const response = await axios.get(`/get_activity_data?activity_id=${activityId}`);
            setReportData(response.data.tasks);
            setStandardTime(response.data.standard_time);
        } catch (error) {
            console.error('Error fetching report data:', error);
        }
    };



    const handleAddActivity = async (activityData) => {
        try {
            const response = await axios.post('/add_activity', activityData);
            
            if (response.status === 201) {
                // Add the new activity to the list
                fetchActivities();
                
                // If we're in the workflow process, mark this step as completed
                if (isInWorkflow) {
                    completeStep(2);
                    
                    // Show the workflow guide again to guide to the next step
                    setTimeout(() => {
                        showWorkflowGuide();
                    }, 500);
                }
                
                setShowForm(false);
                // Show success message
            }
        } catch (err) {
            console.error('Error adding activity:', err);
            // Show error message
        }
    };

    useEffect(() => {
        // Set progress values for activity stats
        const regulatoryProgress = document.querySelector('.regulatory-stat .stat-progress');
        const internalProgress = document.querySelector('.internal-stat .stat-progress');
        const customerProgress = document.querySelector('.customer-stat .stat-progress');

        if (regulatoryProgress && stats.total > 0) {
            const percentage = Math.round((stats.regulatory / stats.total) * 100);
            
            // Set the CSS variable for the animation
            regulatoryProgress.style.setProperty('--progress', percentage);
            // Set the data attribute for the percentage text
            regulatoryProgress.setAttribute('data-percentage', percentage);
            
            // Force a repaint to ensure the transition works
            const circle = regulatoryProgress.querySelector('.regulatory-circle');
            if (circle) {
                setTimeout(() => {
                    circle.style.strokeDasharray = `${percentage}, 100`;
                }, 50);
            }
        }
        
        if (internalProgress && stats.total > 0) {
            const percentage = Math.round((stats.internal / stats.total) * 100);
            
            // Set the CSS variable for the animation
            internalProgress.style.setProperty('--progress', percentage);
            // Set the data attribute for the percentage text
            internalProgress.setAttribute('data-percentage', percentage);
            
            // Force a repaint to ensure the transition works
            const circle = internalProgress.querySelector('.internal-circle');
            if (circle) {
                setTimeout(() => {
                    circle.style.strokeDasharray = `${percentage}, 100`;
                }, 50);
            }
        }
        
        if (customerProgress && stats.total > 0) {
            const percentage = Math.round((stats.customer / stats.total) * 100);
            
            // Set the CSS variable for the animation
            customerProgress.style.setProperty('--progress', percentage);
            // Set the data attribute for the percentage text
            customerProgress.setAttribute('data-percentage', percentage);
            
            // Force a repaint to ensure the transition works
            const circle = customerProgress.querySelector('.customer-circle');
            if (circle) {
                setTimeout(() => {
                    circle.style.strokeDasharray = `${percentage}, 100`;
                }, 50);
            }
        }
    }, [stats]); // Run this effect when stats change

    // Function to handle report button click
    const handleReportClick = (activity) => {
        setSelectedActivityReport(activity);
        fetchActivityReport(activity.activity_id);
        setShowReportModal(true);
    };

    // Function to handle pie chart segment click
    const handlePieSegmentClick = (status) => {
        setSelectedStatus(status === selectedStatus ? null : status);
    };

    // Function to handle download report
    const handleDownloadReport = async (activityId) => {
        // Show loading indicator or message if needed
        
        // Call the correct endpoint that generates the PDF with table and pie chart
        const response = await axios.get(`/generate_activity_report?activity_id=${activityId}`, {
            responseType: 'blob' // Important: set responseType to 'blob'
        });
        
        // Create a blob URL from the response data
        const url = window.URL.createObjectURL(new Blob([response.data]));
        
        // Create a temporary link element to trigger the download
        const link = document.createElement('a');
        link.href = url;
        
        // Set the filename with current date
        const currentDate = new Date().toISOString().split('T')[0];
        link.setAttribute('download', `${currentDate}_Activity_${activityId}_Report.pdf`);
        
        // Append to body, click to download, then remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the blob URL
        window.URL.revokeObjectURL(url);
    };

    // Add this pagination logic function
    const getCurrentPageActivities = () => {
        const indexOfLastActivity = currentPage * activitiesPerPage;
        const indexOfFirstActivity = indexOfLastActivity - activitiesPerPage;
        return filteredActivities.slice(indexOfFirstActivity, indexOfLastActivity);
    };

    // Add these pagination handler functions
    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
    };

    const handlePrevPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
    };

    const handlePageClick = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    // Make sure the filteredActivities are used for pagination
    useEffect(() => {
        if (filteredActivities) {
            setTotalPages(Math.ceil(filteredActivities.length / activitiesPerPage));
        }
    }, [filteredActivities, activitiesPerPage]);

    // Add this pagination component
    const Pagination = () => {
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push(
                <button
                    key={i}
                    className={`pagination-button ${currentPage === i ? 'active' : ''}`}
                    onClick={() => handlePageClick(i)}
                >
                    {i}
                </button>
            );
        }

        return (
            <div className="pagination-container">
                <button
                    className="pagination-button"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                >
                    <i className="fas fa-chevron-left"></i> Previous
                </button>
                
                {totalPages <= 5 ? (
                    pages
                ) : (
                    <>
                        {currentPage > 2 && <button className="pagination-button">1</button>}
                        {currentPage > 3 && <span>...</span>}
                        {pages.slice(Math.max(0, currentPage - 2), Math.min(currentPage + 1, totalPages))}
                        {currentPage < totalPages - 2 && <span>...</span>}
                        {currentPage < totalPages - 1 && (
                            <button className="pagination-button">{totalPages}</button>
                        )}
                    </>
                )}

                <button
                    className="pagination-button"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                >
                    Next <i className="fas fa-chevron-right"></i>
                </button>
                
                <span className="page-info">
                    Page {currentPage} of {totalPages}
                </span>
            </div>
        );
    };

    // Add function to view subtasks workflow
    const handleViewSubtasks = (activity) => {
        if (activity.sub_activities && Array.isArray(activity.sub_activities) && activity.sub_activities.length > 0) {
            setSelectedSubtasks(activity.sub_activities);
            setShowSubtaskWorkflow(true);
        } else {
            alert("This activity doesn't have any subtasks.");
        }
    };

    // Make sure you have this effect to get the current user
    useEffect(() => {
        // Get current user from session storage
        const userId = sessionStorage.getItem('userId');
        const userName = sessionStorage.getItem('userName');
        
        if (userId) {
            setCurrentUser({
                id: userId,
                name: userName
            });
        }
    }, []);

    return (
        <div className="activities-container">
            {/* <div className="page-header">
                <h1><i className="fas fa-clipboard-list"></i> Activity Management</h1>
                <p>Create, update, and assign activities to your team members</p>
            </div> */}

            {/* Add a note if we're in the workflow process */}
            {isInWorkflow && (
                <div className="workflow-note">
                    {isInEmployeeAssignmentStep ? (
                        <p className="workflow-message">
                            You're in step 3 of the workflow. Please assign an auditor to an activity to continue.
                        </p>
                    ) : (
                        <p className="workflow-message">
                            You're in step 2 of the workflow. Please create an activity to continue.
                        </p>
                    )}
                </div>
            )}

            {/* Quick Stats Section */}
            <div className="quick-stats-section">
                <div className="stat-card regulatory-stat">
                    <div className="stat-icon">
                        <i className="fas fa-balance-scale"></i>
                    </div>
                    <div className="stat-content">
                        <div className="stat-numbers">
                            <span className="stat-count">{stats.regulatory}</span>
                            <div className="stat-details">
                                <div className="stat-detail">
                                    <span className="detail-dot regulatory"></span>
                                    <span>Regulatory Activities</span>
                                </div>
                            </div>
                        </div>
                        <h3 className="stat-title">Regulatory</h3>
                    </div>
                    <div className="stat-progress">
                        <svg viewBox="0 0 36 36" className="circular-chart">
                            <path className="circle-bg"
                                d="M18 2.0845
                                    a 15.9155 15.9155 0 0 1 0 31.831
                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path className="circle regulatory-circle"
                                strokeDasharray={`${stats.total > 0 ? (stats.regulatory / stats.total) * 100 : 0}, 100`}
                                d="M18 2.0845
                                    a 15.9155 15.9155 0 0 1 0 31.831
                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                        </svg>
                    </div>
                </div>

                <div className="stat-card internal-stat">
                    <div className="stat-icon">
                        <i className="fas fa-building"></i>
                    </div>
                    <div className="stat-content">
                        <div className="stat-numbers">
                            <span className="stat-count">{stats.internal}</span>
                            <div className="stat-details">
                                <div className="stat-detail">
                                    <span className="detail-dot internal"></span>
                                    <span>Internal Activities</span>
                                </div>
                            </div>
                        </div>
                        <h3 className="stat-title">Internal</h3>
                    </div>
                    <div className="stat-progress">
                        <svg viewBox="0 0 36 36" className="circular-chart">
                            <path className="circle-bg"
                                d="M18 2.0845
                                    a 15.9155 15.9155 0 0 1 0 31.831
                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path className="circle internal-circle"
                                strokeDasharray={`${stats.total > 0 ? (stats.internal / stats.total) * 100 : 0}, 100`}
                                d="M18 2.0845
                                    a 15.9155 15.9155 0 0 1 0 31.831
                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                        </svg>
                    </div>
                </div>

                <div className="stat-card customer-stat">
                    <div className="stat-icon">
                        <i className="fas fa-users"></i>
                    </div>
                    <div className="stat-content">
                        <div className="stat-numbers">
                            <span className="stat-count">{stats.customer}</span>
                            <div className="stat-details">
                                <div className="stat-detail">
                                    <span className="detail-dot customer"></span>
                                    <span>Client Activities</span>
                                </div>
                            </div>
                        </div>
                        <h3 className="stat-title">Customer</h3>
                    </div>
                    <div className="stat-progress">
                        <svg viewBox="0 0 36 36" className="circular-chart">
                            <path className="circle-bg"
                                d="M18 2.0845
                                    a 15.9155 15.9155 0 0 1 0 31.831
                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path className="circle customer-circle"
                                strokeDasharray={`${stats.total > 0 ? (stats.customer / stats.total) * 100 : 0}, 100`}
                                d="M18 2.0845
                                    a 15.9155 15.9155 0 0 1 0 31.831
                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                        </svg>
                    </div>
                </div>
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
                        // group_id: "",
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
                    {getCurrentPageActivities().map(activity => (
                        <div 
                            key={activity.activity_id} 
                            className="activity-card"
                            data-priority={activity.criticality || "Low"}
                        >
                            <div className="activity-card-header">
                                <div className="activity-icon">
                                    <i className="fas fa-clipboard-check"></i>
                                </div>
                                <div className="card-actions">
                                    <button 
                                        className="view-subtasks-btn"
                                        onClick={() => handleViewSubtasks(activity)}
                                        title="View Subtasks Workflow"
                                    >
                                        <i className="fas fa-eye"></i>
                                    </button>
                                    <button 
                                        className="report-btn"
                                        onClick={() => handleReportClick(activity)}
                                        title="View Activity Performance Report"
                                    >
                                        <i className="fas fa-chart-pie"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="activity-card-body">
                                <h3>{activity.activity_name}</h3>
                                <p className="activity-description">{activity.act_des || 'No description provided'}</p>
                                <div className="activity-details">
                                    <div className="detail-item priority">
                                        <i className="fas fa-exclamation-circle"></i>
                                        <span>Priority</span>
                                        <span className={`priority-badge ${activity.criticality?.toLowerCase() || 'low'}`}>
                                            {activity.criticality || 'Low'}
                                        </span>
                                    </div>
                                    <div className="detail-item warning">
                                        <i className="fas fa-clock"></i>
                                        <span>Early Warning</span>
                                        <span className="warning-days">
                                            {activity.duration || '0'} days
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <i className="fas fa-calendar-alt"></i>
                                        <span>Due by: {activity.due_by || 'Not set'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="activity-card-actions">
                                <button 
                                    className="edit-btn"
                                    onClick={() => handleEdit(activity)}
                                    title="Edit Activity"
                                >
                                    <i className="fas fa-edit"></i>
                                </button>
                                <button 
                                    className="status-btn" 
                                    onClick={(event) => handleStatusClick(event, activity)}
                                >
                                    <i className="fas fa-users"></i> Assign
                                </button>
                                <button 
                                    className="download-btn"
                                    onClick={() => handleDownloadReport(activity.activity_id)}
                                    title="Download Activity Performance Report"
                                >
                                    <i className="fas fa-download"></i>
                                </button>
                                <button 
                                    className="delete-btn"
                                    onClick={() => handleDelete(activity.activity_id)}
                                    title="Delete Activity"
                                >
                                    <i className="fas fa-trash-alt"></i>
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
                                // group_id: "",
                                status: "A"
                            });
                            setShowForm(true);
                        }}
                    >
                        <i className="fas fa-plus"></i> Create Activity
                    </button>
                </div>
            )}

            {filteredActivities.length > activitiesPerPage && <Pagination />}

            {showForm && (
                <div className="modal-overlay">
                    <div className="activity-form-modal">
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-clipboard-check"></i>
                                {editingActivity ? 'Edit Activity' : 'Add New Activity'}
                            </h2>
                            <button className="close-btn" onClick={() => {
                                setShowForm(false);
                                resetFormData();
                            }}>
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
                            
                            {/* Add Subtask Button */}
                            <div className="subtask-control">
                                <button 
                                    type="button" 
                                    className="add-subtask-btn"
                                    onClick={addSubtask}
                                >
                                    <i className="fas fa-plus-circle"></i> Add Subtask
                                </button>
                            </div>
                            
                            {/* Subtasks Area */}
                            {subtasks.length > 0 && (
                                <div className="subtasks-container">
                                    <h3>Subtasks</h3>
                                    
                                    {subtasks.map((subtask, index) => (
                                        <div key={subtask.id} className="subtask-item">
                                            <div className="subtask-header">
                                                <h4>Subtask {index + 1}</h4>
                                                <button 
                                                    type="button" 
                                                    className="remove-subtask-btn"
                                                    onClick={() => removeSubtask(index)}
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                            
                                            <div className="subtask-form-group">
                                                <label>Name:</label>
                                                <input
                                                    type="text"
                                                    value={subtask.name}
                                                    onChange={(e) => handleSubtaskChange(index, 'name', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            
                                            <div className="subtask-form-group">
                                                <label>Description:</label>
                                                <textarea
                                                    value={subtask.description}
                                                    onChange={(e) => handleSubtaskChange(index, 'description', e.target.value)}
                                                    rows="2"
                                                ></textarea>
                                            </div>
                                            
                                            <div className="subtask-form-group">
                                                <label>Time (hours):</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    value={subtask.time}
                                                    onChange={(e) => handleSubtaskChange(index, 'time', e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            <div className="form-group">
                                <label>Estimated Time to complete (in hours):</label>
                                <input
                                    type="number"
                                    name="standard_time"
                                    value={formData.standard_time}
                                    onChange={handleInputChange}
                                    required
                                    readOnly={subtasks.length > 0}
                                    className={subtasks.length > 0 ? 'calculated-field' : ''}
                                />
                                {subtasks.length > 0 && (
                                    <div className="field-note">
                                        <i className="fas fa-info-circle"></i> 
                                        Automatically calculated from subtasks
                                    </div>
                                )}
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
                                <label>Early Warning (in days):</label>
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
                                <select
                                    name="role_id"
                                    value={formData.role_id}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">Select Role</option>
                                    <option value="11">Admin</option>
                                    <option value="22">User</option>
                                </select>
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
                                <label>Status:</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                >
                                    <option value="A">Active</option>
                                    <option value="O">Obsolete</option>
                                </select>
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="btn-save">
                                    <i className="fas fa-save"></i> Save
                                </button>
                                <button 
                                    type="button" 
                                    className="btn-cancel" 
                                    onClick={() => {
                                        setShowForm(false);
                                        resetFormData();
                                    }}
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
                                Activity Assignment
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
                                    <p>Loading assignments...</p>
                                </div>
                            ) : (
                                <table className="mapping-table">
                                    <thead>
                                        <tr>
                                            <th>CLIENT NAME</th>
                                            <th>ASSIGNED AUDITOR</th>
                                            <th>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.isArray(activityMappings) && activityMappings.length > 0 ? (
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
                                                                className="btn btn-primary" 
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
                                                    No assignments found for this activity
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
                            Estimated Time to complete: {standardTime} hours
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
                                            <th>Auditor ID</th>
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

            {showSubtaskWorkflow && (
                <div className="modal-overlay">
                    <div className="subtask-workflow-modal">
                        <div className="modal-header">
                            <h2>
                                <i className="fas fa-project-diagram"></i>
                                Subtask Workflow
                            </h2>
                            <button 
                                className="close-btn" 
                                onClick={() => setShowSubtaskWorkflow(false)}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <div className="workflow-content">
                            {selectedSubtasks.length > 0 ? (
                                <div className="horizontal-workflow">
                                    <div className="workflow-step start-step">
                                        <div className="workflow-node start">
                                            <i className="fas fa-play"></i>
                                            <span>Start</span>
                                        </div>
                                    </div>
                                    
                                    <div className="workflow-line"></div>
                                    
                                    {selectedSubtasks.map((subtask, index) => (
                                        <React.Fragment key={subtask.id || index}>
                                            <div className="workflow-step task-step">
                                                <div className="task-card">
                                                    <div className="task-header">
                                                        <div className="task-number">{index + 1}</div>
                                                        <h3 className="task-name">{subtask.name}</h3>
                                                    </div>
                                                    <p className="task-description">{subtask.description || 'No description'}</p>
                                                    <div className="task-time">
                                                        <i className="far fa-clock"></i> {subtask.time} hours
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="workflow-line"></div>
                                        </React.Fragment>
                                    ))}
                                    
                                    <div className="workflow-step end-step">
                                        <div className="workflow-node end">
                                            <i className="fas fa-flag-checkered"></i>
                                            <span>Complete</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="no-subtasks">
                                    <i className="fas fa-exclamation-circle"></i>
                                    <p>No subtasks found for this activity.</p>
                                </div>
                            )}
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