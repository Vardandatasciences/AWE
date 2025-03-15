import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Login.css';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [actorId, setActorId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await axios.post('http://localhost:5000/login', {
        actorId,
        password
      });
      
      // Store token and user info
      login(response.data.token, response.data.user);
      
      // Redirect to the page they were trying to access or home
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
      
    } catch (err) {
      console.error('Login error:', err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-container">
            <div className="logo-icon">
              <i className="fas fa-tasks"></i>
            </div>
            <h1>AWE</h1>
          </div>
          <h2>Welcome Back</h2>
          <p>Enter your credentials to access your account</p>
        </div>
        
        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}
        
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="actorId">
              <i className="fas fa-user"></i> Actor ID
            </label>
            <input
              type="text"
              id="actorId"
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              placeholder="Enter your Actor ID"
              required
              className="input-field"
            />
            <div className="input-animation"></div>
          </div>
          
          <div className="form-group">
            <label htmlFor="password">
              <i className="fas fa-lock"></i> Password
            </label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="input-field"
              />
              <button 
                type="button" 
                className="password-toggle" 
                onClick={togglePasswordVisibility}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            <div className="input-animation"></div>
          </div>
          
          <div className="form-options">
            <div className="remember-me">
              <input type="checkbox" id="remember" />
              <label htmlFor="remember">Remember me</label>
            </div>
            <a href="#" className="forgot-password">Forgot password?</a>
          </div>
          
          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <><i className="fas fa-spinner fa-spin"></i> Logging in...</>
            ) : (
              <>Sign In <i className="fas fa-arrow-right"></i></>
            )}
          </button>
        </form>
        
        <div className="login-footer">
          <p>Don't have an account? <a href="#">Contact administrator</a></p>
        </div>
      </div>
      
      <div className="login-features">
        <div className="animated-background">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
          <div className="shape shape-4"></div>
        </div>
        
        <div className="features-content">
          <h3>Automated Workflow Experience</h3>
          
          <div className="feature-list">
            <div className="feature-item" data-aos="fade-up" data-aos-delay="100">
              <div className="feature-icon">
                <i className="fas fa-tasks"></i>
              </div>
              <div className="feature-text">
                <h4>Streamlined task management</h4>
                <p>Organize and prioritize your tasks efficiently</p>
              </div>
            </div>
            
            <div className="feature-item" data-aos="fade-up" data-aos-delay="200">
              <div className="feature-icon">
                <i className="fas fa-chart-line"></i>
              </div>
              <div className="feature-text">
                <h4>Real-time performance analytics</h4>
                <p>Track progress and identify improvement areas</p>
              </div>
            </div>
            
            <div className="feature-item" data-aos="fade-up" data-aos-delay="300">
              <div className="feature-icon">
                <i className="fas fa-bell"></i>
              </div>
              <div className="feature-text">
                <h4>Automated notifications</h4>
                <p>Stay updated with timely alerts and reminders</p>
              </div>
            </div>
            
            <div className="feature-item" data-aos="fade-up" data-aos-delay="400">
              <div className="feature-icon">
                <i className="fas fa-file-alt"></i>
              </div>
              <div className="feature-text">
                <h4>Comprehensive reporting</h4>
                <p>Generate detailed reports for better decision making</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login; 