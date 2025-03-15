import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Mailer.css';

const RecentMessages = () => {
  const [recentMessages, setRecentMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecentMessages();
  }, []);

  const fetchRecentMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Make sure the URL matches your Flask endpoint exactly
      const response = await axios.get('/recent_messages', {
        params: {
          status: 'Sent',
          limit: 5
        }
      });
      
      setRecentMessages(response.data);
    } catch (err) {
      console.error("Error fetching recent messages:", err);
      setError("Failed to load recent messages");
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5); // Get just HH:MM
  };

  // Truncate long message descriptions
  const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="recent-messages-container">
      <div className="recent-messages-header">
        <h2>
          <span className="icon">✉️</span> Recent Sent Messages
        </h2>
        <button className="refresh-button" onClick={fetchRecentMessages}>
          <span className="icon">↻</span> Retry
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="message-spinner"></div>
          <p>Loading recent messages...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <span className="icon">⚠️</span>
          <p>{error}</p>
          <button onClick={fetchRecentMessages} className="retry-button">
            Retry
          </button>
        </div>
      ) : recentMessages.length === 0 ? (
        <div className="no-messages-container">
          <span className="icon">📭</span>
          <p>No sent messages found</p>
        </div>
      ) : (
        <div className="message-list">
          <table className="message-table">
            <thead>
              <tr>
                <th>Message</th>
                <th>Date</th>
                <th>Recipient</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentMessages.map((message) => (
                <tr key={message.s_no} className="message-row">
                  <td className="message-content">
                    <div className="message-description">{truncateText(message.message_des)}</div>
                  </td>
                  <td>{formatDate(message.date)}</td>
                  <td className="message-email">{message.email_id}</td>
                  <td>{formatTime(message.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RecentMessages;