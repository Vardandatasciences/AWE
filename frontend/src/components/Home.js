import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Home.css';
import { showWorkflowGuide } from '../App';

// Import videos and images for JSW Steel company
import manufacturingGif from '../assets/manufacturing.mp4';
import manufacturingGif1 from '../assets/manufacturing1.mp4';
import qualityControlGif from '../assets/quality_control.mp4';
import supplyChainGif from '../assets/supply_chain.mp4';
import sustainabilityGif from '../assets/sustainability.mp4';
import automationGif from '../assets/automation1.mp4';
import aerialViewGif from '../assets/aerial_view.mp4';
// Additional media imports
import productionLineGif from '../assets/production_line.mp4';
import internationalMarketGif from '../assets/international_market.mp4';
import researchLabGif from '../assets/research_lab.mp4';
// Import static images for products and clients
import automotiveImg from '../assets/automotive.avif';
import constructionImg from '../assets/construction.avif';
import energyImg from '../assets/energy.avif';
import appliancesImg from '../assets/appliances.avif';
import client1 from '../assets/clients/client1.avif';
import client2 from '../assets/clients/client2.avif';
import client3 from '../assets/clients/client3.avif';
import client4 from '../assets/clients/client4.avif';
import client5 from '../assets/clients/client5.avif';
import client6 from '../assets/clients/client6.avif';

const Home = () => {
  const navigate = useNavigate();
  const productsRef = useRef(null);
  const partnersRef = useRef(null);
  const globalPresenceRef = useRef(null);
  const researchRef = useRef(null);
  const [isVisible, setIsVisible] = useState({});
  const [counters, setCounters] = useState({
    revenue: 0,
    employees: 0,
    plants: 0,
    countries: 0
  });
  
  // Handle Get Started button click
  const handleGetStartedClick = (e) => {
    e.preventDefault();
    console.log("Home: Get Started button clicked");

    const user = JSON.parse(localStorage.getItem('user'));

    if (user) {
      if (user.role != 'admin') {
        navigate('/tasks');
      } else {
        showWorkflowGuide();
      }
    } else {
      showWorkflowGuide();
    }
  };

  // Counter animation for stats
  useEffect(() => {
    const duration = 2000; // ms
    const frameDuration = 1000/60; // 60fps
    const totalFrames = Math.round(duration / frameDuration);
    
    let frame = 0;
    const counter = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      
      setCounters({
        revenue: Math.floor(progress * 27000),
        employees: Math.floor(progress * 40000),
        plants: Math.floor(progress * 12),
        countries: Math.floor(progress * 100)
      });
      
      if (frame === totalFrames) {
        clearInterval(counter);
      }
    }, frameDuration);
    
    return () => clearInterval(counter);
  }, []);

  // Intersection observer for animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(prev => ({
              ...prev,
              [entry.target.id]: true
            }));
          }
        });
      },
      { threshold: 0.2 }
    );

    const sections = [
      productsRef.current,
      partnersRef.current,
      globalPresenceRef.current,
      researchRef.current
    ];

    sections.forEach(section => {
      if (section) observer.observe(section);
    });

    return () => {
      sections.forEach(section => {
        if (section) observer.unobserve(section);
      });
    };
  }, []);

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="company-badge">
            <span>India's Premier Steel Producer</span>
          </div>
          <h1>JSW Steel: Forging India's Future</h1>
          <p className="tagline">Leading the steel revolution with world-class manufacturing, sustainability, and innovative solutions.</p>
          
          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-number">₹{counters.revenue}+ Cr</div>
              <div className="stat-label">Annual Revenue</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{counters.employees}+</div>
              <div className="stat-label">Employees</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{counters.plants}</div>
              <div className="stat-label">Plants</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{counters.countries}+</div>
              <div className="stat-label">Countries</div>
            </div>
          </div>
          
          <div className="hero-buttons">
            <button className="btn btn-primary" onClick={handleGetStartedClick}>
              <i className="fas fa-rocket"></i> Explore Products
            </button>
            <a href="#manufacturing" className="btn btn-secondary">
              <i className="fas fa-info-circle"></i> Our Capabilities
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <video src={manufacturingGif} autoPlay muted loop className="hero-video" />
        </div>
      </section>

      {/* Manufacturing Section */}
      <section id="manufacturing" className="feature-section">
        <div className="feature-icon-container">
          <div className="feature-icon">
            <i className="fas fa-industry"></i>
          </div>
        </div>
        
        <div className="feature-content-container">
          <h2 className="feature-title">Advanced Manufacturing</h2>
          <p className="feature-description">
            State-of-the-art blast furnaces, continuous casting, and hot rolling mills produce world-class steel products with precise specifications and exceptional quality.
          </p>
          
          <ul className="feature-list">
            <li><i className="fas fa-check-circle"></i> Hot rolled coils and sheets</li>
            <li><i className="fas fa-check-circle"></i> Cold rolled products</li>
            <li><i className="fas fa-check-circle"></i> Galvanized and galvalume steel</li>
            <li><i className="fas fa-check-circle"></i> Tinplate and color-coated products</li>
          </ul>
          
          <div className="feature-badge">
            <i className="fas fa-star"></i>
            <span>Industry-Leading Technology</span>
          </div>
        </div>
        
        <div className="feature-visual-container">
          <div className="feature-visual-content">
            <video src={manufacturingGif1} autoPlay muted loop className="feature-video" />
            <div className="image-caption">Continuous Casting Process</div>
          </div>
        </div>
      </section>

      {/* Quality Control Section */}
      <section className="feature-section alt-section">
        <div className="feature-icon-container">
          <div className="feature-icon alt-icon">
            <i className="fas fa-microscope"></i>
          </div>
        </div>
        
        <div className="feature-visual-container">
          <div className="feature-visual-content">
            <video src={qualityControlGif} autoPlay muted loop className="feature-video" />
            <div className="image-caption">Advanced Quality Testing Lab</div>
          </div>
        </div>
        
        <div className="feature-content-container">
          <h2 className="feature-title">Quality Control Systems</h2>
          <p className="feature-description">
            Rigorous testing at every production stage ensures consistent quality that meets the most demanding international standards.
          </p>
          
          <ul className="feature-list">
            <li><i className="fas fa-check-circle"></i> Metallurgical testing</li>
            <li><i className="fas fa-check-circle"></i> Surface quality inspection</li>
            <li><i className="fas fa-check-circle"></i> Mechanical property verification</li>
            <li><i className="fas fa-check-circle"></i> Dimensional accuracy control</li>
          </ul>
          
          <div className="feature-badge alt-badge">
            <i className="fas fa-award"></i>
            <span>ISO 9001:2015 Certified</span>
          </div>
        </div>
      </section>

      {/* Product Categories Section - NEW */}
      <section id="products" className="products-section" ref={productsRef}>
        <div className="section-header">
          <h2>Innovative Steel Solutions</h2>
          <p>Premium products engineered for diverse industrial applications</p>
        </div>
        
        <div className={`products-grid ${isVisible["products"] ? "animate-in" : ""}`}>
          <div className="product-category">
            <div className="product-image">
              <img src={automotiveImg} alt="Automotive Steel" />
              <div className="product-overlay">
                <span>45% Market Share</span>
              </div>
            </div>
            <h3>Automotive Steel</h3>
            <p>Advanced high-strength steel for modern vehicles with superior formability and crash resistance.</p>
            <div className="product-specs">
              <span>AHSS</span>
              <span>Galvanealed</span>
              <span>UHSS</span>
            </div>
          </div>
          
          <div className="product-category">
            <div className="product-image">
              <img src={constructionImg} alt="Construction Steel" />
              <div className="product-overlay">
                <span>32% Market Share</span>
              </div>
            </div>
            <h3>Construction Steel</h3>
            <p>High-tensile structural steel for buildings, bridges, and infrastructure with exceptional durability.</p>
            <div className="product-specs">
              <span>TMT Rebars</span>
              <span>Steel Beams</span>
              <span>Profiles</span>
            </div>
          </div>
          
          <div className="product-category">
            <div className="product-image">
              <img src={energyImg} alt="Energy Sector Steel" />
              <div className="product-overlay">
                <span>28% Market Share</span>
              </div>
            </div>
            <h3>Energy Sector</h3>
            <p>Specialized steel for oil & gas, power generation, and renewable energy infrastructure.</p>
            <div className="product-specs">
              <span>API Grades</span>
              <span>Wind Energy</span>
              <span>Solar Structures</span>
            </div>
          </div>
          
          <div className="product-category">
            <div className="product-image">
              <img src={appliancesImg} alt="Appliance Steel" />
              <div className="product-overlay">
                <span>38% Market Share</span>
              </div>
            </div>
            <h3>Appliances & Packaging</h3>
            <p>Precision-finished steel for consumer durables, white goods, and food packaging applications.</p>
            <div className="product-specs">
              <span>Tinplate</span>
              <span>Coated Steel</span>
              <span>CRCA</span>
            </div>
          </div>
        </div>
        
        <div className="section-cta">
          <button className="btn btn-secondary" onClick={handleGetStartedClick}>
            <i className="fas fa-th-list"></i> View Complete Product Catalog
          </button>
        </div>
      </section>

      {/* Supply Chain Section */}
      <section className="feature-section">
        <div className="feature-icon-container">
          <div className="feature-icon">
            <i className="fas fa-truck"></i>
          </div>
        </div>
        
        <div className="feature-content-container">
          <h2 className="feature-title">Supply Chain Excellence</h2>
          <p className="feature-description">
            Integrated logistics and distribution network ensures timely delivery across India and global markets, supported by strategic port-based facilities.
          </p>
          
          <ul className="feature-list">
            <li><i className="fas fa-check-circle"></i> Port-based manufacturing facilities</li>
            <li><i className="fas fa-check-circle"></i> Just-in-time delivery systems</li>
            <li><i className="fas fa-check-circle"></i> Real-time shipment tracking</li>
            <li><i className="fas fa-check-circle"></i> Multi-modal transportation network</li>
          </ul>
          
          <div className="feature-badge">
            <i className="fas fa-shipping-fast"></i>
            <span>Global Logistics Excellence</span>
          </div>
        </div>
        
        <div className="feature-visual-container">
          <div className="feature-visual-content">
            <video src={supplyChainGif} autoPlay muted loop className="feature-video" />
            <div className="image-caption">Integrated Logistics Network</div>
          </div>
        </div>
      </section>

      {/* Global Presence Section - NEW */}
      <section id="global-presence" className="global-presence-section" ref={globalPresenceRef}>
        <div className="section-header">
          <h2>Global Market Leadership</h2>
          <p>Serving customers across continents with world-class steel products</p>
        </div>
        
        <div className={`global-content ${isVisible["global-presence"] ? "animate-in" : ""}`}>
          <div className="global-map-container">
            <video src={internationalMarketGif} autoPlay muted loop className="global-map" />
            <div className="map-markers">
              <div className="map-marker india">
                <span className="marker-label">India</span>
                <div className="marker-dot"></div>
              </div>
              <div className="map-marker usa">
                <span className="marker-label">USA</span>
                <div className="marker-dot"></div>
              </div>
              <div className="map-marker europe">
                <span className="marker-label">Europe</span>
                <div className="marker-dot"></div>
              </div>
              <div className="map-marker middleeast">
                <span className="marker-label">Middle East</span>
                <div className="marker-dot"></div>
              </div>
              <div className="map-marker asia">
                <span className="marker-label">Asia Pacific</span>
                <div className="marker-dot"></div>
              </div>
            </div>
          </div>
          
          <div className="global-stats">
            <div className="global-stat">
              <div className="stat-value">140+</div>
              <div className="stat-name">Countries Served</div>
            </div>
            <div className="global-stat">
              <div className="stat-value">28%</div>
              <div className="stat-name">Export Revenue</div>
            </div>
            <div className="global-stat">
              <div className="stat-value">12</div>
              <div className="stat-name">Global Offices</div>
            </div>
            <div className="global-stat">
              <div className="stat-value">5</div>
              <div className="stat-name">International Subsidiaries</div>
            </div>
          </div>
        </div>
      </section>

      {/* Sustainability Section */}
      <section className="feature-section alt-section">
        <div className="feature-icon-container">
          <div className="feature-icon alt-icon">
            <i className="fas fa-leaf"></i>
          </div>
        </div>
        
        <div className="feature-visual-container">
          <div className="feature-visual-content">
            <video src={sustainabilityGif} autoPlay muted loop className="feature-video" />
            <div className="image-caption">Solar Power Integration at Plants</div>
          </div>
        </div>
        
        <div className="feature-content-container">
          <h2 className="feature-title">Sustainability Initiatives</h2>
          <p className="feature-description">
            Leading the industry in sustainable steel production with revolutionary green technologies and commitment to environmental responsibility.
          </p>
          
          <ul className="feature-list">
            <li><i className="fas fa-check-circle"></i> Carbon capture technology</li>
            <li><i className="fas fa-check-circle"></i> Renewable energy integration</li>
            <li><i className="fas fa-check-circle"></i> Water conservation systems</li>
            <li><i className="fas fa-check-circle"></i> Waste heat recovery & utilization</li>
          </ul>
          
          <div className="feature-badge highlight-badge">
            <i className="fas fa-leaf"></i>
            <span>42% Carbon Reduction Since 2005</span>
          </div>
        </div>
      </section>

      {/* Research & Innovation Section - NEW */}
      <section id="research" className="research-section" ref={researchRef}>
        <div className="research-content">
          <div className="research-text">
            <h2>Research & Innovation</h2>
            <p>Our state-of-the-art R&D facilities drive continuous innovation in steel manufacturing processes and product development.</p>
            
            <div className={`research-highlights ${isVisible["research"] ? "animate-in" : ""}`}>
              <div className="research-highlight">
                <div className="highlight-icon">
                  <i className="fas fa-flask"></i>
                </div>
                <div className="highlight-text">
                  <h4>Advanced Materials Research</h4>
                  <p>Developing next-generation high-performance steels with enhanced properties</p>
                </div>
              </div>
              
              <div className="research-highlight">
                <div className="highlight-icon">
                  <i className="fas fa-recycle"></i>
                </div>
                <div className="highlight-text">
                  <h4>Sustainable Manufacturing</h4>
                  <p>Pioneering low-carbon production technologies and circular economy solutions</p>
                </div>
              </div>
              
              <div className="research-highlight">
                <div className="highlight-icon">
                  <i className="fas fa-cogs"></i>
                </div>
                <div className="highlight-text">
                  <h4>Process Optimization</h4>
                  <p>Enhancing manufacturing efficiency through digitalization and automation</p>
                </div>
              </div>
            </div>
            
            <div className="research-stats">
              <div className="research-stat">
                <div className="stat-number">300+</div>
                <div className="stat-label">Patents</div>
              </div>
              <div className="research-stat">
                <div className="stat-number">₹450 Cr</div>
                <div className="stat-label">Annual R&D Investment</div>
              </div>
              <div className="research-stat">
                <div className="stat-number">250+</div>
                <div className="stat-label">Scientists & Engineers</div>
              </div>
            </div>
          </div>
          
          <div className="research-visual">
            <video src={researchLabGif} autoPlay muted loop className="research-video" />
          </div>
        </div>
      </section>

      {/* Industry 4.0 Section */}
      <section className="feature-section">
        <div className="feature-icon-container">
          <div className="feature-icon">
            <i className="fas fa-robot"></i>
          </div>
        </div>
        
        <div className="feature-content-container">
          <h2 className="feature-title">Industry 4.0 Automation</h2>
          <p className="feature-description">
            Cutting-edge automation systems and digital technologies driving efficiency, precision, and productivity across all manufacturing processes.
          </p>
          
          <ul className="feature-list">
            <li><i className="fas fa-check-circle"></i> AI-powered process optimization</li>
            <li><i className="fas fa-check-circle"></i> Robotics and automation</li>
            <li><i className="fas fa-check-circle"></i> Digital twin technology</li>
            <li><i className="fas fa-check-circle"></i> Predictive maintenance systems</li>
          </ul>
          
          <div className="feature-badge">
            <i className="fas fa-microchip"></i>
            <span>Smart Manufacturing Leader</span>
          </div>
        </div>
        
        <div className="feature-visual-container">
          <div className="feature-visual-content">
            <video src={automationGif} autoPlay muted loop className="feature-video" />
            <div className="image-caption">Robotic Manufacturing Systems</div>
          </div>
        </div>
      </section>

      {/* Production Line Showcase - NEW */}
      <section className="production-showcase">
        <div className="container">
          <div className="section-header">
            <h2>Manufacturing Excellence</h2>
            <p>Witness our integrated steel production process</p>
          </div>
          
          <div className="production-video-container">
            <video src={productionLineGif} autoPlay muted loop className="production-video" />
            <div className="production-stats">
              <div className="production-stage">
                <div className="stage-number">01</div>
                <div className="stage-name">Iron Making</div>
                <div className="stage-detail">Blast furnaces with 4500m³ capacity</div>
              </div>
              <div className="production-stage">
                <div className="stage-number">02</div>
                <div className="stage-name">Steel Making</div>
                <div className="stage-detail">BOF converters with 150T capacity</div>
              </div>
              <div className="production-stage">
                <div className="stage-number">03</div>
                <div className="stage-name">Continuous Casting</div>
                <div className="stage-detail">State-of-the-art casters</div>
              </div>
              <div className="production-stage">
                <div className="stage-number">04</div>
                <div className="stage-name">Hot Rolling</div>
                <div className="stage-detail">High-speed mills with 5000mm width</div>
              </div>
              <div className="production-stage">
                <div className="stage-number">05</div>
                <div className="stage-name">Value Addition</div>
                <div className="stage-detail">Cold rolling, coating & finishing</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted Partners Section - NEW */}
      <section id="partners" className="partners-section" ref={partnersRef}>
        <div className="section-header">
          <h2>Trusted by Industry Leaders</h2>
          <p>Partnering with global brands to deliver excellence</p>
        </div>
        
        <div className={`partners-grid ${isVisible["partners"] ? "animate-in" : ""}`}>
          <div className="partner-logo"><img src={client1} alt="Client Logo" /></div>
          <div className="partner-logo"><img src={client2} alt="Client Logo" /></div>
          <div className="partner-logo"><img src={client3} alt="Client Logo" /></div>
          <div className="partner-logo"><img src={client4} alt="Client Logo" /></div>
          <div className="partner-logo"><img src={client5} alt="Client Logo" /></div>
          <div className="partner-logo"><img src={client6} alt="Client Logo" /></div>
        </div>
        
        <div className="testimonial-slider">
          <div className="testimonial">
            <div className="testimonial-quote">
              <i className="fas fa-quote-left"></i>
              <p>JSW Steel has been our trusted supplier for over a decade. Their quality, reliability and innovation have been critical to our manufacturing success.</p>
            </div>
            <div className="testimonial-author">
              <div className="author-name">Rajiv Bajaj</div>
              <div className="author-title">Managing Director, Bajaj Auto</div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Partner with JSW Steel for Your Manufacturing Needs</h2>
          <p>Join thousands of businesses already trusting JSW Steel for quality, reliability, and innovation.</p>
          <div className="cta-buttons">
            <button className="btn btn-primary btn-large" onClick={handleGetStartedClick}>
              <i className="fas fa-file-signature"></i> Request a Quote
            </button>
            <Link to="/contact" className="btn btn-outline btn-large">
              <i className="fas fa-headset"></i> Contact Our Team
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home; 