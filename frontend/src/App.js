import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import './App.css';

function App() {
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
  );
}

export default App;
