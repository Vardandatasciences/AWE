import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './WorkflowGuide.css';

const WorkflowGuide = ({ onClose }) => {
  const [steps, setSteps] = useState([
    { id: 1, title: 'Create Customer', status: 'in-progress', link: '/customers/add' },
    { id: 2, title: 'Create Activity', status: 'pending', link: '/activities' },
    { id: 3, title: 'Assign Employee', status: 'pending', link: '/employee' },
  ]);

  // Calculate if all steps are completed
  const allStepsCompleted = steps.every(step => step.status === 'completed');

  // Log when the component mounts
  useEffect(() => {
    console.log("WorkflowGuide component mounted");
    
    // Add event listener to prevent clicks outside from closing
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      console.log("WorkflowGuide component unmounted");
    };
  }, [onClose]);

  const handleStepComplete = (stepId) => {
    console.log(`Step ${stepId} completed`);
    setSteps(steps.map(step => {
      if (step.id === stepId) {
        return { ...step, status: 'completed' };
      } else if (step.id === stepId + 1) {
        return { ...step, status: 'in-progress' };
      }
      return step;
    }));
  };

  // Prevent clicks inside the modal from propagating to parent elements
  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="workflow-guide-overlay" onClick={onClose}>
      <div className="workflow-guide-container" onClick={handleModalClick}>
        <div className="workflow-guide-header">
          <h2>Admin Workflow Guide</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="workflow-steps">
          {steps.map((step, index) => (
            <div key={step.id} className="step-container">
              <div className={`step-indicator ${step.status}`}>
                {step.status === 'completed' ? (
                  <span className="check-icon">✓</span>
                ) : (
                  step.id
                )}
              </div>
              
              {index < steps.length - 1 && (
                <div className={`step-connector ${steps[index + 1].status !== 'pending' ? 'active' : ''}`}></div>
              )}
              
              <div className="step-details">
                <h3>STEP {step.id}</h3>
                <h4>{step.title}</h4>
                <p className="step-status">{
                  step.status === 'completed' ? 'Completed' : 
                  step.status === 'in-progress' ? 'In Progress' : 'Pending'
                }</p>
                
                {step.status === 'in-progress' && (
                  <Link 
                    to={step.link} 
                    className="step-action-button"
                    onClick={() => {
                      handleStepComplete(step.id);
                      onClose(); // Close the guide when navigating
                    }}
                  >
                    Start This Step
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {allStepsCompleted && (
          <div className="workflow-success">
            <div className="success-icon">✓</div>
            <h3>All steps completed successfully!</h3>
            <p>You have completed all the required workflow steps.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowGuide; 