import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AssignActivityForm.css';

const AssignActivityForm = ({ customerId, activityId, activityName, customerName, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        assignTo: '',
        status: 'Yet to Start',
        link: '',
        remarks: '',
        frequency: '1' // Default to Yearly
    });
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Load employees first
                const employeesResponse = await axios.get('/actors');
                setEmployees(employeesResponse.data);
                
                // Set default assignee if employees exist
                if (employeesResponse.data.length > 0) {
                    setFormData(prev => ({
                        ...prev,
                        assignTo: employeesResponse.data[0].actor_name
                    }));
                }
                
                // Try to fetch frequency, but don't fail if it doesn't work
                try {
                    console.log(`Trying to fetch frequency for activity ID: ${activityId}`);
                    const frequencyResponse = await axios.get(`/get_frequency/${activityId}`);
                    
                    if (frequencyResponse.data && frequencyResponse.data.frequency) {
                        setFormData(prev => ({
                            ...prev,
                            frequency: String(frequencyResponse.data.frequency)
                        }));
                    }
                } catch (freqError) {
                    console.warn(`Could not fetch frequency from API: ${freqError}`);
                    // Try to get frequency from another source if needed
                    // For now we'll just use the default value of 1 (Yearly)
                }
                
                setLoading(false);
            } catch (err) {
                console.error('Error loading data:', err);
                setError('Failed to load necessary data');
                setLoading(false);
            }
        };
        
        loadData();
    }, [activityId]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const getFrequencyLabel = (value) => {
        const frequencyMap = {
            "0": "Onetime",
            "1": "Yearly",
            "12": "Monthly",
            "4": "Quarterly",
            "26": "Fortnightly",
            "52": "Weekly",
            "365": "Daily",
            "3": "Every 4 Months",
            "6": "Every 2 Months"
        };
        return frequencyMap[value] || "Unknown"; 
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
                        <label>Frequency:</label>
                        <input 
                            type="text"
                            name="frequency"
                            value={getFrequencyLabel(formData.frequency)} 
                            readOnly 
                            className="read-only-input"
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