import React, { createContext, useContext, useState, useEffect } from 'react';
import { showWorkflowGuide } from '../App';

// Default workflow steps - removing ANY reference to employee
const defaultWorkflowSteps = [
  {
    id: 1,
    title: 'Create Client',
    description: 'Add a new client to the system',
    status: 'in-progress',
    path: '/clients'
  },
  {
    id: 2,
    title: 'Create Activity',
    description: 'Create a new activity',
    status: 'pending',
    path: '/activities'
  },
  {
    id: 3,
    title: 'Assign Auditor',
    description: 'Assign an auditor to an activity',
    status: 'pending',
    path: '/activities'
  }
];

// Create the context
const WorkflowContext = createContext();

// Custom hook to use the workflow context
export const useWorkflow = () => useContext(WorkflowContext);

// Provider component
export const WorkflowProvider = ({ children }) => {
  const [workflowSteps, setWorkflowSteps] = useState(() => {
    // Try to get steps from localStorage
    const savedSteps = localStorage.getItem('workflowSteps');
    if (savedSteps) {
      return JSON.parse(savedSteps);
    }
    
    // Default steps if nothing in localStorage
    return defaultWorkflowSteps;
  });
  const [allStepsCompleted, setAllStepsCompleted] = useState(false);

  // Save steps to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('workflowSteps', JSON.stringify(workflowSteps));
    
    // Check if all steps are completed
    const completed = workflowSteps.every(step => step.status === 'completed');
    setAllStepsCompleted(completed);
  }, [workflowSteps]);

  const completeStep = (stepId) => {
    setWorkflowSteps(prevSteps => {
      const updatedSteps = prevSteps.map(step => {
        if (step.id === stepId) {
          return { ...step, status: 'completed' };
        } else if (step.id === stepId + 1 && step.id <= prevSteps.length) {
          // Set next step to in-progress only if there is a next step
          return { ...step, status: 'in-progress' };
        }
        return step;
      });
      
      // Check if all steps are completed after updating
      const allCompleted = updatedSteps.every(step => step.status === 'completed');
      if (allCompleted) {
        // If all steps are completed, show a celebration or congratulations
        console.log("All workflow steps completed!");
      }
      
      // Show the workflow guide after step completion
      setTimeout(() => {
        showWorkflowGuide();
      }, 500);
      
      return updatedSteps;
    });
  };

  const resetWorkflow = () => {
    setWorkflowSteps(defaultWorkflowSteps);
    setAllStepsCompleted(false);
  };

  // Get the current active step
  const getCurrentStep = () => {
    return workflowSteps.find(step => step.status === 'in-progress') || null;
  };

  // Value object to be provided to consumers
  const value = {
    workflowSteps,
    completeStep,
    allStepsCompleted,
    resetWorkflow,
    getCurrentStep
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
};

export default WorkflowContext; 