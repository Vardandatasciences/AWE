import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import SubNav from './components/SubNav';
import Footer from './components/Footer';
import Home from './components/Home';
import Tasks from './components/Tasks';
import Activities from './components/Activities';
import Mailer from './components/Mailer';
import Employee from './components/Employee';
import Report from './components/Report';
import Analysis from './components/Analysis';
import Login from './components/Login';
import Unauthorized from './components/Unauthorized';
import ProtectedRoute from './components/ProtectedRoute';
import Profile from './components/Profile';
import { AuthProvider } from './context/AuthContext';
// import ChangePassword from './ChangePassword';
import Diary from './components/Diary';
import WorkflowGuide from './components/WorkflowGuide';
import Dashboard from './components/Dashboard';
import WorkflowTest from './components/WorkflowTest';
import AddCustomerForm from './components/AddCustomerForm';
import './App.css';

// Create a global variable to store the workflow guide state handler
let globalSetShowWorkflowGuide = null;

// Create a function to show the workflow guide from anywhere
export const showWorkflowGuide = () => {
  if (globalSetShowWorkflowGuide) {
    console.log("Showing workflow guide via global function");
    globalSetShowWorkflowGuide(true);
  } else {
    console.error("globalSetShowWorkflowGuide is not set");
  }
};

function App() {
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);
  
  // Set the global handler when the component mounts
  useEffect(() => {
    globalSetShowWorkflowGuide = setShowWorkflowGuide;
    
    return () => {
      globalSetShowWorkflowGuide = null;
    };
  }, []);

  const handleGetStartedClick = () => {
    console.log("Get Started clicked, showing workflow guide");
    setShowWorkflowGuide(true);
  };

  return (
    <div className="app-wrapper">
      <AuthProvider>
        <Router>
          <AppContent 
            handleGetStartedClick={handleGetStartedClick} 
            showWorkflowGuide={showWorkflowGuide}
            setShowWorkflowGuide={setShowWorkflowGuide}
          />
        </Router>
      </AuthProvider>
    </div>
  );
}

// Separate component to handle route-specific logic
function AppContent({ handleGetStartedClick, showWorkflowGuide, setShowWorkflowGuide }) {
  const location = useLocation();
  
  // Log when routes change to help with debugging
  useEffect(() => {
    console.log("Route changed to:", location.pathname);
  }, [location]);

  // Function to handle customer add success
  const handleCustomerAddSuccess = (message) => {
    console.log(message);
    // You can add a toast notification here if you want
  };

  return (

    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/profile" element={
              <ProtectedRoute>
                <main className="main-content">
                  <Profile />
                </main>
              </ProtectedRoute>
            } />
            
            <Route path="/tasks" element={
              <ProtectedRoute>
                <SubNav />
                <main className="main-content">
                  <Tasks />
                </main>
              </ProtectedRoute>
            } />
            
            <Route path="/activities" element={
              <ProtectedRoute adminOnly={true}>
                <SubNav />
                <main className="main-content">
                  <Activities />
                </main>
              </ProtectedRoute>
            } />
            
            <Route path="/mailer" element={
              <ProtectedRoute adminOnly={true}>
                <SubNav />
                <main className="main-content">
                  <Mailer />
                </main>
              </ProtectedRoute>
            } />
            
            <Route path="/employee" element={
              <ProtectedRoute adminOnly={true}>
                <SubNav />
                <main className="main-content">
                  <Employee />
                </main>
              </ProtectedRoute>
            } />
            
            <Route path="/report" element={
              <ProtectedRoute>
                <SubNav />
                <main className="main-content">
                  <Report />
                </main>
              </ProtectedRoute>
            } />
            
            <Route path="/analysis" element={
              <ProtectedRoute adminOnly={true}>
                <SubNav />
                <main className="main-content">
                  <Analysis />
                </main>
              </ProtectedRoute>
            } />
            <Route path="/diary" element={
              <ProtectedRoute>
                <SubNav />
                <main className="main-content">
                  <Diary />
                </main>
              </ProtectedRoute>
            } />
          </Routes>
          <Footer />
        </div>
      </Router>
    </AuthProvider>

    <div className="app">
      <Navbar />
      
      {/* Render WorkflowGuide inside the Router context */}
      {showWorkflowGuide && (
        <WorkflowGuide onClose={() => setShowWorkflowGuide(false)} />
      )}
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/workflow-test" element={<WorkflowTest />} />

        {/* Add route for customer add page */}
        <Route path="/customers/add" element={
          <ProtectedRoute adminOnly={true}>
            <SubNav />
            <main className="main-content">
              <AddCustomerForm 
                onClose={() => window.history.back()} 
                onSuccess={handleCustomerAddSuccess} 
              />
            </main>
          </ProtectedRoute>
        } />

        <Route path="/employee" element={
          <ProtectedRoute adminOnly={true}>
            <SubNav />
            <main className="main-content">
              <Employee />
            </main>
          </ProtectedRoute>
        } />
        
        <Route path="/tasks" element={
          <ProtectedRoute>
            <SubNav />
            <main className="main-content">
              <Tasks />
            </main>
          </ProtectedRoute>
        } />
        
        <Route path="/activities" element={
          <ProtectedRoute adminOnly={true}>
            <SubNav />
            <main className="main-content">
              <Activities />
            </main>
          </ProtectedRoute>
        } />
        
        <Route path="/mailer" element={
          <ProtectedRoute adminOnly={true}>
            <SubNav />
            <main className="main-content">
              <Mailer />
            </main>
          </ProtectedRoute>
        } />
        
        <Route path="/report" element={
          <ProtectedRoute>
            <SubNav />
            <main className="main-content">
              <Report />
            </main>
          </ProtectedRoute>
        } />
        
        <Route path="/analysis" element={
          <ProtectedRoute adminOnly={true}>
            <SubNav />
            <main className="main-content">
              <Analysis />
            </main>
          </ProtectedRoute>
        } />
        <Route path="/diary" element={
          <ProtectedRoute >
            <SubNav />
            <main className="main-content">
              <Diary />
            </main>
          </ProtectedRoute>
        } />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard onGetStarted={handleGetStartedClick} />
            </ProtectedRoute>
          } 
        />
      </Routes>
      <Footer />
    </div>

  );
}

export default App;
