import React, { useState, useEffect } from "react";
import "./Employee.css";
import axios from "axios";
import AddEmployeeForm from './AddEmployeeForm';
import AddCustomerForm from './AddCustomerForm';

const Employee = () => {
  const [data, setData] = useState([]);
  const [category, setCategory] = useState("");
  const [editIndex, setEditIndex] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [isAddingActor, setIsAddingActor] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [successMessage, setSuccessMessage] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [performanceData, setPerformanceData] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);

  useEffect(() => {
    if (category) {
      fetchData(category);
    }
  }, [category]);

  const fetchData = async (cat) => {
    setLoading(true);
    try {
      let response;
      if (cat === "actors") {
        response = await axios.get("/actors");
      } else if (cat === "customers") {
        response = await axios.get("/customers");
      }
      setData(response.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle category change
  const handleCategoryChange = (e) => {
    setCategory(e.target.value);
    setEditIndex(null);
    setEditedData({});
    setSearchTerm("");
    setFilterStatus("all");
  };

  // Filter and search functionality
  const filteredData = data.filter(item => {
    const statusMatch = filterStatus === "all" || 
      (filterStatus === "active" && item.status === "A") ||
      (filterStatus === "inactive" && item.status === "I");
    
    const searchMatch = searchTerm === "" || 
      (item.actor_name && item.actor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.customer_name && item.customer_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return statusMatch && searchMatch;
  });

  // Edit handlers
  const handleEdit = (index) => {
    setEditIndex(index);
    setEditedData({ ...data[index] });
  };

  const handleSave = async () => {
    // Save logic would go here
    setEditIndex(null);
  };

  const handleDelete = async (id) => {
    // Delete logic would go here
  };

  const handleAdd = () => {
    if (category === "actors") {
      setIsAddingActor(true);
    } else if (category === "customers") {
      setIsAddingCustomer(true);
    }
  };
  
  const handleSuccess = (message) => {
    setSuccessMessage(message);
    // Refresh data
    fetchData(category);
    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
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
      // Show loading indicator or message if needed
      
      // Call the correct endpoint that generates the PDF with table and pie chart
      const response = await axios.get(`/download-performance/${employee.actor_id}`, {
        responseType: 'blob' // Important: set responseType to 'blob'
      });
      
      // Create a blob URL from the response data
      const url = window.URL.createObjectURL(new Blob([response.data]));
      
      // Create a temporary link element to trigger the download
      const link = document.createElement('a');
      link.href = url;
      
      // Set the filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${currentDate}_${employee.actor_name}_Performance.pdf`);
      
      // Append to body, click to download, then remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report. Please try again.');
    }
  };

  const handlePieSegmentClick = (status) => {
    setSelectedStatus(status === selectedStatus ? null : status);
  };

  return (
    <div className="employee-container">
      {successMessage && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i>
          <span>{successMessage}</span>
        </div>
      )}
      
      <div className="page-header">
        <h1><i className="fas fa-users"></i> Employee Management</h1>
        <p>Manage your employees and customers in one place</p>
      </div>

      <div className="control-panel">
        <div className="select-wrapper">
          <select value={category} onChange={handleCategoryChange} className="category-select">
            <option value="">Select Category</option>
            <option value="actors">Employees</option>
            <option value="customers">Customers</option>
          </select>
          <i className="fas fa-chevron-down"></i>
        </div>

        {category && (
          <>
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
              
              <button className="add-button" onClick={handleAdd}>
                <i className="fas fa-plus"></i> Add New
              </button>
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading data...</p>
        </div>
      ) : category === "actors" && filteredData.length > 0 ? (
        <div className="card-grid">
          {filteredData.map((actor, index) => (
            <div className={`card ${actor.status === 'A' ? 'active-card' : 'inactive-card'}`} key={actor.actor_id}>
              <div className="card-header">
                <div className="avatar">
                  <i className="fas fa-user"></i>
                </div>
                <div className="status-indicator" title={actor.status === 'A' ? 'Active' : 'Inactive'}>
                  <i className={`fas fa-circle ${actor.status === 'A' ? 'status-active' : 'status-inactive'}`}></i>
                </div>
                <button 
                  className="report-btn" 
                  onClick={() => handleShowReport(actor)}
                  title="View Employee Performance Report"
                >
                  <i className="fas fa-chart-pie"></i>
                </button>
              </div>
              
              {editIndex === index ? (
                <div className="card-edit-form">
                  <input
                    type="text"
                    value={editedData.actor_name || ''}
                    onChange={(e) => setEditedData({...editedData, actor_name: e.target.value})}
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
                    <h3>{actor.actor_name}</h3>
                    <div className="detail-item">
                      <i className="fas fa-envelope"></i>
                      <span>{actor.email_id}</span>
                    </div>
                    <div className="detail-item">
                      <i className="fas fa-phone"></i>
                      <span>{actor.mobile1}</span>
                    </div>
                    <div className="detail-item">
                      <i className="fas fa-map-marker-alt"></i>
                      <span>{actor.city || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button className="btn-edit" onClick={() => handleEdit(index)} title="Edit Employee">
                      <i className="fas fa-edit"></i>
                    </button>
                    <button className="btn-download" onClick={() => handleDownloadReport(actor)} title="Download Performance Report">
                      <i className="fas fa-download"></i>
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(actor.actor_id)} title="Delete Employee">
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : category === "customers" && filteredData.length > 0 ? (
        <div className="card-grid">
          {filteredData.map((customer, index) => (
            <div className={`card ${customer.status === 'A' ? 'active-card' : 'inactive-card'}`} key={customer.customer_id}>
              <div className="card-header">
                <div className="avatar customer-avatar">
                  <i className="fas fa-building"></i>
                </div>
                <div className="status-indicator" title={customer.status === 'A' ? 'Active' : 'Inactive'}>
                  <i className={`fas fa-circle ${customer.status === 'A' ? 'status-active' : 'status-inactive'}`}></i>
                </div>
              </div>
              
              {editIndex === index ? (
                <div className="card-edit-form">
                  <input
                    type="text"
                    value={editedData.customer_name || ''}
                    onChange={(e) => setEditedData({...editedData, customer_name: e.target.value})}
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
                    <h3>{customer.customer_name}</h3>
                    <div className="detail-item">
                      <i className="fas fa-envelope"></i>
                      <span>{customer.email_id}</span>
                    </div>
                    <div className="detail-item">
                      <i className="fas fa-phone"></i>
                      <span>{customer.mobile1}</span>
                    </div>
                    <div className="detail-item">
                      <i className="fas fa-map-marker-alt"></i>
                      <span>{customer.city || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button className="btn-edit" onClick={() => handleEdit(index)}>
                      <i className="fas fa-edit"></i>
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(customer.customer_id)}>
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : category ? (
        <div className="empty-state">
          <i className="fas fa-folder-open"></i>
          <h3>No data found</h3>
          <p>There are no records to display.</p>
          <button className="add-button" onClick={handleAdd}>
            <i className="fas fa-plus"></i> Add New {category === "actors" ? "Employee" : "Customer"}
          </button>
        </div>
      ) : (
        <div className="welcome-state">
          <i className="fas fa-users-cog"></i>
          <h2>Welcome to Employee Management</h2>
          <p>Select a category to get started</p>
        </div>
      )}

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

export default Employee;