import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

// Import multiple GIFs for a more dynamic experience
import taskManagementGif from '../assets/task-management.gif'; // Task management animation
import analyticsGif from '../assets/analytics.gif'; // Analytics dashboard animation
import teamworkGif from '../assets/teamwork.gif'; // Team collaboration animation
import automationGif from '../assets/automation.gif'; // Workflow automation animation

const Home = () => {
  // Refs for animation elements
  const featuresRef = useRef(null);
  const benefitsRef = useRef(null);
  const testimonialsRef = useRef(null);

  // Add scroll animation effect
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, observerOptions);

    // Observe all sections with animation
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    animatedElements.forEach(el => observer.observe(el));

    return () => {
      animatedElements.forEach(el => observer.unobserve(el));
    };
  }, []);

  return (
    <div className="home-container">
      {/* Hero Section with Animated Background */}
      <section className="hero">
        <div className="hero-background">
          <div className="animated-shapes">
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
            <div className="shape shape-3"></div>
            <div className="shape shape-4"></div>
          </div>
        </div>
        <div className="hero-content">
          <h1>Automated Workflow Experience</h1>
          <p className="tagline">Streamline operations. Boost productivity. Achieve excellence.</p>
          <div className="hero-buttons">
            <Link to="/tasks" className="btn btn-primary">
              <i className="fas fa-rocket"></i> Get Started
            </Link>
            <a href="#features" className="btn btn-secondary">
              <i className="fas fa-info-circle"></i> Learn More
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="gif-container primary-gif">
            <img src={taskManagementGif} alt="Task Management" className="hero-gif" />
            <div className="gif-overlay">
              <span>Intelligent Task Management</span>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="value-proposition">
        <div className="container">
          <div className="value-cards">
            <div className="value-card">
              <div className="value-icon">
                <i className="fas fa-bolt"></i>
              </div>
              <h3>Efficiency</h3>
              <p>Reduce manual work by 75%</p>
            </div>
            <div className="value-card">
              <div className="value-icon">
                <i className="fas fa-chart-line"></i>
              </div>
              <h3>Productivity</h3>
              <p>Increase output by 40%</p>
            </div>
            <div className="value-card">
              <div className="value-icon">
                <i className="fas fa-shield-alt"></i>
              </div>
              <h3>Reliability</h3>
              <p>99.9% system uptime</p>
            </div>
            <div className="value-card">
              <div className="value-icon">
                <i className="fas fa-sync"></i>
              </div>
              <h3>Adaptability</h3>
              <p>Customizable to your needs</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section with GIFs */}
      <section className="features animate-on-scroll" id="features" ref={featuresRef}>
        <div className="container">
          <div className="section-header">
            <h2>Powerful Features</h2>
            <p>Everything you need to transform your workflow</p>
          </div>
          
          <div className="feature-showcase">
            <div className="feature-content">
              <div className="feature-icon">
                <i className="fas fa-tasks"></i>
              </div>
              <h3>Intelligent Task Management</h3>
              <p>Organize, prioritize, and track tasks with ease. Our smart algorithms help distribute workload efficiently across your team.</p>
              <ul className="feature-list">
                <li><i className="fas fa-check-circle"></i> Automated task assignment</li>
                <li><i className="fas fa-check-circle"></i> Priority-based scheduling</li>
                <li><i className="fas fa-check-circle"></i> Real-time progress tracking</li>
                <li><i className="fas fa-check-circle"></i> Deadline management</li>
              </ul>
            </div>
            <div className="feature-visual">
              <img src={taskManagementGif} alt="Task Management" className="feature-gif" />
            </div>
          </div>
          
          <div className="feature-showcase reverse">
            <div className="feature-content">
              <div className="feature-icon">
                <i className="fas fa-chart-bar"></i>
              </div>
              <h3>Advanced Analytics Dashboard</h3>
              <p>Gain valuable insights into your team's performance with comprehensive analytics and customizable reports.</p>
              <ul className="feature-list">
                <li><i className="fas fa-check-circle"></i> Performance metrics</li>
                <li><i className="fas fa-check-circle"></i> Productivity trends</li>
                <li><i className="fas fa-check-circle"></i> Resource utilization</li>
                <li><i className="fas fa-check-circle"></i> Bottleneck identification</li>
              </ul>
            </div>
            <div className="feature-visual">
              <img src={analyticsGif} alt="Analytics Dashboard" className="feature-gif" />
            </div>
          </div>
          
          <div className="feature-showcase">
            <div className="feature-content">
              <div className="feature-icon">
                <i className="fas fa-users-cog"></i>
              </div>
              <h3>Team Collaboration Hub</h3>
              <p>Foster teamwork and communication with integrated collaboration tools designed for modern workplaces.</p>
              <ul className="feature-list">
                <li><i className="fas fa-check-circle"></i> Task commenting</li>
                <li><i className="fas fa-check-circle"></i> File sharing</li>
                <li><i className="fas fa-check-circle"></i> Team notifications</li>
                <li><i className="fas fa-check-circle"></i> Activity feeds</li>
              </ul>
            </div>
            <div className="feature-visual">
              <img src={teamworkGif} alt="Team Collaboration" className="feature-gif" />
            </div>
          </div>
          
          <div className="feature-showcase reverse">
            <div className="feature-content">
              <div className="feature-icon">
                <i className="fas fa-robot"></i>
              </div>
              <h3>Workflow Automation</h3>
              <p>Eliminate repetitive tasks with powerful automation tools that streamline your business processes.</p>
              <ul className="feature-list">
                <li><i className="fas fa-check-circle"></i> Custom workflow creation</li>
                <li><i className="fas fa-check-circle"></i> Trigger-based actions</li>
                <li><i className="fas fa-check-circle"></i> Scheduled tasks</li>
                <li><i className="fas fa-check-circle"></i> Integration capabilities</li>
              </ul>
            </div>
            <div className="feature-visual">
              <img src={automationGif} alt="Workflow Automation" className="feature-gif" />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section with Animated Stats */}
      <section className="benefits animate-on-scroll" id="benefits" ref={benefitsRef}>
        <div className="container">
          <div className="section-header">
            <h2>Real Business Impact</h2>
            <p>Measurable results that transform your organization</p>
          </div>
          
          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-stat">
                <span className="stat-number">40%</span>
                <span className="stat-icon"><i className="fas fa-arrow-up"></i></span>
              </div>
              <h3>Productivity Increase</h3>
              <p>Teams report significant productivity gains within the first month</p>
            </div>
            
            <div className="benefit-card">
              <div className="benefit-stat">
                <span className="stat-number">65%</span>
                <span className="stat-icon"><i className="fas fa-arrow-down"></i></span>
              </div>
              <h3>Reduced Errors</h3>
              <p>Fewer mistakes with automated workflows and validation</p>
            </div>
            
            <div className="benefit-card">
              <div className="benefit-stat">
                <span className="stat-number">30%</span>
                <span className="stat-icon"><i className="fas fa-arrow-down"></i></span>
              </div>
              <h3>Time Savings</h3>
              <p>Less time spent on administrative and repetitive tasks</p>
            </div>
            
            <div className="benefit-card">
              <div className="benefit-stat">
                <span className="stat-number">85%</span>
                <span className="stat-icon"><i className="fas fa-users"></i></span>
              </div>
              <h3>Team Satisfaction</h3>
              <p>Higher employee satisfaction through better work distribution</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials animate-on-scroll" id="testimonials" ref={testimonialsRef}>
        <div className="container">
          <div className="section-header">
            <h2>What Our Clients Say</h2>
            <p>Success stories from organizations like yours</p>
          </div>
          
          <div className="testimonial-carousel">
            <div className="testimonial-card">
              <div className="testimonial-content">
                <i className="fas fa-quote-left"></i>
                <p>"AWE has transformed how we manage our accounting processes. Tasks that used to take days now happen automatically, and our team can focus on what really matters."</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">
                  <i className="fas fa-user-circle"></i>
                </div>
                <div className="author-info">
                  <h4>Sarah Johnson</h4>
                  <p>CFO, Global Innovations</p>
                </div>
              </div>
            </div>
            
            <div className="testimonial-card">
              <div className="testimonial-content">
                <i className="fas fa-quote-left"></i>
                <p>"The analytics dashboard gives us unprecedented visibility into our operations. We've identified and resolved bottlenecks we didn't even know existed."</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">
                  <i className="fas fa-user-circle"></i>
                </div>
                <div className="author-info">
                  <h4>Michael Chen</h4>
                  <p>Operations Director, TechSolutions</p>
                </div>
              </div>
            </div>
            
            <div className="testimonial-card">
              <div className="testimonial-content">
                <i className="fas fa-quote-left"></i>
                <p>"Implementation was seamless, and the ROI was evident within weeks. Our regulatory compliance tasks are now completed on time, every time."</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">
                  <i className="fas fa-user-circle"></i>
                </div>
                <div className="author-info">
                  <h4>Elena Rodriguez</h4>
                  <p>Compliance Manager, FinSecure</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action with Animated Background */}
      <section className="cta">
        <div className="cta-background">
          <div className="animated-shapes">
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
          </div>
        </div>
        <div className="container">
          <h2>Ready to Transform Your Workflow?</h2>
          <p>Join thousands of organizations already optimizing their operations with AWE.</p>
          <div className="cta-buttons">
            <Link to="/tasks" className="btn btn-primary btn-large">
              <i className="fas fa-rocket"></i> Get Started Now
            </Link>
            <Link to="/contact" className="btn btn-outline btn-large">
              <i className="fas fa-headset"></i> Talk to an Expert
            </Link>
          </div>
          <div className="cta-features">
            <div className="cta-feature">
              <i className="fas fa-check-circle"></i>
              <span>No credit card required</span>
            </div>
            <div className="cta-feature">
              <i className="fas fa-check-circle"></i>
              <span>Free 30-day trial</span>
            </div>
            <div className="cta-feature">
              <i className="fas fa-check-circle"></i>
              <span>24/7 support</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home; 