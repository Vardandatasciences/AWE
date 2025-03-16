import React, { useState, useEffect } from "react";
import "./Employee.css";
import axios from "axios";
import AddEmployeeForm from './AddEmployeeForm';
import AddCustomerForm from './AddCustomerForm';
import { useWorkflow } from '../context/WorkflowContext';
import { showWorkflowGuide } from '../App';
 
const Employee = () => {
  const [data, setData] = useState([]);
  const [activeTab, setActiveTab] = useState("actors");
  const [editIndex, setEditIndex] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [isAddingActor, setIsAddingActor] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [successMessage, setSuccessMessage] = useState(null);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [stats, setStats] = useState({
    actors: { total: 0, active: 0, inactive: 0 },
    customers: { total: 0, active: 0, inactive: 0 }
  });
  const { completeStep, workflowSteps } = useWorkflow();
 
  // Check if we're in the workflow process
  const isInWorkflow = workflowSteps.some(step => step.status === 'in-progress' && step.id === 3);
 
  // Add state for the customer being assigned
  const [assigningCustomer, setAssigningCustomer] = useState(null);
 
  const [showReport, setShowReport] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [performanceData, setPerformanceData] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
 
  useEffect(() => {
    // Load both data types on component mount
    fetchData("actors");
    fetchData("customers");
  }, []);
 
  // Add useEffect to handle progress animation
  useEffect(() => {
    // Set progress values for employee and customer stats
    const employeeProgress = document.querySelector('.employee-stat .stat-progress');
    const customerProgress = document.querySelector('.customer-stat .stat-progress');
   
    if (employeeProgress && stats.actors) {
      const percentage = stats.actors.total > 0 ? Math.round((stats.actors.active / stats.actors.total) * 100) : 0;
     
      // Set the CSS variable for the animation
      employeeProgress.style.setProperty('--progress', percentage);
      // Set the data attribute for the percentage text
      employeeProgress.setAttribute('data-percentage', percentage);
     
      // Force a repaint to ensure the transition works
      const circle = employeeProgress.querySelector('.circle');
      if (circle) {
        setTimeout(() => {
          circle.style.strokeDasharray = `${percentage}, 100`;
        }, 50);
      }
    }
   
    if (customerProgress && stats.customers) {
      const percentage = stats.customers.total > 0 ? Math.round((stats.customers.active / stats.customers.total) * 100) : 0;
     
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
 
  const fetchData = async (cat) => {
    setLoading(true);
    try {
      let response;
      if (cat === "actors") {
        response = await axios.get("/actors");
        setData(prevData => ({ ...prevData, actors: response.data }));
       
        // Calculate stats
        const total = response.data.length;
        const active = response.data.filter(item => item.status === "A").length;
        setStats(prev => ({
          ...prev,
          actors: { total, active, inactive: total - active }
        }));
      } else if (cat === "customers") {
        response = await axios.get("/customers");
        setData(prevData => ({ ...prevData, customers: response.data }));
       
        // Calculate stats
        const total = response.data.length;
        const active = response.data.filter(item => item.status === "A").length;
        setStats(prev => ({
          ...prev,
          customers: { total, active, inactive: total - active }
        }));
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };
 
  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setEditIndex(null);
    setEditedData({});
    setSearchTerm("");
    setFilterStatus("all");
  };
 
  // Filter and search functionality
  const getFilteredData = () => {
    const currentData = data[activeTab] || [];
   
    return currentData.filter(item => {
      const statusMatch = filterStatus === "all" ||
        (filterStatus === "active" && item.status === "A") ||
        (filterStatus === "inactive" && item.status === "O");
     
      const searchMatch = searchTerm === "" ||
        (item.actor_name && item.actor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.customer_name && item.customer_name.toLowerCase().includes(searchTerm.toLowerCase()));
     
      return statusMatch && searchMatch;
    });
  };
 
  // Edit handlers
  const handleEdit = (index) => {
    setEditIndex(index);
    setEditedData({ ...data[activeTab][index] });
  };
 
  const handleSave = async () => {
    // Save logic would go here
    setEditIndex(null);
  };
 
  const handleDelete = async (id) => {
    // Delete logic would go here
  };
 
  const handleAddEmployee = () => {
    setIsAddingActor(true);
  };
 
  const handleAddCustomer = () => {
    setIsAddingCustomer(true);
  };
 
  const handleSuccess = (message) => {
    setSuccessMessage(message);
    // Refresh data
    fetchData(activeTab);
    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };
 
  const handleAssignEmployee = async (customerId, customerName) => {
    setShowAssignForm(true);
   
    // If we're in the workflow process, mark this step as completed
    if (isInWorkflow) {
      completeStep(3);
     
      // Show the workflow guide again to show completion
      setTimeout(() => {
        showWorkflowGuide();
      }, 500);
    }
  };
 
  const handleShowReport = async (employee) => {
    setSelectedEmployee(employee);
    try {
      const response = await axios.get(`/employee-performance/${employee.actor_id}`);
      setPerformanceData(response.data);
      setShowReportModal(true);
    } catch (error) {
      console.error("Error fetching performance data:", error);
    }
  };

  const handleDownloadReport = async (employee) => {
    try {
      const response = await axios.get(`/download-performance/${employee.actor_id}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const currentDate = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${currentDate}_${employee.actor_name}_Performance.pdf`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report. Please try again.');
    }
  };

  const handlePieSegmentClick = (status) => {
    setSelectedStatus(status === selectedStatus ? null : status);
  };
 
  const filteredData = getFilteredData();
 
  // Calculate recent activity (mock data for visual appeal)
  const recentActivity = [
    { type: 'add', entity: 'employee', name: 'John Smith', time: '2 hours ago' },
    { type: 'edit', entity: 'customer', name: 'Acme Corp', time: '5 hours ago' },
    { type: 'delete', entity: 'employee', name: 'Jane Doe', time: '1 day ago' },
  ];
 
  return (
    <div className="employee-container">
      {successMessage && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i>
          <span>{successMessage}</span>
        </div>
      )}
     
      {/* <div className="page-header">
        <h1><i className="fas fa-users"></i> Employee Management</h1>
        <p>Manage your employees and customers in one place</p>
      </div> */}
 
      {/* Quick Stats Section */}
      <div className="quick-stats-section">
        <div className="stat-card employee-stat">
          <div className="stat-icon">
            <i className="fas fa-user-tie"></i>
          </div>
          <div className="stat-content">
            <div className="stat-numbers">
              <span className="stat-count">{stats.actors.total}</span>
              <div className="stat-details">
                <div className="stat-detail">
                  <span className="detail-dot active"></span>
                  <span>{stats.actors.active} Active</span>
                </div>
                <div className="stat-detail">
                  <span className="detail-dot inactive"></span>
                  <span>{stats.actors.inactive} Inactive</span>
                </div>
              </div>
            </div>
            <h3 className="stat-title">Auditors</h3>
          </div>
          <div className="stat-progress">
            <svg viewBox="0 0 36 36" className="circular-chart">
              <path className="circle-bg"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path className="circle"
                strokeDasharray={`${stats.actors.total > 0 ? (stats.actors.active / stats.actors.total) * 100 : 0}, 100`}
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>
       
        <div className="stat-card customer-stat">
          <div className="stat-icon">
            <i className="fas fa-building"></i>
          </div>
          <div className="stat-content">
            <div className="stat-numbers">
              <span className="stat-count">{stats.customers.total}</span>
              <div className="stat-details">
                <div className="stat-detail">
                  <span className="detail-dot active"></span>
                  <span>{stats.customers.active} Active</span>
                </div>
                <div className="stat-detail">
                  <span className="detail-dot inactive"></span>
                  <span>{stats.customers.inactive} Inactive</span>
                </div>
              </div>
            </div>
            <h3 className="stat-title">Clients</h3>
          </div>
          <div className="stat-progress">
            <svg viewBox="0 0 36 36" className="circular-chart">
              <path className="circle-bg"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path className="circle customer-circle"
                strokeDasharray={`${stats.customers.total > 0 ? (stats.customers.active / stats.customers.total) * 100 : 0}, 100`}
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>
       
        <div className="quick-actions">
          <h3><i className="fas fa-bolt"></i> Quick Actions</h3>
          <div className="action-buttons">
            <button className="quick-action-btn" onClick={handleAddEmployee}>
              <i className="fas fa-user-plus"></i>
              <span>New Auditor</span>
            </button>
            <button className="quick-action-btn" onClick={handleAddCustomer}>
              <i className="fas fa-building"></i>
              <span>New Client</span>
            </button>
 
          </div>
        </div>
      </div>
 
      {/* Main Content Section */}
      <div className="main-content-section">
        <div className="content-header">
          <div className="unified-controls">
            <div className="tabs">
              <button
                className={`tab ${activeTab === "actors" ? "active" : ""}`}
                onClick={() => handleTabChange("actors")}
              >
                <i className="fas fa-user-tie"></i> Auditors
              </button>
              <button
                className={`tab ${activeTab === "customers" ? "active" : ""}`}
                onClick={() => handleTabChange("customers")}
              >
                <i className="fas fa-building"></i> Clients
              </button>
            </div>
 
            <div className="search-filter-container">
              <div className="search-box">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
             
              <div className="filter-options">
                <span>Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        </div>
 
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading data...</p>
          </div>
        ) : filteredData.length > 0 ? (
          <div className="card-grid">
            {filteredData.map((item, index) => {
              const isActor = activeTab === "actors";
              const name = isActor ? item.actor_name : item.customer_name;
              const id = isActor ? item.actor_id : item.customer_id;
             
              return (
                <div className={`card ${item.status === 'A' ? 'active-card' : 'inactive-card'}`} key={id}>
                  <div className="card-header">
                    <div className={`avatar ${isActor ? '' : 'customer-avatar'}`}>
                      <i className={`fas ${isActor ? 'fa-user' : 'fa-building'}`}></i>
                    </div>
                    <div className="status-indicator" title={item.status === 'A' ? 'Active' : 'Inactive'}>
                      <i className={`fas fa-circle ${item.status === 'A' ? 'status-active' : 'status-inactive'}`}></i>
                    </div>
                    {isActor && (
                      <button 
                        className="report-btn" 
                        onClick={() => handleShowReport(item)}
                        title="View Employee Performance Report"
                      >
                        <i className="fas fa-chart-pie"></i>
                      </button>
                    )}
                  </div>
                 
                  {editIndex === index ? (
                    <div className="card-edit-form">
                      <input
                        type="text"
                        value={editedData[isActor ? 'actor_name' : 'customer_name'] || ''}
                        onChange={(e) => setEditedData({...editedData, [isActor ? 'actor_name' : 'customer_name']: e.target.value})}
                        placeholder="Name"
                      />
                      <input
                        type="email"
                        value={editedData.email_id || ''}
                        onChange={(e) => setEditedData({...editedData, email_id: e.target.value})}
                        placeholder="Email"
                      />
                      <input
                        type="text"
                        value={editedData.mobile1 || ''}
                        onChange={(e) => setEditedData({...editedData, mobile1: e.target.value})}
                        placeholder="Phone"
                      />
                      <div className="form-actions">
                        <button className="btn-save" onClick={handleSave}>
                          <i className="fas fa-check"></i> Save
                        </button>
                        <button className="btn-cancel" onClick={() => setEditIndex(null)}>
                          <i className="fas fa-times"></i> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="card-body">
                        <h3>{name}</h3>
                        <div className="detail-item">
                          <i className="fas fa-envelope"></i>
                          <span>{item.email_id}</span>
                        </div>
                        <div className="detail-item">
                          <i className="fas fa-phone"></i>
                          <span>{item.mobile1}</span>
                        </div>
                        <div className="detail-item">
                          <i className="fas fa-map-marker-alt"></i>
                          <span>{item.city || 'N/A'}</span>
                        </div>
                      </div>
                      <div className="card-actions">
                        <button className="btn-edit" onClick={() => handleEdit(index)}>
                          <i className="fas fa-edit"></i>
                        </button>
                        {isActor && (
                          <button 
                            className="btn-download" 
                            onClick={() => handleDownloadReport(item)} 
                            title="Download Performance Report"
                          >
                            <i className="fas fa-download"></i>
                          </button>
                        )}
                        <button className="btn-delete" onClick={() => handleDelete(id)}>
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <i className="fas fa-folder-open"></i>
            <h3>No data found</h3>
            <p>There are no records to display.</p>
            <button className="add-button" onClick={activeTab === "actors" ? handleAddEmployee : handleAddCustomer}>
              <i className="fas fa-plus"></i> Add New {activeTab === "actors" ? "Employee" : "Customer"}
            </button>
          </div>
        )}
      </div>
 
      {/* Add New Employee Modal */}
      {isAddingActor && (
        <div className="modal-overlay">
          <div className="modal-content">
            <AddEmployeeForm
              onClose={() => setIsAddingActor(false)}
              onSuccess={handleSuccess}
            />
          </div>
        </div>
      )}
 
      {/* Add New Customer Modal */}
      {isAddingCustomer && (
        <div className="modal-overlay">
          <div className="modal-content">
            <AddCustomerForm
              onClose={() => setIsAddingCustomer(false)}
              onSuccess={handleSuccess}
            />
          </div>
        </div>
      )}
 
      {/* Add a note if we're in the workflow process */}
      {isInWorkflow && (
        <div className="workflow-note">
          <p>You're in step 3 of the workflow. Please assign an employee to continue.</p>
        </div>
      )}
 
      {/* Add Employee Assignment Form Modal */}
      {showAssignForm && assigningCustomer && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="form-container">
              <h2><i className="fas fa-user-plus"></i> Assign Auditor to {assigningCustomer.name}</h2>
             
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const employeeId = formData.get('employee_id');
               
                // Call the handleAssignEmployee function with the form data
                handleAssignEmployee({
                  customer_id: assigningCustomer.id,
                  employee_id: employeeId
                });
               
                // Close the form
                setShowAssignForm(false);
              }}>
                <div className="form-group">
                  <label htmlFor="employee_id">Select Auditor</label>
                  <select
                    id="employee_id"
                    name="employee_id"
                    required
                  >
                    <option value="">-- Select an Auditor --</option>
                    {data.actors && data.actors.map(employee => (
                      <option key={employee.actor_id} value={employee.actor_id}>
                        {employee.actor_name}
                      </option>
                    ))}
                  </select>
                </div>
               
                <div className="form-actions">
                  <button type="button" className="btn-cancel" onClick={() => setShowAssignForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-submit">
                    <i className="fas fa-save"></i>
                    <span>Assign Auditor</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
 
      {/* Add Report Modal */}
      {showReportModal && selectedEmployee && (
        <div className="modal-overlay">
          <div className="report-modal">
            <div className="modal-header">
              <h2>
                <i className="fas fa-chart-pie"></i>
                Performance Report - {selectedEmployee.actor_name}
              </h2>
              <button className="close-btn" onClick={() => setShowReportModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="report-content">
              <div className="report-table">
                <table>
                  <thead>
                    <tr>
                      <th>Activity ID</th>
                      <th>Activity Name</th>
                      <th>Task ID</th>
                      <th>Date of Completion</th>
                      <th>Time Taken</th>
                      <th>Standard Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.map(task => (
                      <tr 
                        key={task.task_id}
                        className={selectedStatus === task.status ? 'highlighted' : ''}
                      >
                        <td>{task.activity_id}</td>
                        <td>{task.activity_name}</td>
                        <td>{task.task_id}</td>
                        <td>{task.completion_date}</td>
                        <td>{task.time_taken}</td>
                        <td>{task.standard_time}</td>
                        <td className={`status-${task.status.toLowerCase()}`}>
                          {task.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="report-chart">
                <div className="pie-chart-container">
                  <PieChart
                    data={[
                      {
                        title: 'ON-TIME',
                        value: performanceData.filter(t => t.status === 'ON-TIME').length,
                        color: '#3498db'
                      },
                      {
                        title: 'EARLY',
                        value: performanceData.filter(t => t.status === 'EARLY').length,
                        color: '#1a5e2d'
                      },
                      {
                        title: 'DELAY',
                        value: performanceData.filter(t => t.status === 'DELAY').length,
                        color: '#e74c3c'
                      }
                    ]}
                    onSegmentClick={handlePieSegmentClick}
                    selectedSegment={selectedStatus}
                  />
                  <div className="pie-chart-legend">
                    <div className="legend-item delay">Delay</div>
                    <div className="legend-item on-time">On Time</div>
                    <div className="legend-item early">Early</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
 
export default Employee;

const PieChart = ({ data, onSegmentClick, selectedSegment }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;

  return (
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
  );
};