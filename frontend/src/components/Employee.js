import React, { useState, useEffect } from "react";
import "./Employee.css";
import axios from "axios";
import AddEmployeeForm from './AddEmployeeForm';
import AddCustomerForm from './AddCustomerForm';

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
  const [stats, setStats] = useState({
    actors: { total: 0, active: 0, inactive: 0 },
    customers: { total: 0, active: 0, inactive: 0 }
  });

  useEffect(() => {
    // Load both data types on component mount
    fetchData("actors");
    fetchData("customers");
  }, []);

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
        (filterStatus === "inactive" && item.status === "I");
      
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
            <h3 className="stat-title">Employees</h3>
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
            <h3 className="stat-title">Customers</h3>
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
              <span>New Employee</span>
            </button>
            <button className="quick-action-btn" onClick={handleAddCustomer}>
              <i className="fas fa-building"></i>
              <span>New Customer</span>
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
                <i className="fas fa-user-tie"></i> Employees
              </button>
              <button 
                className={`tab ${activeTab === "customers" ? "active" : ""}`}
                onClick={() => handleTabChange("customers")}
              >
                <i className="fas fa-building"></i> Customers
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
    </div>
  );
};

export default Employee;