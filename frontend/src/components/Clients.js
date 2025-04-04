import React, { useState, useEffect } from 'react';
import "./Clients.css";
import axios from "axios";
import AddCustomerForm from './AddCustomerForm';
import { useNavigate } from 'react-router-dom';
import SubNav from './SubNav';

const Clients = () => {
  const [data, setData] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [successMessage, setSuccessMessage] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0
  });
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/customers");
      setData(response.data);
      
      // Calculate stats
      const total = response.data.length;
      const active = response.data.filter(item => item.status === "A").length;
      setStats({
        total,
        active,
        inactive: total - active
      });
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search functionality
  const getFilteredData = () => {
    return data.filter(item => {
      const statusMatch = filterStatus === "all" ||
        (filterStatus === "active" && item.status === "A") ||
        (filterStatus === "inactive" && item.status === "O");
      
      const searchMatch = searchTerm === "" ||
        (item.customer_name && item.customer_name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return statusMatch && searchMatch;
    });
  };

  const handleEdit = (index) => {
    setEditIndex(index);
    setEditedData({ ...data[index] });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await axios.put("/update_customer", editedData);
      
      if (response.status === 200) {
        const updatedData = [...data];
        const index = updatedData.findIndex(item => item.customer_id === editedData.customer_id);
        if (index !== -1) {
          updatedData[index] = editedData;
          setData(updatedData);
        }
        
        handleSuccess("Client updated successfully");
        setEditIndex(null);
        setEditedData({});
        fetchData();
      }
    } catch (err) {
      console.error("Error updating client:", err);
      alert("Failed to update client. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const item = data.find(item => item.customer_id === id);
    setItemToDelete(item);
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      setIsDeleting(true);
      const response = await axios.delete(`/delete_customer/${itemToDelete.customer_id}`);
      
      if (response.status === 200) {
        const updatedData = data.filter(item => item.customer_id !== itemToDelete.customer_id);
        setData(updatedData);
        handleSuccess("Client deleted successfully");
        fetchData();
      }
    } catch (err) {
      console.error("Error deleting client:", err);
      alert("Failed to delete client. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirmModal(false);
      setItemToDelete(null);
    }
  };

  const handleSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const handleAddCustomer = () => {
    setIsAddingCustomer(true);
  };

  const handleDownloadClientReport = async (customer) => {
    try {
      const response = await axios.get(`/download-customer-report/${customer.customer_id}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const currentDate = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${currentDate}_${customer.customer_name}_Report.pdf`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading client report:', error);
      alert('Failed to download client report. Please try again.');
    }
  };

  return (
    <>
      <SubNav />
      <div className="employee-container">
        {successMessage && (
          <div className="success-message">
            <i className="fas fa-check-circle"></i>
            <span>{successMessage}</span>
          </div>
        )}

        <div className="quick-stats-section">
          <div className="stat-card customer-stat">
            <div className="stat-icon">
              <i className="fas fa-building"></i>
            </div>
            <div className="stat-content">
              <div className="stat-numbers">
                <span className="stat-count">{stats.total}</span>
                <div className="stat-details">
                  <div className="stat-detail">
                    <span className="detail-dot active"></span>
                    <span>{stats.active} Active</span>
                  </div>
                  <div className="stat-detail">
                    <span className="detail-dot inactive"></span>
                    <span>{stats.inactive} Inactive</span>
                  </div>
                </div>
              </div>
              <h3 className="stat-title">Clients</h3>
            </div>
          </div>

          <div className="quick-actions">
            <h3><i className="fas fa-bolt"></i> Quick Actions</h3>
            <div className="action-buttons">
              <button className="quick-action-btn" onClick={handleAddCustomer}>
                <i className="fas fa-building"></i>
                <span>New Client</span>
              </button>
            </div>
          </div>
        </div>

        <div className="main-content-section">
          <div className="content-header">
            <div className="unified-controls">
              <div className="search-filter-container">
                <div className="search-box">
                  <i className="fas fa-search"></i>
                  <input
                    type="text"
                    placeholder="Search clients..."
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
              <p>Loading clients...</p>
            </div>
          ) : getFilteredData().length > 0 ? (
            <div className="card-grid">
              {getFilteredData().map((item, index) => (
                <div className={`card ${item.status === 'A' ? 'active-card' : 'inactive-card'}`} key={item.customer_id}>
                  <div className="card-header">
                    <div className="avatar customer-avatar">
                      <i className="fas fa-building"></i>
                    </div>
                    <div className="status-indicator" title={item.status === 'A' ? 'Active' : 'Inactive'}>
                      <i className={`fas fa-circle ${item.status === 'A' ? 'status-active' : 'status-inactive'}`}></i>
                    </div>
                  </div>
                  
                  {editIndex === index ? (
                    <div className="card-edit-form">
                      <input
                        type="text"
                        value={editedData.customer_name || ''}
                        onChange={(e) => setEditedData({...editedData, customer_name: e.target.value})}
                        placeholder="Name"
                        className="form-input"
                      />
                      <input
                        type="email"
                        value={editedData.email_id || ''}
                        onChange={(e) => setEditedData({...editedData, email_id: e.target.value})}
                        placeholder="Email"
                        className="form-input"
                      />
                      <input
                        type="text"
                        value={editedData.mobile1 || ''}
                        onChange={(e) => setEditedData({...editedData, mobile1: e.target.value})}
                        placeholder="Phone"
                        className="form-input"
                      />
                      <input
                        type="text"
                        value={editedData.city || ''}
                        onChange={(e) => setEditedData({...editedData, city: e.target.value})}
                        placeholder="City"
                        className="form-input"
                      />
                      <select
                        value={editedData.status || 'A'}
                        onChange={(e) => setEditedData({...editedData, status: e.target.value})}
                        className="form-select"
                      >
                        <option value="A">Active</option>
                        <option value="O">Inactive</option>
                      </select>
                      <div className="form-actions">
                        <button 
                          className="btn-save" 
                          onClick={handleSave}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <>
                              <i className="fas fa-spinner fa-spin"></i> Saving...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-check"></i> Save
                            </>
                          )}
                        </button>
                        <button 
                          className="btn-cancel" 
                          onClick={() => setEditIndex(null)}
                          disabled={isSaving}
                        >
                          <i className="fas fa-times"></i> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="card-body">
                        <h3>{item.customer_name}</h3>
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
                        <button
                          className="btn-download"
                          onClick={() => handleDownloadClientReport(item)}
                          title="Download Client Report"
                        >
                          <i className="fas fa-download"></i>
                        </button>
                        <button 
                          className="btn-delete" 
                          onClick={() => handleDelete(item.customer_id)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <i className="fas fa-spinner fa-spin"></i>
                          ) : (
                            <i className="fas fa-trash-alt"></i>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <i className="fas fa-folder-open"></i>
              <h3>No clients found</h3>
              <p>There are no clients to display.</p>
              <button className="add-button" onClick={handleAddCustomer}>
                <i className="fas fa-plus"></i> Add New Client
              </button>
            </div>
          )}
        </div>

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

        {showDeleteConfirmModal && itemToDelete && (
          <div className="modal-overlay">
            <div className="modal-content delete-confirm-modal">
              <div className="modal-header">
                <h2>
                  <i className="fas fa-exclamation-triangle"></i>
                  Confirm Delete
                </h2>
                <button className="close-btn" onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setItemToDelete(null);
                }}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div className="modal-body">
                <div className="confirmation-message">
                  <p>
                    <div className="message-line">
                      <i className="fas fa-info-circle"></i>
                      <span style={{ display: 'inline' }}>
                        Are you sure you want to delete <strong style={{ display: 'inline' }}>{itemToDelete.customer_name}</strong>
                      </span>
                    </div>
                  </p>
                  
                  <div className="modal-actions">
                    <button 
                      className="btn-cancel" 
                      onClick={() => {
                        setShowDeleteConfirmModal(false);
                        setItemToDelete(null);
                      }}
                    >
                      <i className="fas fa-times"></i>
                      Cancel
                    </button>
                    <button 
                      className="btn-delete" 
                      onClick={confirmDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          Deleting...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-trash-alt"></i>
                          Confirm Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Clients; 