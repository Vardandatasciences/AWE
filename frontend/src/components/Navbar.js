import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css'; // Import CSS for styling
import aweLogo from '../assets/image.png';

const Navbar = () => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link to="/">
            <i className="fas fa-tasks"></i>
            <span>ProSync</span>
          </Link>
        </div>
        
        <div className="navbar-actions">
          {isAuthenticated ? (
            <div 
              className="user-profile" 
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="user-avatar">
                <i className="fas fa-user-circle"></i>
              </div>
              <span className="user-name">Ahmed</span>
              <i className={`fas fa-chevron-${showUserMenu ? 'up' : 'down'}`}></i>
              
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-info">
                    <div className="user-avatar-large">
                      <i className="fas fa-user-circle"></i>
                    </div>
                    <div>
                      <h4>Ahmed</h4>
                      <p>{user?.email || ''}</p>
                      <span className="user-role">{user?.role || 'User'}</span>
                    </div>
                  </div>
                  
                  <ul className="dropdown-menu">
                    <li>
                      <Link to="/profile">
                        <i className="fas fa-user-cog"></i>
                        <span>Profile</span>
                      </Link>
                    </li>
                    <li>
                      <Link to="/settings">
                        <i className="fas fa-cog"></i>
                        <span>Settings</span>
                      </Link>
                    </li>
                    <li className="divider"></li>
                    <li>
                      <button onClick={handleLogout} className="logout-btn">
                        <i className="fas fa-sign-out-alt"></i>
                        <span>Logout</span>
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="login-btn">
              <i className="fas fa-sign-in-alt"></i>
              <span>Login</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;