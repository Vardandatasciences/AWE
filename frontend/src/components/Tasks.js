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
 
const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [viewMode, setViewMode] = useState('board');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [newDueDate, setNewDueDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('all'); // 'all', 'current', 'previous', 'next', 'last3'
  const [selectedAssignee, setSelectedAssignee] = useState('');
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
    fetchTasks();
    fetchEmployees();
  }, []);
 
  useEffect(() => {
    const monthFiltered = getFilteredTasks();
    const searchFiltered = monthFiltered.filter(task =>
      task.task_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTasks(searchFiltered);
  }, [tasks, searchTerm, filterMonth, filterStatus]);
 
  const changeTaskStatus = (taskId, newStatus) => {
    console.log(`Direct status change requested for task ${taskId} to ${newStatus}`);
    
    // Find the task
    const task = tasks.find(t => t.id === taskId);
    
    // Prevent non-admin users from changing completed tasks
    if (!isAdmin && task && task.status === 'completed') {
      console.log('Non-admin user attempted to change a completed task. Operation blocked.');
      return; // Exit the function early
    }
    
    // Map the UI-friendly status to the backend status values
    let backendStatus = newStatus; // Already in the correct format for backend
    
    // Update the task in the UI immediately for better user experience
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        // Map backend status to frontend column
        const frontendStatus =
          newStatus === 'Yet to Start' ? 'todo' :
          newStatus === 'WIP' ? 'in-progress' :
          newStatus === 'Pending' ? 'pending' :
          'Completed';
        
        console.log(`Updating task ${taskId} in UI from ${task.status} to ${frontendStatus}`);
        return { ...task, status: frontendStatus };
      }
      return task;
    });
    
    setTasks(updatedTasks);
    
    // Call the API to update the status in the backend
    handleStatusChange(taskId, backendStatus);
  };
 
  const fetchTasks = async () => {
    setLoading(true);
    try {
      // Get user info from localStorage
      const userData = JSON.parse(localStorage.getItem('user')) || {};
      const userId = userData.user_id;
      const roleId = userData.role_id || (userData.role === 'admin' ? '11' : '22');
     
      // Make API request with user info as query parameters
      const response = await axios.get(`http://localhost:5000/tasks?user_id=${userId}&role_id=${roleId}`);
     
      const tasksWithIds = response.data.map(task => {
        const mappedStatus = getColumnForStatus(task.status);
        console.log(`Task ${task.id}: ${task.status} → ${mappedStatus}`);
       
        return {
          ...task,
          id: task.id.toString(),
          status: mappedStatus
        };
      });
     
      setTasks(tasksWithIds);

      // Calculate stats - update to separate pending from in-progress
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
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to load tasks. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
 
  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/actors');
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
    
    return filtered;
  };
 
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
 
    const { destination } = result;
    const newStatus = destination.droppableId;
    const taskId = result.draggableId;
   
    // Map the column back to backend status
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
 
  const handleStatusChange = async (taskId, newStatus) => {
    console.log(`Updating task ${taskId} status from UI: ${newStatus} to backend: ${newStatus}`);
    
    try {
      // Get user info from localStorage
      const userData = JSON.parse(localStorage.getItem('user')) || {};
      const userId = userData.user_id;
      const roleId = userData.role_id || (userData.role === 'admin' ? '11' : '22');
      
      // Make sure we're using the full URL with http://
      const apiUrl = `http://localhost:5000/tasks/${taskId}?user_id=${userId}&role_id=${roleId}`;
      console.log(`Making API request to: ${apiUrl}`);
      
      const response = await axios.patch(
        apiUrl,
        { status: newStatus },
        { 
          headers: { 
            'Content-Type': 'application/json',
            // Add any auth headers if needed
          },
          // Important: Enable CORS for this request
          withCredentials: false
        }
      );
      
      console.log('Task update response:', response.data);
      
      // Show success message
      displaySuccess("Task status updated successfully!");
      
      // Refresh tasks to ensure we have the latest data
      fetchTasks();
      
    } catch (err) {
      console.error('Error updating task status:', err);
      // Revert the optimistic update if the API call fails
      fetchTasks();
      setError('Failed to update task status. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };
  const displaySuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
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
            return updatedTask;
          }
          return task;
        }));
       
        // Show success message
        displaySuccess("Task reassigned successfully!");
       
        // Close the modal
        setShowReassignModal(false);
       
        // Refresh tasks to get the latest data
        fetchTasks();
      }
    } catch (err) {
      console.error('Error reassigning task:', err);
      setError('Failed to reassign task. Please try again.');
      setTimeout(() => setError(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };
 
  const openReassignModal = (task) => {
    setSelectedTask(task);
    setNewDueDate(task.due_date || '');
    setSelectedAssignee('');
    setShowReassignModal(true);
    fetchEmployees();
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
 
  const renderTaskCard = (task, index) => (
    <Draggable key={task.id} draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`task-card ${task.criticality?.toLowerCase()} ${isTaskDelayed(task.due_date) && task.status !== 'completed' ? 'delayed' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
        >
          <div className="task-card-header">
            <span className={`priority-indicator ${task.criticality?.toLowerCase()}`}>
              {task.criticality}
            </span>
            
            {/* Add delayed badge between priority and reassign button */}
            {isTaskDelayed(task.due_date) && task.status !== 'completed' && (
              <span className="delayed-badge">
                <i className="fas fa-exclamation-circle"></i> DELAYED
              </span>
            )}
            
            <div className="task-actions">
              {isAdmin && (
                <button
                  className="reassign-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openReassignModal(task);
                  }}
                >
                  <i className="fas fa-user-plus"></i>
                  Reassign
                </button>
              )}
            </div>
          </div>
         
          <h3 className="task-title">{task.task_name}</h3>
          <div className="customer-info">
            <i className="fas fa-building"></i>
            <span>{task.customer_name || 'No Customer'}</span>
          </div>
          <div className="task-details">
            <div className="detail-item">
              <i className="fas fa-link"></i>
              <a href={task.link} target="_blank" rel="noopener noreferrer">
                Task Link
              </a>
            </div>
            <div className="detail-item">
              <i className="fas fa-calendar"></i>
              <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
            </div>
            {isAdmin && (
            <div className="detail-item">
              <i className="fas fa-user"></i>
              <span>Assignee: {task.assignee || 'Unassigned'}</span>
            </div>
          )}
            {isAdmin && (
    <div className="detail-item">
      <i className="fas fa-clock"></i>
      <span>Time: {task.time_taken || '0'} hours</span>
    </div>
  )}
          </div>
 
          <div className="task-footer">
          {/* Remove this activity tag that's showing duplicate information */}
          {/* <span className="activity-tag">
            <i className="fas fa-tasks"></i>
            {task.title || 'No Activity'}
          </span> */}
          
          {/* Add status dropdown here */}
          <div className="status-dropdown">
  <select
    value={task.status === 'todo' ? 'Yet to Start' :
           task.status === 'pending' ? 'Pending' :
           task.status === 'in-progress' ? 'WIP' :
           'Completed'}
    onChange={(e) => changeTaskStatus(task.id, e.target.value)}
    className="status-select"
    disabled={!isAdmin && task.status === 'completed'}
  >
    <option value="Yet to Start">Yet to Start</option>
    <option value="WIP">In Progress</option>
    <option value="Pending">Pending</option>
    <option value="Completed">Completed</option>
  </select>
</div>
        </div>
      </div>
    )}
    </Draggable>
  );
 
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
          {filteredTasks.map(task => (
            <tr key={task.id} className={`task-row ${task.criticality?.toLowerCase()}`}>
              <td data-label="Task Name">{task.task_name}</td>
              <td data-label="Client">{task.customer_name}</td>
              <td data-label="Status">
              {!isAdmin && (
                <select
                  value={task.status === 'todo' ? 'Yet to Start' :
                         task.status === 'pending' ? "Pending" :
                         task.status === 'in-progress' ? 'WIP' :
                         'Completed'}
                  onChange={(e) => changeTaskStatus(task.id, e.target.value)}
                  className="status-select"
                  disabled={task.status === 'completed'}
                >
                  <option value="Yet to Start">Yet to Start</option>
                  <option value="Pending"> Pending</option>
                  <option value="WIP">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              )}
              {/* Show status badge for admin users */}
              {isAdmin && (
                <span className={`status-badge ${task.status}`}>
                  {task.status === 'todo' ? 'Yet to start' :
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
 
  // Enhanced StatCard component with a clean three-part layout
  const StatCard = ({ type, count, total, title, subtitle, gifSrc, iconClass, onClick, isActive }) => {
    const [gifLoaded, setGifLoaded] = useState(false);
    const [gifError, setGifError] = useState(false);
    const progressRef = useRef(null);
    const circleRef = useRef(null);
    const [animatedCount, setAnimatedCount] = useState(0);
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

    // Set the progress value as a CSS variable for animation
    useEffect(() => {
      if (progressRef.current) {
        progressRef.current.style.setProperty('--progress', `${percentage}`);
        // Set the data-percentage attribute for the ::after content
        progressRef.current.setAttribute('data-percentage', percentage);
      }
      
      // Force animation restart by removing and adding the element
      if (circleRef.current) {
        const parent = circleRef.current.parentNode;
        const oldElement = circleRef.current;
        const newElement = oldElement.cloneNode(true);
        
        // Apply the animation directly
        setTimeout(() => {
          newElement.style.strokeDasharray = `${percentage}, 100`;
        }, 100);
        
        parent.replaceChild(newElement, oldElement);
        circleRef.current = newElement;
      }
      
      // Animate count number
      let start = 0;
      const end = count;
      const duration = 2000;
      const startTime = Date.now();
      
      if (end > 0) {
        const timer = setInterval(() => {
          const elapsedTime = Date.now() - startTime;
          const progress = Math.min(elapsedTime / duration, 1);
          
          // Use easeOutQuad for smoother animation
          const easeProgress = 1 - (1 - progress) * (1 - progress);
          const current = Math.floor(easeProgress * end);
          
          setAnimatedCount(current);
          
          if (progress === 1) {
            clearInterval(timer);
          }
        }, 16);
        
        return () => clearInterval(timer);
      }
    }, [count, total, percentage]);

    return (
      <div className={`stat-card ${type}-stat ${isActive ? 'active' : ''}`} onClick={onClick}>
        {/* Left part - GIF/Icon */}
        <div className="stat-icon">
          {!gifError ? (
            <img 
              src={gifSrc} 
              alt={title} 
              className="stat-gif"
              onLoad={() => setGifLoaded(true)}
              onError={() => setGifError(true)}
              style={{ display: gifLoaded ? 'block' : 'none' }}
            />
          ) : (
            <i className={iconClass}></i>
          )}
          {!gifLoaded && !gifError && (
            <div className="gif-loading-spinner"></div>
          )}
        </div>
        
        {/* Middle part - Text content */}
        <div className="stat-content">
          <div className="stat-count">
            {animatedCount}
          </div>
          <h3 className="stat-title">{title}</h3>
          <div className="stat-subtitle">
            <span className={`detail-dot ${type}`}></span>
            <span>{subtitle}</span>
          </div>
        </div>
        
        {/* Right part - Progress circle */}
        <div className="stat-progress" ref={progressRef} data-percentage={percentage}>
          <svg viewBox="0 0 36 36" className="circular-chart">
            <path className="circle-bg"
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path 
              ref={circleRef}
              className={`circle ${type}-circle`}
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
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
 
      {/* Quick Stats Section with click handlers */}
      <div className="quick-stats-section">
        <StatCard 
          type="todo"
          count={stats.todo}
          total={stats.total}
          title="To Do"
          subtitle="Yet to Start"
          gifSrc={todoGif}
          iconClass="fas fa-clipboard-list"
          onClick={handleFilterByTodo}
          isActive={filterStatus === 'todo'}
        />
        
        <StatCard 
          type="progress"
          count={stats.inProgress}
          total={stats.total}
          title="Work In Progress"
          subtitle="In Progress"
          gifSrc={progressGif}
          iconClass="fas fa-spinner fa-spin"
          onClick={handleFilterByInProgress}
          isActive={filterStatus === 'in-progress'}
        />
        
        {/* Add new Pending card */}
        <StatCard 
          type="pending"
          count={stats.pending}
          total={stats.total}
          title="Pending"
          subtitle="Awaiting Action"
          gifSrc={pendingGif}
          iconClass="fas fa-pause-circle"
          onClick={handleFilterByPending}
          isActive={filterStatus === 'pending'}
        />
        
        <StatCard 
          type="completed"
          count={stats.completed}
          total={stats.total}
          title="Done"
          subtitle="Completed"
          gifSrc={doneGif}
          iconClass="fas fa-check-circle"
          onClick={handleFilterByCompleted}
          isActive={filterStatus === 'completed'}
        />
      </div>
 
      <div className="controls-container">
        <div className="search-filter-container">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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
         
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'board' ? 'active' : ''}`}
              onClick={() => setViewMode('board')}
            >
              <i className="fas fa-th-large"></i> Grid
            </button>
            <button
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <i className="fas fa-list"></i> List
            </button>
          </div>
        </div>
       
        {/* Only show add/reassign button if user is admin, and moved outside the filter container */}
        {/* {isAdmin && (
          <button className="add-button" onClick={() => setShowReassignModal(true)}>
            <i className="fas fa-plus"></i> Reassign Task
          </button>
        )} */}
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
      ) : viewMode === 'board' ? (
        <div className="task-cards-grid">
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => (
              <div 
                key={task.id} 
                className={`task-card ${task.criticality?.toLowerCase()} ${isTaskDelayed(task.due_date) && task.status !== 'completed' ? 'delayed' : ''}`}
              >
                <div className="task-card-header">
                  <span className={`priority-indicator ${task.criticality?.toLowerCase()}`}>
                    {task.criticality}
                  </span>
                  
                  {/* Add delayed badge between priority and reassign button */}
                  {isTaskDelayed(task.due_date) && task.status !== 'completed' && (
                    <span className="delayed-badge">
                      <i className="fas fa-exclamation-circle"></i> DELAYED
                    </span>
                  )}
                  
                  <div className="task-actions">
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
                
                <h3 className="task-title">{task.task_name}</h3>
                <div className="customer-info">
                  <i className="fas fa-building"></i>
                  <span>{task.customer_name || 'No Client'}</span>
                </div>
                <div className="task-details">
                  <div className="detail-item">
                    <i className="fas fa-link"></i>
                    <a href={task.link} target="_blank" rel="noopener noreferrer">
                      Task Link
                    </a>
                  </div>
                  <div className={`detail-item ${isTaskDelayed(task.due_date) && task.status !== 'completed' ? 'due-date' : ''}`}>
                    <i className="fas fa-calendar"></i>
                    <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                  </div>
                  <div className="detail-item">
                    <i className="fas fa-user"></i>
                    <span> {task.assignee || 'Unassigned'}</span>
                  </div>
                  {isAdmin && (
                    <div className="detail-item">
                      <i className="fas fa-clock"></i>
                      <span>Time: {task.time_taken || '0'} hours</span>
                    </div>
                  )}
                </div>
                
                {!isAdmin && (
                <div className="task-footer">
                  {/* Remove this activity tag that's showing duplicate information */}
                  {/* <span className="activity-tag">
                    <i className="fas fa-tasks"></i>
                    {task.title || 'No Activity'}
                  </span> */}
                  
                  <div className="status-dropdown">
                    <select
                      value={task.status === 'todo' ? 'Yet to Start' :
                             task.status === 'pending' ? 'Pending' :
                             task.status === 'in-progress' ? 'WIP' :
                             'Completed'}
                      onChange={(e) => changeTaskStatus(task.id, e.target.value)}
                      className="status-select"
                      disabled={task.status === 'completed'}
                    >
                      <option value="Yet to Start">Yet to Start</option>
                      <option value="WIP">In Progress</option>
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state">
              <i className="fas fa-clipboard-list"></i>
              <h3>No tasks found</h3>
              <p>Try adjusting your filters or search criteria</p>
            </div>
          )}
        </div>
      ) : renderListView()}
 
      {showReassignModal && selectedTask && (
        <div className="modal-overlay">
          <div className="reassign-modal">
            <div className="modal-header">
              <h3>Reassign Task</h3>
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
                    disabled={isLoading}
                  >
                    <option value="">-- Select an employee --</option>
                    {employees.map(employee => (
                      <option key={employee.actor_id} value={employee.actor_id}>
                        {employee.actor_name}
                      </option>
                    ))}
                  </select>
                  {isLoading && <div className="select-spinner"></div>}
                </div>
              </div>
            </div>
           
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowReassignModal(false)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="save-btn"
                onClick={handleReassign}
                disabled={!selectedAssignee || isLoading}
              >
                {isLoading ? (
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
    </div>
  );
};
 
export default Tasks;