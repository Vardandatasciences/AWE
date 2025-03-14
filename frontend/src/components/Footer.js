import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>AWE</h3>
          <p>Automated Workflow Experience - Simplifying task management and performance monitoring for businesses.</p>
          <div className="social-icons">
            <a href="#" aria-label="Facebook"><i className="fab fa-facebook-f"></i></a>
            <a href="#" aria-label="Twitter"><i className="fab fa-twitter"></i></a>
            <a href="#" aria-label="LinkedIn"><i className="fab fa-linkedin-in"></i></a>
          </div>
        </div>
        
        <div className="footer-section">
          <h3>Quick Links</h3>
          <ul className="footer-links">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/tasks">Tasks</Link></li>
            <li><Link to="/activities">Activities</Link></li>
            <li><Link to="/report">Reports</Link></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h3>Resources</h3>
          <ul className="footer-links">
            <li><a href="#">Documentation</a></li>
            <li><a href="#">API Reference</a></li>
            <li><a href="#">Support</a></li>
            <li><a href="#">FAQ</a></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h3>Contact Us</h3>
          <address>
            <p><i className="fas fa-map-marker-alt"></i> 123 Business Avenue, Suite 100</p>
            <p><i className="fas fa-phone"></i> +1 (555) 123-4567</p>
            <p><i className="fas fa-envelope"></i> info@awe-platform.com</p>
          </address>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; {currentYear} AWE - Automated Workflow Experience. All rights reserved.</p>
        <div className="footer-legal">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 