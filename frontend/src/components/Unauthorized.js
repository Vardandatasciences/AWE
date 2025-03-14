import React from 'react';
import { Link } from 'react-router-dom';
import './Unauthorized.css';

const Unauthorized = () => {
  return (
    <div className="unauthorized-container">
      <div className="unauthorized-content">
        <div className="icon-container">
          <i className="fas fa-lock"></i>
        </div>
        <h1>Access Denied</h1>
        <p>You don't have permission to access this page.</p>
        <p>Please contact your administrator if you believe this is an error.</p>
        <div className="action-buttons">
          <Link to="/" className="btn-primary">
            <i className="fas fa-home"></i> Go to Home
          </Link>
          <Link to="/tasks" className="btn-secondary">
            <i className="fas fa-tasks"></i> My Tasks
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized; 