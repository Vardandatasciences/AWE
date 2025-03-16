import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './SubNav.css';

const SubNav = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="sub-nav-container">
      <button className="mobile-toggle" onClick={toggleMenu}>
        <i className="fas fa-bars"></i> Menu
      </button>
      
      <nav className={`sub-nav ${isOpen ? 'open' : ''}`}>
        <NavLink to="/employee" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-users"></i> Stakeholders
        </NavLink>
        <NavLink to="/activities" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-clipboard-list"></i> Activities
        </NavLink>
        
        <NavLink to="/tasks" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-tasks"></i> Tasks
        </NavLink>
        
        <NavLink to="/mailer" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-envelope"></i> Mailer
        </NavLink>
        
        {/* <NavLink to="/report" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-chart-bar"></i> Reports
        </NavLink> */}
        <NavLink to="/analysis" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-chart-line"></i> Analysis
        </NavLink>
        <NavLink to="/diary" className={({ isActive }) => isActive ? 'active' : ''}>
          <i className="fas fa-book"></i> Diary
        </NavLink>
 
      </nav>
    </div>
  );
};

export default SubNav; 