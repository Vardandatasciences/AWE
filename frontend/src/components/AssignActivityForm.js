import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AssignActivityForm.css';

const AssignActivityForm = ({ customerId, activityId, activityName, customerName, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        assignTo: '',
        status: 'Yet to Start',
        link: '',
        remarks: '',
        frequency: '1'
    });
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const response = await axios.get('/actors');
            setEmployees(response.data);
            // Set default assignee if employees exist
            if (response.data.length > 0) {
                setFormData(prev => ({
                    ...prev,
                    assignTo: response.data[0].actor_name
                }));
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching employees:', error);
            setError('Failed to load employees');
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            // Create form data for the API call
            const formDataToSend = new FormData();
            formDataToSend.append('task_name', activityId);
            formDataToSend.append('assigned_to', formData.assignTo);
            formDataToSend.append('customer_id', customerId);
            formDataToSend.append('remarks', formData.remarks);
            formDataToSend.append('link', formData.link);
            formDataToSend.append('frequency', formData.frequency);
            formDataToSend.append('status', formData.status);
            
            // Call the API to assign the activity
            const response = await axios.post('/assign_activity', formDataToSend);
            
            if (response.data.success) {
                // Call the success callback with the response
                onSuccess(response.data);
            } else {
                setError(response.data.message || 'Failed to assign activity');
            }
        } catch (error) {
            console.error('Error assigning activity:', error);
            setError(error.response?.data?.message || 'An error occurred while assigning the activity');
        }
    };

    if (loading) {
        return (
            <div className="assign-form-modal">
                <div className="assign-form-container">
                    <div className="loading-spinner"></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="assign-form-modal">
            <div className="assign-form-container">
                <h2>Assign Activity</h2>
                
                {error && (
                    <div className="error-message">
                        <i className="fas fa-exclamation-circle"></i>
                        <span>{error}</span>
                    </div>
                )}
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Assign To:</label>
                        <select 
                            name="assignTo" 
                            value={formData.assignTo} 
                            onChange={handleInputChange}
                            required
                        >
                            <option value="">Select Assignee</option>
                            {employees.map(emp => (
                                <option key={emp.actor_id} value={emp.actor_name}>
                                    {emp.actor_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="form-group">
                        <label>Status:</label>
                        <div className="status-field">
                            Yet to Start
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label>Link (Optional):</label>
                        <input 
                            type="text" 
                            name="link" 
                            value={formData.link} 
                            onChange={handleInputChange}
                            placeholder="Enter link"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Remarks (Optional):</label>
                        <textarea 
                            name="remarks" 
                            value={formData.remarks} 
                            onChange={handleInputChange}
                            placeholder="Enter remarks"
                            rows="3"
                        ></textarea>
                    </div>
                    
                    <div className="form-group">
                        <label>Frequency (days):</label>
                        <input 
                            type="number" 
                            name="frequency" 
                            value={formData.frequency} 
                            onChange={handleInputChange}
                            min="1"
                            required
                        />
                    </div>
                    
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-assign">
                            Assign
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AssignActivityForm; 