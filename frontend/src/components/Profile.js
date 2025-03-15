import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Profile.css';

const PasswordChangeModal = ({ isOpen, onClose, onSubmit }) => {
  const [step, setStep] = useState('verify'); // 'verify' or 'change'
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setPasswordData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/verify_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current_password: passwordData.currentPassword })
      });
      const data = await response.json();
      if (data.success) {
        setStep('change');
        setError('');
      } else {
        setError(data.message || 'Verification failed');
      }
    } catch (err) {
      setError('Failed to verify password');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    onSubmit(passwordData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Change Password</h3>
        {error && <div className="error-message">{error}</div>}
        
        {step === 'verify' ? (
          <form onSubmit={handleVerify}>
            <div className="form-group">
              <label>Current Password:</label>
              <input
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handleChange}
                required
              />
            </div>
            <div className="button-group">
              <button type="submit">Verify</button>
              <button type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>New Password:</label>
              <input
                type="password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Confirm Password:</label>
              <input
                type="password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
            <div className="button-group">
              <button type="submit">Update Password</button>
              <button type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const Profile = () => {
  const { user } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [userData, setUserData] = useState(null);
  const [formData, setFormData] = useState({
    email_id: '',
    mobile1: ''
  });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setUserData(data.user);
        setFormData({
          email_id: data.user.email_id || '',
          mobile1: data.user.mobile1 || ''
        });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to fetch user data' });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Error fetching user data' });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setEditMode(false);
        fetchUserData();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    }
  };

  const handlePasswordChange = async (passwordData) => {
    try {
      const response = await fetch('/changepassword', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          new_password: passwordData.newPassword,
          confirm_new_password: passwordData.confirmPassword
        })
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setShowPasswordModal(false);
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password' });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <h2>Profile Information</h2>
        
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="profile-info">
          <div className="info-group">
            <label>Name:</label>
            <span>{userData?.actor_name || 'N/A'}</span>
          </div>
          <div className="info-group">
            <label>Gender:</label>
            <span>{userData?.gender || 'N/A'}</span>
          </div>
          <div className="info-group">
            <label>Date of Birth:</label>
            <span>{formatDate(userData?.DOB)}</span>
          </div>

          <form onSubmit={handleUpdateProfile}>
            <div className="info-group">
              <label>Email:</label>
              {editMode ? (
                <input
                  type="email"
                  name="email_id"
                  value={formData.email_id}
                  onChange={handleInputChange}
                />
              ) : (
                <span>{formData.email_id || userData?.email_id || 'N/A'}</span>
              )}
            </div>
            <div className="info-group">
              <label>Mobile:</label>
              {editMode ? (
                <input
                  type="tel"
                  name="mobile1"
                  value={formData.mobile1}
                  onChange={handleInputChange}
                />
              ) : (
                <span>{formData.mobile1 || userData?.mobile1 || 'N/A'}</span>
              )}
            </div>

            <div className="button-group">
              {editMode ? (
                <>
                  <button type="submit" className="btn-save">Save Changes</button>
                  <button type="button" className="btn-cancel" onClick={() => setEditMode(false)}>Cancel</button>
                </>
              ) : (
                <button type="button" className="btn-edit" onClick={() => setEditMode(true)}>Edit Profile</button>
              )}
              <button
                type="button"
                className="btn-change-password"
                onClick={() => setShowPasswordModal(true)}
              >
                Change Password
              </button>
            </div>
          </form>
        </div>
      </div>

      <PasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSubmit={handlePasswordChange}
      />
    </div>
  );
};

export default Profile; 