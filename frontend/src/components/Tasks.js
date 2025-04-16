import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import './Tasks.css';
import './ReassignModal.css';
import axios from 'axios';
import { API_ENDPOINTS } from '../config/api';
import apiService from '../services/api.service';
import { useAuth } from '../context/AuthContext';
import yetToStart from '../assets/yet-to-start.gif';
import inProgress from '../assets/wip.gif';
import completed from '../assets/completed.gif';
import todoGif from '../assets/Todo.gif'
import progressGif from '../assets/wip.gif';
import pendingGif from '../assets/pending.gif';
import doneGif from '../assets/done.gif';
import { useWorkflow } from '../context/WorkflowContext';
import api from '../services/api';
 
const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [newDueDate, setNewDueDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('all'); // 'all', 'current', 'previous', 'next', 'last3'
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [searchField, setSearchField] = useState('all'); // Add search field state: 'all', 'task', 'customer', 'assignee'
  const { user, isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [gifsLoaded, setGifsLoaded] = useState({
    yetToStart: false,
    inProgress: false,
    completed: false
  });
  const [stats, setStats] = useState({
    total: 0,
    todo: 0,
    inProgress: 0,
    completed: 0,
    pending: 0
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [tasksPerPage] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('none');
  const [filterCriticality, setFilterCriticality] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [taskForRemarks, setTaskForRemarks] = useState(null);
  const [viewType, setViewType] = useState(isAdmin ? 'status' : 'tasks'); // Default to 'tasks' for non-admin
  const [entityType, setEntityType] = useState(''); // 'auditor' or 'client'
  const [selectedEntity, setSelectedEntity] = useState(isAdmin ? '' : 'all'); // Default to 'all' for non-admin
  const [auditors, setAuditors] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSubtasksModal, setShowSubtasksModal] = useState(false);
  const [selectedTaskForSubtasks, setSelectedTaskForSubtasks] = useState(null);
  const [showSubtaskWorkflow, setShowSubtaskWorkflow] = useState(false);
  const [selectedSubtasks, setSelectedSubtasks] = useState([]);
  const [activeSubtaskStatuses, setActiveSubtaskStatuses] = useState({});
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isUpdatingSubtask, setIsUpdatingSubtask] = useState(false);
 
  // Check if GIFs are loading correctly
  useEffect(() => {
    console.log("Checking if GIFs are loading correctly...");
    
    const checkImageLoaded = (src, name) => {
      const img = new Image();
      img.onload = () => {
        console.log(`✅ ${name} GIF loaded successfully:`, src);
      };
      img.onerror = () => {
        console.error(`❌ ${name} GIF failed to load:`, src);
      };
      img.src = src;
    };
    
    checkImageLoaded(todoGif, "Todo");
    checkImageLoaded(progressGif, "Progress");
    checkImageLoaded(doneGif, "Done");
  }, []);
 
  // Map backend status directly to column names
  const getColumnForStatus = (status) => {
    console.log("Original status from backend:", status);
    if (status === 'WIP') return 'in-progress';
    if (status === 'Completed') return 'completed';
    if (status === 'Yet to Start') return 'todo';
    if (status === 'Pending') return 'pending';
   
    // For debugging - log any unexpected status values
    if (status !== 'WIP' && status !== 'Completed' && status !== 'Yet to Start' && status !== 'Pending') {
      console.warn("Unexpected status value:", status);
    }
   
    return 'todo'; // Default fallback
  };
 
  useEffect(() => {
    // For non-admin users, fetch tasks immediately
    if (!isAdmin) {
      fetchTasks();
    }
    // For admin users, wait for entity selection or "all" option
    else if (selectedEntity) {
      fetchTasks();
      // When an entity is selected, always show tasks
      if (viewType !== 'tasks') {
        setViewType('tasks');
      }
    }
  }, [selectedEntity, isAdmin]);

  // Add a debounced search effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      // Only fetch from backend if search term is at least 2 characters
      // or if it's empty (to reset the search)
      if (searchTerm.length >= 2 || searchTerm === '') {
        fetchTasks();
      }
    }, 500); // 500ms delay for debouncing

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, searchField]);
 
  useEffect(() => {
    const monthFiltered = getFilteredTasks();
    const searchFiltered = monthFiltered.filter(task =>
      task.task_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const sortedTasks = getSortedTasks(searchFiltered);
    setFilteredTasks(sortedTasks);
    setTotalPages(Math.ceil(searchFiltered.length / tasksPerPage));
    setCurrentPage(1);
  }, [tasks, searchTerm, filterMonth, filterStatus, filterCriticality, sortBy, tasksPerPage]);
 
  useEffect(() => {
    if (tasks) {
      setTotalPages(Math.ceil(tasks.length / tasksPerPage));
    }
  }, [tasks, tasksPerPage]);
 
  const changeTaskStatus = (taskId, newStatus) => {
    console.log(`Direct status change requested for task ${taskId} to ${newStatus}`);
    
    // Find the task
    const task = tasks.find(t => t.id === taskId);
    
    // Prevent non-admin users from changing completed tasks
    if (!isAdmin && task && task.status === 'completed') {
      console.log('Non-admin user attempted to change a completed task. Operation blocked.');
      return;
    }

    // If status is being changed to Pending, show remarks modal
    if (newStatus === 'Pending') {
      setTaskForRemarks({ id: taskId, newStatus });
      setShowRemarksModal(true);
      return;
    }
    
    // Update the task in the UI immediately for better user experience
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        // Map backend status to frontend column
        const frontendStatus =
          newStatus === 'Yet to Start' ? 'todo' :
          newStatus === 'WIP' ? 'in-progress' :
          newStatus === 'Pending' ? 'pending' :
          'completed';
        
        console.log(`Updating task ${taskId} in UI from ${task.status} to ${frontendStatus}`);
        return { ...task, status: frontendStatus };
      }
      return task;
    });
    
    setTasks(updatedTasks);
    
    // Call the API to update the status in the backend
    handleStatusChange(taskId, newStatus);
  };
 
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const userData = JSON.parse(localStorage.getItem('user')) || {};
      const userId = userData.user_id;
      const roleId = userData.role_id || (userData.role === 'admin' ? '11' : '22');
      
      let queryParams = `user_id=${userId}&role_id=${roleId}`;
      
      // Add entity filtering only for admin users
      if (isAdmin && selectedEntity) {
        if (entityType === 'auditor' && selectedEntity !== 'all') {
          console.log(`Fetching tasks for auditor: ${selectedEntity}`);
          queryParams += `&auditor_id=${selectedEntity}`;
        } else if (entityType === 'client' && selectedEntity !== 'all') {
          console.log(`Fetching tasks for client: ${selectedEntity}`);
          queryParams += `&client_id=${selectedEntity}`;
        }
        // If "all" is selected, don't add any filter to get all tasks
      }
      
      if (searchTerm) {
        queryParams += `&search=${encodeURIComponent(searchTerm)}&field=${searchField}`;
      }
      
      console.log(`Fetching tasks with params: ${queryParams}`);
      // Use api service instead of direct axios call
      const response = await api.get(`/tasks?${queryParams}`);
      console.log("Fetched tasks:", response.data);
      
      if (Array.isArray(response.data)) {
        // Map the tasks and ensure proper status mapping
        const tasksWithIds = response.data.map(task => {
          const mappedStatus = getColumnForStatus(task.status);
          return {
            ...task,
            id: task.id.toString(),
            status: mappedStatus
          };
        });
        
        setTasks(tasksWithIds);
        
        // Calculate stats
        const total = tasksWithIds.length;
        const todo = tasksWithIds.filter(task => task.status === 'todo').length;
        const inProgress = tasksWithIds.filter(task => task.status === 'in-progress').length;
        const pending = tasksWithIds.filter(task => task.status === 'pending').length;
        const completed = tasksWithIds.filter(task => task.status === 'completed').length;
        
        setStats({
          total,
          todo,
          inProgress,
          completed,
          pending
        });
        
        setError(null);
      } else {
        console.error("Invalid task data format:", response.data);
        setTasks([]);
        setStats({
          total: 0,
          todo: 0,
          inProgress: 0,
          completed: 0,
          pending: 0
        });
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to load tasks. Please try again later.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };
 
  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/actors_assign');
      setEmployees(response.data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setIsLoading(false);
    }
  };
 
  // Add this function to filter tasks by month
  const getFilteredTasks = () => {
    let filtered = tasks;
    
    // Filter by month
    if (filterMonth !== 'all') {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
 
      filtered = filtered.filter(task => {
        if (!task.due_date) return true; // Include tasks without due dates
       
        const taskDate = new Date(task.due_date);
        const taskMonth = taskDate.getMonth();
        const taskYear = taskDate.getFullYear();
 
        switch (filterMonth) {
          case 'current':
            return taskMonth === currentMonth && taskYear === currentYear;
          case 'previous':
            return (taskMonth === currentMonth - 1 && taskYear === currentYear) ||
                   (currentMonth === 0 && taskMonth === 11 && taskYear === currentYear - 1);
          case 'next':
            return (taskMonth === currentMonth + 1 && taskYear === currentYear) ||
                   (currentMonth === 11 && taskMonth === 0 && taskYear === currentYear + 1);
          case 'last3':
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(now.getMonth() - 3);
            return taskDate >= threeMonthsAgo;
          default:
            return true;
        }
      });
    }
    
    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => {
        // Update to treat pending as its own status
        return task.status === filterStatus;
      });
    }
    
    // Add criticality filter
    if (filterCriticality !== 'all') {
      filtered = filtered.filter(task => 
        task.criticality?.toLowerCase() === filterCriticality.toLowerCase()
      );
    }
    
    return filtered;
  };
 
  const getSortedTasks = (tasks) => {
    return [...tasks].sort((a, b) => {
        // First sort by assigned_timestamp (newest first)
        if (a.assigned_timestamp && b.assigned_timestamp) {
            return new Date(b.assigned_timestamp) - new Date(a.assigned_timestamp);
        }
        // Then by other criteria if needed
        return 0;
    });
  };
 
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
 
    const { destination } = result;
    const newStatus = destination.droppableId;
    const taskId = result.draggableId;
   
    // Map the column back to backend status - ensure exact match
    let backendStatus = 'Yet to Start';
    if (newStatus === 'in-progress') backendStatus = 'WIP';
    if (newStatus === 'pending') backendStatus = 'Pending';
    if (newStatus === 'completed') backendStatus = 'Completed';
 
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        return { ...task, status: newStatus };
      }
      return task;
    });
 
    setTasks(updatedTasks);
 
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:5000/tasks/${taskId}`,
        { status: backendStatus },
        { headers: { 'Authorization': `Bearer ${token}` }}
      );
    } catch (err) {
      console.error('Error updating task status:', err);
      setTasks(tasks);
    }
  };
 
  const handleStatusChange = async (taskId, newStatus, remarks = null) => {
    try {
      setIsUpdating(true);
      
      // Get user info from localStorage
      const userData = JSON.parse(localStorage.getItem('user')) || {};
      const userId = userData.user_id;
      const roleId = userData.role_id || (userData.role === 'admin' ? '11' : '22');

      const updateData = {
        status: newStatus,
        remarks: remarks
      };

      console.log(`Updating task ${taskId} status to ${newStatus}`);
      
      try {
        // First try with the /api/ prefix
        const response = await api.patch(
          `/api/tasks/${taskId}`, 
          updateData,
          {
            params: {
              user_id: userId,
              role_id: roleId
            }
          }
        );
        
        // If successful, process the response
        handleSuccessfulUpdate(response, taskId, newStatus, remarks);
      } catch (prefixError) {
        console.log("Error with /api/ prefix, trying without prefix...");
        
        // If that fails, try without the /api/ prefix
        try {
          const fallbackResponse = await api.patch(
            `/tasks/${taskId}`, 
            updateData,
            {
              params: {
                user_id: userId,
                role_id: roleId
              }
            }
          );
          
          // If successful, process the response
          handleSuccessfulUpdate(fallbackResponse, taskId, newStatus, remarks);
        } catch (noPrefixError) {
          // If both fail, throw the error
          console.error("Both API endpoint attempts failed:", prefixError, noPrefixError);
          throw noPrefixError;
        }
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      // Show error message to user
      setError('Failed to update task status. Please try again.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper function to handle successful updates
  const handleSuccessfulUpdate = (response, taskId, newStatus, remarks) => {
    if (response.data.success) {
      // Update local state
      const updatedTasks = tasks.map(task =>
        task.id === taskId
          ? { ...task, status: getColumnForStatus(newStatus), remarks: remarks }
          : task
      );
      setTasks(updatedTasks);
      
      // Show success message
      displaySuccess('Task updated successfully');
      
      // Close modals and reset states
      setShowReassignModal(false);
      setRemarks('');
      setTaskForRemarks(null);
    } else {
      // Handle unsuccessful response
      setError(response.data.message || 'Error updating task status');
      setTimeout(() => setError(null), 3000);
    }
  };

  const displaySuccess = (message) => {
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-check-circle';
    successMessage.appendChild(icon);
    
    const text = document.createElement('span');
    text.textContent = message;
    successMessage.appendChild(text);
    
    document.body.appendChild(successMessage);
    
    // Remove the message after 3 seconds
    setTimeout(() => {
      if (successMessage.parentNode) {
        document.body.removeChild(successMessage);
      }
    }, 3000);
  };
 
  const handleReassign = async () => {
    if (!selectedAssignee) {
      alert("Please select an assignee");
      return;
    }
   
    setIsLoading(true);
   
    try {
      // Get user info from localStorage
      const userData = JSON.parse(localStorage.getItem('user')) || {};
      const userId = userData.user_id;
      const roleId = userData.role_id || (userData.role === 'admin' ? '11' : '22');
     
      // Prepare the update data
      const updateData = {
        assignee: selectedAssignee
      };
     
      // Only include due date if it was changed
      if (newDueDate) {
        updateData.due_date = newDueDate;
      }
      
      // Include status if it was changed
      if (selectedStatus) {
        updateData.status = selectedStatus;
      }
     
      // Make the API call
      const response = await axios.patch(
        `/tasks/${selectedTask.id}?user_id=${userId}&role_id=${roleId}`,
        updateData
      );
     
      if (response.data.success) {
        // Update the local state to reflect changes immediately
        setTasks(tasks.map(task => {
          if (task.id === selectedTask.id) {
            const updatedTask = {
              ...task,
              assignee: employees.find(emp => emp.actor_id === selectedAssignee)?.actor_name || 'Unknown'
            };
            
            if (newDueDate) {
              updatedTask.due_date = newDueDate;
            }
            
            if (selectedStatus) {
              // Map backend status to frontend status
              updatedTask.status = 
                selectedStatus === 'Yet to Start' ? 'todo' :
                selectedStatus === 'WIP' ? 'in-progress' :
                selectedStatus === 'Pending' ? 'pending' :
                'completed';
            }
            
            return updatedTask;
          }
          return task;
        }));
       
        // Show success message
        displaySuccess("Task updated successfully!");
       
        // Close the modal
        setShowReassignModal(false);
       
        // Refresh tasks to get the latest data
        fetchTasks();
      }
    } catch (err) {
      console.error('Error updating task:', err);
      setError('Failed to update task. Please try again.');
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };
 
  const openReassignModal = (task) => {
    setSelectedTask(task);
    setNewDueDate(task.due_date || '');
    setSelectedAssignee('');
    
    // Set the initial selected status based on the task's current status
    const currentStatus = task.status === 'todo' ? 'Yet to Start' :
                          task.status === 'in-progress' ? 'WIP' :
                          task.status === 'pending' ? 'Pending' :
                          'Completed';
    
    setSelectedStatus(currentStatus);
    setShowReassignModal(true);
    fetchEmployees();
    console.log("Selected task for reassign:", task);
    console.log("Task remarks:", task.remarks);
  };
 
  // Add this helper function to check if a task is delayed
  const isTaskDelayed = (dueDate) => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for fair comparison
    const taskDueDate = new Date(dueDate);
    taskDueDate.setHours(0, 0, 0, 0);
    return taskDueDate < today;
  };
 
  // Add this helper function to check if a task was recently assigned
  const isRecentlyAssigned = (assignedTimestamp) => {
    if (!assignedTimestamp) return false;
    const now = new Date();
    const assigned = new Date(assignedTimestamp);
    // Check if task was assigned in the last 24 hours
    return (now - assigned) < 24 * 60 * 60 * 1000;
  };
 
  // Add this function to handle viewing subtasks
  const handleViewSubtasks = (task) => {
    // Check if task has subtasks field directly
    if (task.sub_activities && Array.isArray(task.sub_activities) && task.sub_activities.length > 0) {
      setSelectedSubtasks(task.sub_activities);
      setShowSubtaskWorkflow(true);
    } else {
      // If not, we need to fetch the subtasks from the backend
      fetchTaskSubtasks(task.id);
    }
  };
  
  // Function to fetch subtasks from backend
  const fetchTaskSubtasks = async (taskId) => {
    try {
      const response = await axios.get(`${API_ENDPOINTS.BASE_URL}/task_subtasks/${taskId}`);
      
      if (response.data && Array.isArray(response.data)) {
        setSelectedSubtasks(response.data);
        setShowSubtaskWorkflow(true);
      } else {
        alert("This task doesn't have any subtasks.");
      }
    } catch (error) {
      console.error("Error fetching subtasks:", error);
      alert("Failed to load subtasks. Please try again.");
    }
  };
 
  const renderTaskCard = (task, index) => {
    const isDelayed = isTaskDelayed(task.due_date);
    const isNew = isRecentlyAssigned(task.assigned_timestamp);
    
    return (
        <div key={task.id || index} className={`task-card ${task.criticality?.toLowerCase()} ${isDelayed && task.status !== 'completed' ? 'delayed' : ''}`}>
            {/* Header with priority */}
            <div className="task-card-header">
                <span className="priority-indicator">{task.criticality}</span>
                {isDelayed && (
                    <span className="delayed-badge">
                        <i className="fas fa-clock"></i>
                        DELAYED
                    </span>
                )}
                
                {/* NEW badge with styling consistent with delayed-badge */}
                {isNew && (
                    <span className="new-badge">
                        <i className="fas fa-bell"></i>
                        NEW
                    </span>
                )}
                
                <div className="task-actions">
                  <button 
                    className="eye-btn"
                    onClick={() => handleViewSubtasks(task)}
                    title="View Subtasks Workflow"
                  >
                    <i className="fas fa-eye"></i>
                  </button>
                  
                  {isAdmin && (
                    <button
                      className="reassign-button"
                      onClick={() => openReassignModal(task)}
                    >
                      <i className="fas fa-user-plus"></i>
                      Reassign
                    </button>
                  )}
                </div>
            </div>

            {/* Main content */}
            <div className="task-card-body">
                {/* Task Name */}
                <div className="task-name">
                    {task.task_name}
                </div>

                {/* Client Name */}
                <div className="customer-info">
                    <i className="fas fa-building"></i>
                    <span>{task.customer_name || 'No Client'}</span>
                </div>

                {/* Assignee info */}
                <div className="assignee-info">
                    <i className="fas fa-user"></i>
                    <span>{task.assignee || 'Unassigned'}</span>
                </div>

                {/* Status Section */}
                <div className="status-section">
                    {!isAdmin ? (
                        <select
                            value={task.status === 'todo' ? 'Yet to Start' :
                                   task.status === 'pending' ? 'Pending' :
                                   task.status === 'in-progress' ? 'WIP' :
                                   'Completed'}
                            onChange={(e) => changeTaskStatus(task.id, e.target.value)}
                            className="status-select"
                            disabled={task.status === 'completed'}
                        >
                            <option value="Yet to Start" disabled={task.status !== 'Yet to Start'}>Yet to Start</option>
                            <option value="WIP">In Progress</option>
                            <option value="Pending">Pending</option>
                            <option value="Completed">Completed</option>
                        </select>
                    ) : (
                        <span className={`status-badge ${task.status}`}>
                            {task.status === 'todo' ? 'Yet to Start' :
                             task.status === 'in-progress' ? 'In Progress' :
                             task.status === 'completed' ? 'Completed' :
                             'Pending'}
                        </span>
                    )}
                </div>
            </div>

            {/* Bottom row with link, date, and reassign button */}
            <div className="task-info-row">
                <a href={task.link} className="task-link" target="_blank" rel="noopener noreferrer">
                    <i className="fas fa-link"></i>
                </a>
                <div className="task-date">
                    <i className="far fa-calendar-alt"></i>
                    <span>{new Date(task.due_date).toLocaleDateString()}</span>
                </div>
            </div>
            
            {/* Show remarks if status is Pending */}
            {task.status === 'pending' && (
              <div className="task-remarks">
                <div className="detail-item remarks-item">
                  <i className="fas fa-comment"></i>
                  <span className="remarks-text">Remarks: {task.remarks || 'None'}</span>
                </div>
              </div>
            )}
        </div>
    );
  };
 
  const renderListView = () => (
    <div className="task-list-view">
        <table className="task-table">
            <thead>
                <tr>
                    <th>Task Name</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    {isAdmin && <th>Assignee</th>}
                    {isAdmin && <th>Time</th>}
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {getCurrentPageTasks().map((task, index) => (
                    <tr key={task.id || `task-${index}`} className={`task-row ${task.criticality?.toLowerCase()}`}>
                        <td data-label="Task Name">
                            <div className="task-name-with-icon">
                                <i className="fas fa-chart-pie report-icon"></i>
                                {task.task_name}
                            </div>
                        </td>
                        <td data-label="Client">{task.customer_name}</td>
                        <td data-label="Status">
                            {!isAdmin ? (
                                <select
                                    value={task.status === 'todo' ? 'Yet to Start' :
                                           task.status === 'pending' ? 'Pending' :
                                           task.status === 'in-progress' ? 'WIP' :
                                           'Completed'}
                                    onChange={(e) => changeTaskStatus(task.id, e.target.value)}
                                    className="status-select"
                                    disabled={task.status === 'completed'}
                                >
                                    <option value="Yet to Start" disabled={task.status !== 'Yet to Start'}>Yet to Start</option>
                                    <option value="Pending">Pending</option>
                                    <option value="WIP">In Progress</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            ) : (
                                <span className={`status-badge ${task.status}`}>
                                    {task.status === 'todo' ? 'Yet to Start' :
                                     task.status === 'pending' ? 'Pending' :
                                     task.status === 'in-progress' ? 'In Progress' :
                                     'Completed'}
                                </span>
                            )}
                        </td>
                        <td data-label="Due Date">{task.due_date || 'N/A'}</td>
                        {isAdmin && <td data-label="Assignee">{task.assignee || 'Unassigned'}</td>}
                        {isAdmin && <td data-label="Time">{task.time_taken || '0'} hours</td>}
                        <td data-label="Actions">
                            <button 
                              className="eye-btn"
                              onClick={() => handleViewSubtasks(task)}
                              title="View Subtasks Workflow"
                            >
                              <i className="fas fa-eye"></i>
                            </button>
                            
                            {isAdmin && (
                                <button
                                    className="reassign-button"
                                    onClick={() => openReassignModal(task)}
                                >
                                    <i className="fas fa-user-plus"></i>
                                    Reassign
                                </button>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );
 
  // Update the StatCard component to include GIF
  const StatCard = ({ type, count, total, title, subtitle, onClick, isActive, gifSrc }) => {
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    const [gifLoaded, setGifLoaded] = useState(false);
    
    return (
        <div 
            className={`stat-card ${type} ${isActive ? 'active' : ''}`}
            onClick={onClick}
            style={{ '--progress': percentage / 100 }}
        >
            <div className="stat-content">
                <div className="stat-icon">
                    <img 
                        src={gifSrc} 
                        alt={title}
                        className="stat-gif"
                        onLoad={() => setGifLoaded(true)}
                        style={{ opacity: gifLoaded ? 1 : 0 }}
                    />
                </div>
                <div className="stat-text">
                    <div className="stat-count">{count}</div>
                    <div className="stat-title">{title}</div>
                    <div className="stat-subtitle">{subtitle}</div>
                </div>
            </div>
            <div className="percentage-circle">
                <div className="percentage-value">
                    {percentage}%
                </div>
            </div>
        </div>
    );
  };
 
  // Add these handler functions for filtering by clicking on stat cards
  const handleFilterByTodo = () => {
    setFilterStatus('todo');
    // Scroll to the task list
    document.querySelector('.task-cards-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleFilterByInProgress = () => {
    setFilterStatus('in-progress');
    // Scroll to the task list
    document.querySelector('.task-cards-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleFilterByCompleted = () => {
    setFilterStatus('completed');
    // Scroll to the task list
    document.querySelector('.task-cards-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Add new handler for Pending status
  const handleFilterByPending = () => {
    setFilterStatus('pending');
    // Scroll to the task list
    document.querySelector('.task-cards-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
 
  const getCurrentPageTasks = () => {
    const indexOfLastTask = currentPage * tasksPerPage;
    const indexOfFirstTask = indexOfLastTask - tasksPerPage;
    return filteredTasks.slice(indexOfFirstTask, indexOfLastTask);
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handlePageClick = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

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
 
  // Add this function to handle view mode changes
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };
 
  // Add new function to handle remarks submission
  const handleRemarksSubmit = async () => {
    if (!remarks.trim()) {
      alert('Please enter remarks before proceeding');
      return;
    }

    try {
      await handleStatusChange(taskForRemarks.id, taskForRemarks.newStatus, remarks);
      setShowRemarksModal(false);
      setRemarks('');
      setTaskForRemarks(null);
    } catch (error) {
      console.error('Error updating task with remarks:', error);
    }
  };
 
  // Only fetch entities data for admin users
  useEffect(() => {
    if (isAdmin && entityType) {
      setIsLoadingEntities(true);
      if (entityType === 'auditor') {
        fetchAuditors().finally(() => setIsLoadingEntities(false));
      } else if (entityType === 'client') {
        fetchClients().finally(() => setIsLoadingEntities(false));
      }
    }
  }, [entityType, isAdmin]);

  // Update the fetchAuditors function
  const fetchAuditors = async () => {
    try {
      // Use api service instead of axios directly
      const response = await api.get('/actors');
      
      if (response.data && Array.isArray(response.data)) {
        console.log("Fetched auditors:", response.data);
        setAuditors(response.data.map(auditor => ({
          id: auditor.actor_id,
          name: auditor.actor_name || `Auditor ${auditor.actor_id}`
        })));
      } else {
        console.error("Invalid auditor data format:", response.data);
        setAuditors([]);
      }
    } catch (error) {
      console.error("Error fetching auditors:", error);
      setAuditors([]);
    }
  };

  // Update the fetchClients function
  const fetchClients = async () => {
    try {
      // Use api service instead of axios directly
      const response = await api.get('/customers');
      
      if (response.data && Array.isArray(response.data)) {
        console.log("Fetched clients:", response.data);
        setClients(response.data.map(client => ({
          id: client.customer_id,
          name: client.customer_name || `Client ${client.customer_id}`
        })));
      } else {
        console.error("Invalid client data format:", response.data);
        setClients([]);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
      setClients([]);
    }
  };

  // Update the entity selection handler
  const handleEntitySelect = (e) => {
    const value = e.target.value;
    console.log("Selected entity value:", value);
    setSelectedEntity(value);
    
    if (value) {
        setViewType('tasks');
        // Reset filters when changing entity
        setFilterStatus('all');
        setFilterMonth('all');
        setFilterCriticality('all');
        setSortBy('none');
        setSearchTerm('');
        
        // Log selected entity details
        if (entityType === 'auditor') {
            const selectedAuditor = auditors.find(a => a.id === value);
            console.log("Selected auditor:", selectedAuditor);
        } else if (entityType === 'client') {
            const selectedClient = clients.find(c => c.id === value);
            console.log("Selected client:", selectedClient);
        }
        
        // Fetch tasks for the selected entity
        fetchTasks();
    }
  };
 
  // Add this function to handle new task assignments
  const handleNewTaskAssignment = (newTask) => {
    setTasks(prevTasks => [newTask, ...prevTasks]);
  };

  // Modify the existing handleAssign function
  const handleAssign = async (data) => {
    try {
        const response = await axios.post('/assign_activity', data);
        if (response.data.success) {
            // Add the new task to the beginning of the list
            if (response.data.task) {
                handleNewTaskAssignment(response.data.task);
            } else {
                // If task data not included in response, refresh the list
                fetchTasks();
            }
            // Show success message
            displaySuccess(response.data.message);
        }
    } catch (error) {
        console.error('Error assigning task:', error);
        // Handle error...
    }
  };
 
  // Function to handle updating subtask status
  const handleSubtaskStatusChange = async (subtaskId, newStatus, index) => {
    if (isUpdatingSubtask) return;
    
    try {
      setIsUpdatingSubtask(true);
      
      // Get user info from localStorage
      const userData = JSON.parse(localStorage.getItem('user')) || {};
      const userId = userData.user_id;
      
      // Make API call to update subtask status
      const response = await api.patch(`/subtasks/${subtaskId}`, {
        status: newStatus,
        user_id: userId
      });
      
      if (response.data.success) {
        // Update local state
        setActiveSubtaskStatuses(prev => ({
          ...prev,
          [subtaskId]: newStatus
        }));
        
        // Close dropdown
        setOpenDropdown(null);
        
        // Show success message
        displaySuccess(`Subtask status updated to ${newStatus}`);
        
        // Update the selected subtasks array
        const updatedSubtasks = [...selectedSubtasks];
        if (updatedSubtasks[index]) {
          updatedSubtasks[index].status = newStatus;
          setSelectedSubtasks(updatedSubtasks);
        }
      }
    } catch (error) {
      console.error('Error updating subtask status:', error);
      setError('Failed to update subtask status');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsUpdatingSubtask(false);
    }
  };

  // Function to toggle dropdown
  const toggleStatusDropdown = (subtaskId) => {
    if (openDropdown === subtaskId) {
      setOpenDropdown(null);
    } else {
      setOpenDropdown(subtaskId);
    }
  };
 
  return (
    <div className="tasks-container">
      {success && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i>
          <span>{success}</span>
        </div>
      )}
      {/* <div className="page-header">
        <h1><i className="fas fa-tasks"></i> Tasks</h1>
        <p>Manage and track your team's tasks</p>
      </div> */}
 
      {/* Entity Type Selection */}
      {isAdmin && (
        <div className="entity-selection">
          <select 
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setSelectedEntity(''); // Reset selected entity when type changes
              setViewType('status');
            }}
            className="entity-type-select"
          >
            <option value="">Select Type</option>
            <option value="auditor">Auditor</option>
            <option value="client">Client</option>
          </select>

          {entityType === 'auditor' && (
            <select
              value={selectedEntity}
              onChange={handleEntitySelect}
              className="entity-select"
              disabled={isLoadingEntities}
            >
              <option value="">
                {isLoadingEntities 
                  ? 'Loading Auditors...'
                  : 'Select Auditor'
                }
              </option>
              <option value="all">All Auditors</option>
              {auditors.map(auditor => (
                <option key={auditor.id} value={auditor.id}>
                  {auditor.name}
                </option>
              ))}
            </select>
          )}

          {entityType === 'client' && (
            <select
              value={selectedEntity}
              onChange={handleEntitySelect}
              className="entity-select"
              disabled={isLoadingEntities}
            >
              <option value="">
                {isLoadingEntities 
                  ? 'Loading Clients...'
                  : 'Select Client'
                }
              </option>
              <option value="all">All Clients</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
 
      {/* Quick Stats Section - Always visible */}
      <div className="quick-stats-section">
        <StatCard 
          type="todo"
          count={stats.todo}
          total={stats.total}
          title="To Do"
          subtitle="Yet to Start"
          onClick={handleFilterByTodo}
          isActive={filterStatus === 'todo'}
          gifSrc={todoGif}
        />
        
        <StatCard 
          type="progress"
          count={stats.inProgress}
          total={stats.total}
          title="Work In Progress"
          subtitle="In Progress"
          onClick={handleFilterByInProgress}
          isActive={filterStatus === 'in-progress'}
          gifSrc={progressGif}
        />
        
        <StatCard 
          type="pending"
          count={stats.pending}
          total={stats.total}
          title="Pending"
          subtitle="Awaiting Action"
          onClick={handleFilterByPending}
          isActive={filterStatus === 'pending'}
          gifSrc={pendingGif}
        />
        
        <StatCard 
          type="completed"
          count={stats.completed}
          total={stats.total}
          title="Done"
          subtitle="Completed"
          onClick={handleFilterByCompleted}
          isActive={filterStatus === 'completed'}
          gifSrc={doneGif}
        />
      </div>
 
      {/* Only show tasks view when entity is selected */}
      {(viewType === 'tasks' && selectedEntity) || !isAdmin ? (
        <>
          <div className="controls-container">
            <div className="search-filter-container">
              <div className="search-box">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  placeholder={`Search ${searchField === 'all' ? 'all fields' : searchField + 's'}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select 
                  value={searchField}
                  onChange={(e) => setSearchField(e.target.value)}
                  className="search-field-selector"
                >
                  <option value="all">All Fields</option>
                  <option value="task">Task Name</option>
                  <option value="customer">Customer</option>
                  <option value="assignee">Assignee</option>
                </select>
              </div>
             
              <div className="filter-group">
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="month-filter"
                >
                  <option value="all">All Time</option>
                  <option value="current">Current Month</option>
                  <option value="previous">Previous Month</option>
                  <option value="next">Next Month</option>
                  <option value="last3">Last 3 Months</option>
                </select>
              </div>
              
              <div className="filter-group">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="status-filter"
                >
                  <option value="all">All Status</option>
                  <option value="todo">Yet to Start</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
             
              <div className="filter-group">
                <select
                  value={filterCriticality}
                  onChange={(e) => setFilterCriticality(e.target.value)}
                  className="criticality-filter"
                >
                  <option value="all">All Criticality</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
             
              <div className="filter-group">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-filter"
                >
                  <option value="none">Sort by Criticality</option>
                  <option value="high-to-low">High to Low</option>
                  <option value="low-to-high">Low to High</option>
                </select>
              </div>
             
              <div className="view-toggle">
                <button
                  className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('grid')}
                >
                  <i className="fas fa-th-large"></i> Grid
                </button>
                <button
                  className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('list')}
                >
                  <i className="fas fa-list"></i> List
                </button>
              </div>
            </div>
          </div>
 
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading tasks...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <i className="fas fa-exclamation-triangle"></i>
              <p>{error}</p>
              <button onClick={fetchTasks} className="retry-button">
                <i className="fas fa-sync-alt"></i> Retry
              </button>
            </div>
          ) : filteredTasks.length > 0 ? (
            viewMode === 'grid' ? (
                <div className="task-cards-grid">
                    {getCurrentPageTasks().map(task => renderTaskCard(task))}
                </div>
            ) : (
                renderListView()
            )
          ) : (
            <div className="empty-state">
              <i className="fas fa-clipboard-list"></i>
              <h3>No tasks found</h3>
              <p>Try adjusting your filters or search criteria</p>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <i className="fas fa-user-circle"></i>
          <h3>Select {entityType || 'a type'}</h3>
          <p>Please select {entityType === 'auditor' ? 'an auditor' : entityType === 'client' ? 'a client' : 'a type'} to view tasks</p>
        </div>
      )}
 
      {showReassignModal && selectedTask && (
        <div className="modal-overlay">
          <div className="reassign-modal">
            <div className="modal-header">
              <h3>Update Task</h3>
              <button className="close-btn" onClick={() => setShowReassignModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
           
            <div className="modal-content">
              <div className="task-details">
                <h4>{selectedTask.task_name}</h4>
                <p className={`criticality ${selectedTask.criticality?.toLowerCase()}`}>
                  {selectedTask.criticality}
                </p>
                <p className="customer-name">
                  <i className="fas fa-building"></i> {selectedTask.customer_name}
                </p>
                
                {/* Always show remarks section, but with "None" if no remarks */}
                <div className="remarks-display">
                  <h5><i className="fas fa-comment"></i> Remarks</h5>
                  <p className="remarks-content">
                    {selectedTask.remarks ? selectedTask.remarks : 'None'}
                  </p>
                </div>
              </div>
             
              <div className="form-group">
                <label htmlFor="task-status">Status</label>
                <div className="input-with-icon">
                  <i className="fas fa-tasks"></i>
                  <select
                    id="task-status"
                    className="status-select"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    disabled={isUpdating}
                  >
                    <option value="Yet to Start" disabled={selectedStatus !== 'Yet to Start'}>Yet to Start</option>
                    <option value="WIP">In Progress</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
             
              <div className="form-group">
                <label htmlFor="due-date">Due Date</label>
                <div className="input-with-icon">
                  <i className="far fa-calendar-alt"></i>
                  <input
                    type="date"
                    id="due-date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
             
              <div className="form-group">
                <label htmlFor="assignee">Select Assignee</label>
                <div className="input-with-icon">
                  <i className="far fa-user"></i>
                  <select
                    id="assignee"
                    className="assignee-select"
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    value={selectedAssignee}
                    disabled={isUpdating}
                  >
                    <option value="">-- Select an employee --</option>
                    {employees.map(employee => (
                      <option key={employee.actor_id} value={employee.actor_id}>
                        {employee.actor_name}
                      </option>
                    ))}
                  </select>
                  {isUpdating && <div className="select-spinner"></div>}
                </div>
              </div>
            </div>
           
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowReassignModal(false)}
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                className="save-btn"
                onClick={handleReassign}
                disabled={!selectedAssignee || isUpdating}
              >
                {isUpdating ? (
                  <>
                    <div className="btn-spinner"></div>
                    Processing...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {filteredTasks.length > tasksPerPage && <Pagination />}
 
      {showRemarksModal && (
        <div className="modal-overlay">
          <div className="reassign-modal">
            <div className="modal-header">
              <h3>Add Remarks</h3>
              <button className="close-btn" onClick={() => setShowRemarksModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label htmlFor="remarks">Please enter remarks for pending status:</label>
                <textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter your remarks here..."
                  rows="4"
                  className="remarks-textarea"
                />
              </div>
            </div>
            
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowRemarksModal(false);
                  setRemarks('');
                  setTaskForRemarks(null);
                }}
              >
                Cancel
              </button>
              <button
                className="save-btn"
                onClick={handleRemarksSubmit}
                disabled={!remarks.trim()}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add the Subtasks Modal */}
      {showSubtasksModal && selectedTaskForSubtasks && (
        <div className="modal-overlay">
          <div className="subtasks-modal">
            <div className="modal-header">
              <h3>Subtasks for {selectedTaskForSubtasks.task_name}</h3>
              <button className="close-btn" onClick={() => setShowSubtasksModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-content">
              {selectedTaskForSubtasks.subtasks && selectedTaskForSubtasks.subtasks.length > 0 ? (
                <div className="subtasks-list">
                  <table className="subtasks-table">
                    <thead>
                      <tr>
                        <th>Subtask</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Time (hours)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTaskForSubtasks.subtasks.map((subtask, index) => (
                        <tr key={`subtask-${index}`}>
                          <td>{subtask.name}</td>
                          <td>{subtask.description || 'No description'}</td>
                          <td>
                            <span className={`status-badge ${subtask.status?.toLowerCase()}`}>
                              {subtask.status || 'Not Started'}
                            </span>
                          </td>
                          <td>{subtask.time || '0'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-subtasks">
                  <i className="fas fa-clipboard-list"></i>
                  <p>No subtasks found for this task</p>
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button
                className="close-btn"
                onClick={() => setShowSubtasksModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Subtask Workflow Modal */}
      {showSubtaskWorkflow && (
        <div className="modal-overlay">
          <div className="subtask-flow-modal">
            <div className="modal-header">
              <h2>
                <i className="fas fa-list-ul"></i>
                Subtask Flow for {selectedTask?.task_name || "Preparing Tax Returns"}
              </h2>
              <button 
                className="close-btn" 
                onClick={() => setShowSubtaskWorkflow(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="subtask-flow-content">
              {selectedSubtasks.length > 0 ? (
                <div className="new-flow-diagram">
                  {/* Start Point */}
                  <div className="flow-endpoint start-point">
                    <div className="endpoint-circle">
                      <i className="fas fa-play"></i>
                    </div>
                    <span>Start</span>
                  </div>
                  
                  {/* Connector Line */}
                  <div className="flow-connector-line"></div>
                  
                  {/* Subtask Node - We're just showing one for simplicity */}
                  {selectedSubtasks.map((subtask, index) => (
                    <React.Fragment key={`flow-${index}`}>
                      {index === 0 && (
                        <div className={`flow-connector-line progress-indicator ${
                          subtask.status === 'WIP' || activeSubtaskStatuses[subtask.id] === 'WIP'
                            ? 'in-progress' 
                            : subtask.status === 'Completed' || activeSubtaskStatuses[subtask.id] === 'Completed'
                              ? 'completed' 
                              : ''
                        }`}></div>
                      )}
                      
                      <div className="subtask-container">
                        <div className="subtask-box">
                          <div className="subtask-number">{index + 1}</div>
                          <div className="subtask-details">
                            <h3>{subtask.name || "Task"}</h3>
                            <p>{subtask.description || "Description"}</p>
                            <div className="subtask-hours">
                              <i className="far fa-clock"></i> {subtask.time || 1} hours
                            </div>
                            
                            {/* Add status badge */}
                            {(subtask.status || activeSubtaskStatuses[subtask.id]) && (
                              <div className={`subtask-status-badge status-${
                                subtask.status === 'Completed' || activeSubtaskStatuses[subtask.id] === 'Completed' 
                                  ? 'completed' 
                                  : subtask.status === 'WIP' || activeSubtaskStatuses[subtask.id] === 'WIP'
                                    ? 'in-progress' 
                                    : 'not-started'
                              }`}>
                                <i className={`fas ${
                                  subtask.status === 'Completed' || activeSubtaskStatuses[subtask.id] === 'Completed'
                                    ? 'fa-check' 
                                    : subtask.status === 'WIP' || activeSubtaskStatuses[subtask.id] === 'WIP'
                                      ? 'fa-spinner' 
                                      : 'fa-clock'
                                }`}></i>
                              </div>
                            )}
                            
                            {/* Only show control buttons for non-admin users */}
                            {!isAdmin && (
                              <div className="subtask-status-controls">
                                <div className={`subtask-status-dropdown ${openDropdown === subtask.id ? 'open' : ''}`}>
                                  <button 
                                    className={`status-dropdown-btn ${openDropdown === subtask.id ? 'active' : ''}`}
                                    onClick={() => toggleStatusDropdown(subtask.id)}
                                  >
                                    Update Status <i className="fas fa-chevron-down"></i>
                                  </button>
                                  
                                  {openDropdown === subtask.id && (
                                    <div className="status-dropdown-menu">
                                      <div 
                                        className="status-option start"
                                        onClick={() => handleSubtaskStatusChange(subtask.id, 'WIP', index)}
                                      >
                                        <i className="fas fa-play"></i> Start
                                      </div>
                                      <div 
                                        className="status-option complete"
                                        onClick={() => handleSubtaskStatusChange(subtask.id, 'Completed', index)}
                                      >
                                        <i className="fas fa-check"></i> Complete
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {index < selectedSubtasks.length - 1 && (
                        <div className={`flow-connector-line progress-indicator ${
                          // Only color this connector if the current subtask is at least in progress
                          (subtask.status === 'Completed' || activeSubtaskStatuses[subtask.id] === 'Completed')
                            ? 'completed' 
                            : ''
                        }`}></div>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* Connector Line */}
                  <div className="flow-connector-line"></div>
                  
                  {/* End Point */}
                  <div className="flow-endpoint end-point">
                    <div className="endpoint-circle">
                      <i className="fas fa-stop"></i>
                    </div>
                    <span>End</span>
                  </div>
                </div>
              ) : (
                <div className="no-subtasks-message">
                  <i className="fas fa-info-circle"></i>
                  <p>No subtasks defined for this activity.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
 
export default Tasks;

