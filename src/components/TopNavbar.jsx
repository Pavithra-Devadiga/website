import React, { useState, useEffect } from 'react';

export default function TopNavbar({ 
  activePanel, 
  onPanelSwitch, 
  t, 
  openAuthModal,
  isDarkMode,
  setIsDarkMode,
  voiceNavEnabled,
  setVoiceNavEnabled,
  voiceGuidanceEnabled,
  setVoiceGuidanceEnabled,
  speakFeedback,
  isClerkActive = false,
  clerkUserButton = null
}) {
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleSetMenu = (e) => {
      setIsMobileMenuOpen(e.detail);
    };
    window.addEventListener("auraSetMobileMenu", handleSetMenu);
    return () => window.removeEventListener("auraSetMobileMenu", handleSetMenu);
  }, []);

  const menuItems = [
    { id: 'panel-dashboard', labelKey: 'Home' },
    { id: 'panel-explore', labelKey: 'Explore' },
    { id: 'panel-community', labelKey: 'Community' },
  ];

  return (
    <nav className="top-navbar">
      
      <div className="navbar-header-row" style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
        {/* Brand Logo Header */}
        <div className="navbar-logo" onClick={() => { onPanelSwitch("panel-dashboard"); setIsMobileMenuOpen(false); }} style={{ cursor: 'pointer', color: 'var(--primary-blue)', background: 'none', WebkitTextFillColor: 'initial' }}>
          SULABHA
        </div>

        {/* Hamburger Toggle Button for Mobile */}
        <button 
          type="button"
          className="navbar-hamburger-btn"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={{
            background: 'none',
            border: 'none',
            color: isDarkMode ? '#ffffff' : '#0f172a',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: '4px'
          }}
          title="Toggle Navigation Menu"
        >
          <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
        </button>
      </div>

      {/* Horizontal Routing Links */}
      <div className={`navbar-menu-row ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        {menuItems.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`navbar-link ${activePanel === item.id ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              onPanelSwitch(item.id);
              setIsMobileMenuOpen(false); // Close dropdown
              if (voiceGuidanceEnabled && speakFeedback) {
                speakFeedback(`Navigating to ${t(item.labelKey)}`);
              }
            }}
            onMouseEnter={() => {
              if (voiceGuidanceEnabled && speakFeedback) {
                speakFeedback(t(item.labelKey));
              }
            }}
            onTouchStart={() => {
              if (voiceGuidanceEnabled && speakFeedback) {
                speakFeedback(t(item.labelKey));
              }
            }}
            onFocus={() => {
              if (voiceGuidanceEnabled && speakFeedback) {
                speakFeedback(t(item.labelKey));
              }
            }}
          >
            {t(item.labelKey)}
          </a>
        ))}
      </div>

      {/* Settings & Profile Actions */}
      <div className="navbar-actions" style={{ flex: 1, justifyContent: 'flex-end' }}>
        
        {/* Voice Scrolling Toggler (Microphone) */}
        <button 
          type="button"
          onClick={() => {
            const nextVal = !voiceNavEnabled;
            setVoiceNavEnabled(nextVal);
            if (speakFeedback) {
              speakFeedback(nextVal ? "Voice scrolling activated." : "Voice scrolling deactivated.");
            }
          }}
          title={voiceNavEnabled ? "Deactivate Voice Scrolling" : "Activate Voice Scrolling"}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: `1px solid ${voiceNavEnabled ? 'var(--primary-blue)' : 'var(--border-color)'}`,
            background: voiceNavEnabled ? '#e0e7ff' : 'transparent',
            color: voiceNavEnabled ? 'var(--primary-blue)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '0.92rem',
            marginRight: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <i className="fa-solid fa-microphone"></i>
        </button>

        {/* Voice Guidance Toggler (Speaker) */}
        <button 
          type="button"
          onClick={() => {
            const nextVal = !voiceGuidanceEnabled;
            setVoiceGuidanceEnabled(nextVal);
            if (speakFeedback) {
              speakFeedback(nextVal ? "Voice guidance activated." : "Voice guidance deactivated.");
            }
          }}
          title={voiceGuidanceEnabled ? "Deactivate Voice Guidance" : "Activate Voice Guidance"}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: `1px solid ${voiceGuidanceEnabled ? 'var(--primary-blue)' : 'var(--border-color)'}`,
            background: voiceGuidanceEnabled ? '#e0e7ff' : 'transparent',
            color: voiceGuidanceEnabled ? 'var(--primary-blue)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '0.92rem',
            marginRight: '12px',
            transition: 'all 0.2s ease'
          }}
        >
          <i className="fa-solid fa-volume-high"></i>
        </button>

        {/* Light/Dark mode switcher */}
        <button 
          type="button"
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? "Toggle Light Mode" : "Toggle Dark Mode"}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '0.95rem',
            marginRight: '12px',
            transition: 'all 0.2s ease'
          }}
        >
          <i className={isDarkMode ? "fa-solid fa-sun" : "fa-solid fa-moon"}></i>
        </button>

        {/* Profile Avatar Icon or Clerk User Button */}
        {isClerkActive && clerkUserButton ? (
          <div className="clerk-user-btn-container" style={{ display: 'flex', alignItems: 'center' }}>
            {clerkUserButton}
          </div>
        ) : (
          <button 
            type="button"
            onClick={openAuthModal}
            title="Configure Profile Settings"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              border: '2px solid var(--primary-blue)',
              background: '#e0e7ff',
              color: 'var(--primary-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              boxShadow: '0 0 10px rgba(0, 240, 255, 0.2)',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fa-solid fa-user-astronaut" style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}></i>
          </button>
        )}

      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="mobile-bottom-nav">
        {menuItems.map((item) => {
          let iconClass = "fa-house";
          if (item.id === "panel-explore") iconClass = "fa-compass";
          if (item.id === "panel-community") iconClass = "fa-users";
          
          return (
            <a
              key={item.id + '-mobile'}
              href={`#${item.id}`}
              className={`mobile-bottom-nav-item ${activePanel === item.id ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                onPanelSwitch(item.id);
                if (voiceGuidanceEnabled && speakFeedback) {
                  speakFeedback(`Navigating to ${item.labelKey}`);
                }
              }}
            >
              <i className={`fa-solid ${iconClass}`}></i>
              {item.labelKey}
            </a>
          );
        })}
      </div>

    </nav>
  );
}
