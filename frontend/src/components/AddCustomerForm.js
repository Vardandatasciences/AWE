import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './FormStyles.css';

const AddCustomerForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_type: 'Business',
    gender: '',
    DOB: '',
    email_id: '',
    mobile1: '',
    mobile2: '',
    address: '',
    city: '',
    pincode: '',
    country: 'India',
    group_id: '',
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
    
    if (!formData.customer_name.trim()) {
      errors.customer_name = 'Customer name is required';
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
    
    // Create a copy of the form data to modify before sending
    const submissionData = { ...formData };
    
    // Handle empty values properly
    if (!submissionData.gender) {
      submissionData.gender = '';
    }
    
    // Handle empty group_id
    if (!submissionData.group_id) {
      submissionData.group_id = null;
    } else {
      // Ensure group_id is a number if provided
      submissionData.group_id = parseInt(submissionData.group_id, 10);
    }
    
    // Ensure DOB is in the correct format or null if empty
    if (!submissionData.DOB) {
      submissionData.DOB = null;
    }
    
    try {
      const response = await axios.post('/add_customer', submissionData);
      
      if (response.status === 201) {
        onSuccess('Customer added successfully!');
        onClose();
      }
    } catch (err) {
      console.error('Error adding customer:', err);
      setError(err.response?.data?.error || 'Failed to add customer. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="form-container">
      <h2><i className="fas fa-building"></i> Add New Customer</h2>
      
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i>
          <span>{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="customer_name">
              Customer Name <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <i className="fas fa-building"></i>
              <input
                type="text"
                id="customer_name"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleChange}
                placeholder="Enter customer name"
                className={formErrors.customer_name ? 'error' : ''}
              />
            </div>
            {formErrors.customer_name && <div className="error-text">{formErrors.customer_name}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="customer_type">Customer Type</label>
            <div className="input-with-icon">
              <i className="fas fa-tag"></i>
              <select
                id="customer_type"
                name="customer_type"
                value={formData.customer_type}
                onChange={handleChange}
              >
                <option value="Business">Business</option>
                <option value="Individual">Individual</option>
                <option value="Government">Government</option>
                <option value="Non-profit">Non-profit</option>
              </select>
            </div>
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
                <option value="">Not Applicable</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="DOB">Date of Establishment</label>
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
            <label htmlFor="address">Address</label>
            <div className="input-with-icon">
              <i className="fas fa-map-marker-alt"></i>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter address"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="city">City</label>
            <div className="input-with-icon">
              <i className="fas fa-city"></i>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Enter city"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="pincode">Pincode</label>
            <div className="input-with-icon">
              <i className="fas fa-map-pin"></i>
              <input
                type="text"
                id="pincode"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                placeholder="Enter pincode"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="country">Country</label>
            <div className="input-with-icon">
              <i className="fas fa-globe"></i>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="Enter country"
              />
            </div>
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
                <span>Save Customer</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddCustomerForm; 