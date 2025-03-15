import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './FormStyles.css';

const AddEmployeeForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    actor_name: '',
    gender: 'Male',
    DOB: '',
    mobile1: '',
    mobile2: '',
    email_id: '',
    password: '',
    group_id: '',
    role_id: '22', // Default role (non-admin)
    status: 'A'  // Active by default
  });
  
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  
  useEffect(() => {
    // Fetch groups for dropdown
    const fetchGroups = async () => {
      try {
        const response = await axios.get('/groups');
        setGroups(response.data);
      } catch (err) {
        console.error('Error fetching groups:', err);
      }
    };
    
    fetchGroups();
  }, []);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: null
      });
    }
  };
  
  const validateForm = () => {
    const errors = {};
    
    if (!formData.actor_name.trim()) {
      errors.actor_name = 'Name is required';
    }
    
    if (!formData.mobile1.trim()) {
      errors.mobile1 = 'Primary phone number is required';
    } else if (!/^\d{10}$/.test(formData.mobile1)) {
      errors.mobile1 = 'Phone number must be 10 digits';
    }
    
    if (!formData.email_id.trim()) {
      errors.email_id = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email_id)) {
      errors.email_id = 'Email is invalid';
    }
    
    if (!formData.password.trim()) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Change endpoint to match Flask API
      const response = await axios.post('/add_actor', formData);
      
      if (response.status === 201) {
        onSuccess('Employee added successfully!');
        onClose();
      }
    } catch (err) {
      console.error('Error adding employee:', err);
      const errorMessage = err.response?.data?.error || 'Failed to add employee. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="form-container">
      <h2><i className="fas fa-user-plus"></i> Add New Employee</h2>
      
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i>
          <span>{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="actor_name">
              Full Name <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <i className="fas fa-user"></i>
              <input
                type="text"
                id="actor_name"
                name="actor_name"
                value={formData.actor_name}
                onChange={handleChange}
                placeholder="Enter full name"
                className={formErrors.actor_name ? 'error' : ''}
              />
            </div>
            {formErrors.actor_name && <div className="error-text">{formErrors.actor_name}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="gender">Gender</label>
            <div className="input-with-icon">
              <i className="fas fa-venus-mars"></i>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="DOB">Date of Birth</label>
            <div className="input-with-icon">
              <i className="fas fa-calendar-alt"></i>
              <input
                type="date"
                id="DOB"
                name="DOB"
                value={formData.DOB}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="mobile1">
              Primary Phone <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <i className="fas fa-phone"></i>
              <input
                type="tel"
                id="mobile1"
                name="mobile1"
                value={formData.mobile1}
                onChange={handleChange}
                placeholder="Enter primary phone"
                className={formErrors.mobile1 ? 'error' : ''}
              />
            </div>
            {formErrors.mobile1 && <div className="error-text">{formErrors.mobile1}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="mobile2">Secondary Phone</label>
            <div className="input-with-icon">
              <i className="fas fa-phone-alt"></i>
              <input
                type="tel"
                id="mobile2"
                name="mobile2"
                value={formData.mobile2}
                onChange={handleChange}
                placeholder="Enter secondary phone (optional)"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="email_id">
              Email <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <i className="fas fa-envelope"></i>
              <input
                type="email"
                id="email_id"
                name="email_id"
                value={formData.email_id}
                onChange={handleChange}
                placeholder="Enter email address"
                className={formErrors.email_id ? 'error' : ''}
              />
            </div>
            {formErrors.email_id && <div className="error-text">{formErrors.email_id}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="password">
              Password <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <i className="fas fa-lock"></i>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password"
                className={formErrors.password ? 'error' : ''}
              />
            </div>
            {formErrors.password && <div className="error-text">{formErrors.password}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="group_id">Group</label>
            <div className="input-with-icon">
              <i className="fas fa-users"></i>
              <select
                id="group_id"
                name="group_id"
                value={formData.group_id}
                onChange={handleChange}
              >
                <option value="">Select a group</option>
                {groups.map(group => (
                  <option key={group.group_id} value={group.group_id}>
                    {group.group_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="role_id">Role</label>
            <div className="input-with-icon">
              <i className="fas fa-user-tag"></i>
              <select
                id="role_id"
                name="role_id"
                value={formData.role_id}
                onChange={handleChange}
              >
                <option value="22">Employee</option>
                <option value="11">Administrator</option>
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="status">Status</label>
            <div className="input-with-icon">
              <i className="fas fa-toggle-on"></i>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="A">Active</option>
                <option value="I">Inactive</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner-small"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                <span>Save Employee</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddEmployeeForm;
