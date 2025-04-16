import axios from 'axios';

// Configure the base URL for your API
const api = axios.create({
  baseURL: 'http://localhost:5000',  // Make sure this matches your Flask server port
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true
});

// Add request interceptor to handle errors
api.interceptors.request.use(
  config => {
    console.log(`Making ${config.method.toUpperCase()} request to: ${config.baseURL}${config.url}`);
    return config;
  },
  error => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      // Server responded with a status code outside of 2xx range
      console.error('Response error:', error.response.status, error.response.data);
    } else if (error.request) {
      // Request was made but no response was received
      console.error('Network error - no response received');
    } else {
      // Something happened in setting up the request
      console.error('Request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

const handleApiError = (error) => {
  console.error("API Error:", error);
  
  // Check if it's a network error
  if (!error.response) {
    return Promise.reject({ 
      message: "Network error: Please check your connection"
    });
  }
  
  // Handle specific HTTP errors
  if (error.response.status === 500) {
    return Promise.reject({
      message: "Server error: Something went wrong on the server"
    });
  }
  
  // Return the error response for other cases
  return Promise.reject(error.response.data || error);
};

export default api; 