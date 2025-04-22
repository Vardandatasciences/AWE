import React from 'react';
import { useWorkflow } from '../context/WorkflowContext';
import { Link } from 'react-router-dom';
import { showWorkflowGuide } from '../App';

const WorkflowStatus = () => {
  const { getCurrentStep, workflowSteps } = useWorkflow();
  const currentStep = getCurrentStep();
  
  if (!currentStep) return null;
  
  return (
    <div className="workflow-status-bar">
      <div className="current-step-info">
        <i className="fas fa-tasks"></i> 
        You're in step {currentStep.id} of the workflow: {currentStep.title}
      </div>
      <button className="view-workflow-btn" onClick={showWorkflowGuide}>
        <i className="fas fa-eye"></i> View Workflow
      </button>
    </div>
  );
};

export default WorkflowStatus; 