import React, { useState, useEffect } from "react";
import axios from "axios";
import "./AssignActivity.css";

const AssignActivity = ({ activityId, onClose }) => {
  const [assignees, setAssignees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");

  useEffect(() => {
    // Fetch assignees from the actors table
    axios.get("http://127.0.0.1:5000/actors_assign")
      .then(response => setAssignees(response.data))
      .catch(error => console.error("Error fetching assignees:", error));

    // Fetch customers from the customers table
    axios.get("http://127.0.0.1:5000/customers_assign")
      .then(response => setCustomers(response.data))
      .catch(error => console.error("Error fetching customers:", error));
  }, []);

  const handleAssign = () => {
    if (!selectedAssignee || !selectedCustomer) {
      alert("Please select both an assignee and a customer.");
      return;
    }

    const assignmentData = {
      activity_id: activityId,
      assignee_id: selectedAssignee,
      customer_id: selectedCustomer,
    };

    axios.post("http://127.0.0.1:5000/assign_activity", assignmentData)
      .then(response => {
        alert("Activity assigned successfully!");
        onClose();
      })
      .catch(error => {
        console.error("Error assigning activity:", error);
        alert("Failed to assign activity.");
      });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <h2 className="modal-title">Assign Activity</h2>
        
        <div className="modal-body">
          <div className="form-group">
            <label>Assign To:</label>
            <div className="custom-select">
            <select value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)}>
  <option value="">Select Assignee</option>
  {assignees.map((actor) => (
    <option key={actor.actor_id} value={actor.actor_id}>
      {actor.actor_name}
    </option>
  ))}
</select>



            </div>
          </div>

          <div className="form-group">
            <label>Select Customer:</label>
            <div className="custom-select">
            <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
  <option value="">Select Customer</option>
  {customers.map((customer) => (
    <option key={customer.customer_id} value={customer.customer_id}>
      {customer.customer_name}
    </option>
  ))}
</select>

            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn btn-assign" onClick={handleAssign}>Assign</button>
        </div>
      </div>
    </div>
  );
};

export default AssignActivity;