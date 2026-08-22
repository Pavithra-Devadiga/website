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
    { id: 'panel-dashboard', labelKey: 'nav-dashboard' },
    { id: 'panel-explore', labelKey: 'nav-explore' },
    { id: 'panel-reader', labelKey: 'nav-reader' },
    { id: 'panel-voice', labelKey: 'nav-voice' },
    { id: 'panel-map', labelKey: 'nav-map' },
    { id: 'panel-simulators', labelKey: 'nav-simulators' },
    { id: 'panel-game', labelKey: 'nav-game' },
    { id: 'panel-sign', labelKey: 'nav-sign' },
  ];

  return (
    <nav className="top-navbar">
      
      <div className="navbar-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        {/* Brand Logo Header */}
        <div className="navbar-logo" onClick={() => { onPanelSwitch("panel-dashboard"); setIsMobileMenuOpen(false); }} style={{ cursor: 'pointer' }}>
          AURA SUITE
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
      <div className="navbar-actions">
        
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
            border: `1.5px solid ${voiceNavEnabled ? 'var(--neon-green)' : 'rgba(255,255,255,0.08)'}`,
            background: 'rgba(255,255,255,0.02)',
            color: voiceNavEnabled ? 'var(--neon-green)' : (isDarkMode ? '#94a3b8' : '#64748b'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '0.92rem',
            marginRight: '8px',
            boxShadow: voiceNavEnabled ? '0 0 10px rgba(57, 255, 20, 0.25)' : 'none',
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
            border: `1.5px solid ${voiceGuidanceEnabled ? 'var(--neon-magenta)' : 'rgba(255,255,255,0.08)'}`,
            background: 'rgba(255,255,255,0.02)',
            color: voiceGuidanceEnabled ? 'var(--neon-magenta)' : (isDarkMode ? '#94a3b8' : '#64748b'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '0.92rem',
            marginRight: '12px',
            boxShadow: voiceGuidanceEnabled ? '0 0 10px rgba(255, 0, 127, 0.25)' : 'none',
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
            border: '1.5px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            color: isDarkMode ? 'var(--neon-cyan)' : '#475569',
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
              border: '2px solid var(--neon-cyan)',
              background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.15), rgba(255, 0, 127, 0.15))',
              color: '#ffffff',
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

    </nav>
  );
}
