import React, { useState, useEffect } from 'react';
import DynamicHeroGraphic from './DynamicHeroGraphic';

export default function Dashboard({ 
  userName, 
  t, 
  onPanelSwitch, 
  voiceNavEnabled, 
  setVoiceNavEnabled,
  voiceGuidanceEnabled,
  speakFeedback,
  isDarkMode
}) {
  
  const [currentText, setCurrentText] = useState("");
  const [currentLangIndex, setCurrentLangIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const titles = [
    "सुलभ",     // Hindi
    "SULABHA",    // English
    "ಸುಲಭ"     // Kannada
  ];

  useEffect(() => {
    const typeSpeed = isDeleting ? 40 : 100;
    const currentFullText = titles[currentLangIndex];
    
    let timer;
    if (!isDeleting && currentText === currentFullText) {
      // Pause before deleting
      timer = setTimeout(() => setIsDeleting(true), 1500);
    } else if (isDeleting && currentText === "") {
      // Move to next word after deleting
      setIsDeleting(false);
      setCurrentLangIndex((prev) => (prev + 1) % titles.length);
    } else {
      // Typing or Deleting
      timer = setTimeout(() => {
        setCurrentText(prev => 
          isDeleting 
            ? currentFullText.substring(0, prev.length - 1)
            : currentFullText.substring(0, prev.length + 1)
        );
      }, typeSpeed);
    }
    
    return () => clearTimeout(timer);
  }, [currentText, isDeleting, currentLangIndex]);

  const toolsCards = [
    { 
      id: 'panel-reader', 
      icon: 'fa-file-contract', 
      titleKey: 'card-reader-title', 
      descKey: 'card-reader-desc', 
      themeClass: 'theme-purple',
    },
    { 
      id: 'panel-voice', 
      icon: 'fa-microphone', 
      titleKey: 'card-voice-title', 
      descKey: 'card-voice-desc', 
      themeClass: 'theme-blue',
    }
  ];

  const learningCards = [
    { 
      id: 'panel-sign', 
      icon: 'fa-hands', 
      titleKey: 'card-sign-title', 
      descKey: 'card-sign-desc', 
      themeClass: 'theme-teal',
    },
    { 
      id: 'panel-braille', 
      icon: 'fa-braille', 
      titleKey: 'card-braille-title', 
      descKey: 'card-braille-desc', 
      themeClass: 'theme-amber',
    },
    { 
      id: 'panel-game', 
      icon: 'fa-gamepad', 
      titleKey: 'card-game-title', 
      descKey: 'card-game-desc', 
      themeClass: 'theme-magenta',
    },
    { 
      id: 'panel-simulators', 
      icon: 'fa-eye-low-vision', 
      titleKey: 'card-sims-title', 
      descKey: 'card-sims-desc', 
      themeClass: 'theme-violet',
    }
  ];

  const mapCards = [
    { 
      id: 'panel-map', 
      icon: 'fa-map-location-dot', 
      titleKey: 'card-map-title', 
      descKey: 'card-map-desc', 
      themeClass: 'theme-green',
    }
  ];

  const renderCard = (card) => (
    <div 
      key={card.id} 
      className={`theme-sulabha-card ${card.themeClass}`}
      onClick={() => onPanelSwitch(card.id)}
      onMouseEnter={() => {
        if (voiceGuidanceEnabled && speakFeedback) {
          speakFeedback(`${t(card.titleKey)}. ${t(card.descKey)}`);
        }
      }}
    >
      <div className="theme-card-badge-row">
        <div className="theme-card-icon-box">
          <i className={`fa-solid ${card.icon}`}></i>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h4>{t(card.titleKey)}</h4>
        </div>
      </div>

      <div className="theme-card-content">
        <p>{t(card.descKey)}</p>
      </div>
      
      <div className="theme-card-footer">
        <button type="button" className="theme-launch-btn">
          {t('launch-tool') || "Launch tool"} <i className="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    </div>
  );

  return (
    <div className="dashboard-layout-wrapper">
      
      <div className="dashboard-main-content">
        
        {/* 🌌 Split Hero Section */}
        <div className="hero-split-row">
          <div className="hero-text-block">
            <span className="hero-tagline">{t('hero-tagline')}</span>
            <h2 className="hero-title" style={{ minHeight: '1.2em' }}>
              {currentText}<span className="cursor-blink">|</span>
            </h2>
            <p className="hero-subtitle">{t('hero-subtitle')}</p>
            <p className="hero-desc">{t('hero-desc')}</p>
          </div>
          <div className="hero-cube-block">
            <DynamicHeroGraphic isDarkMode={isDarkMode} />
          </div>
        </div>

        {/* 📂 Categorized Sections */}
        <div className="themes-section" style={{ marginTop: '-40px' }}>
          <div className="themes-header" style={{ marginBottom: '24px' }}>
            <span className="section-pre">{t('explore-pre') || "EXPLORE ACCESSIBILITY"}</span>
            <h3 className="section-title">{t('explore-title') || "Themes & Inclusive Technologies"}</h3>
            <p className="section-subtitle">{t('explore-sub') || "Deploying real-world cognitive interfaces to bridge digital gaps."}</p>
          </div>

          <div className="dashboard-categories-container">
          
          {/* TOOLS Section */}
          <div className="dashboard-category">
            <h3 className="category-title">{t('cat-tools')}</h3>
            <div className="category-grid grid-tools">
              {toolsCards.map(renderCard)}
            </div>
          </div>

          {/* LEARNING Section */}
          <div className="dashboard-category">
            <h3 className="category-title">{t('cat-learning')}</h3>
            <div className="category-grid grid-learning">
              {learningCards.map(renderCard)}
            </div>
          </div>

          {/* INCLUSION MAP Section */}
          <div className="dashboard-category">
            <h3 className="category-title" style={{ textAlign: 'center', marginBottom: '20px' }}>{t('cat-map')}</h3>
            
            <div 
              className="live-location-card"
              onClick={() => onPanelSwitch('panel-map')}
              onMouseEnter={() => {
                if (voiceGuidanceEnabled && speakFeedback) {
                  speakFeedback(`${t('card-map-title')}. ${t('card-map-desc')}`);
                }
              }}
            >
              <div className="live-map-bg-area">
                <div className="live-map-pin">
                  <i className="fa-solid fa-location-dot"></i>
                </div>
              </div>
              
              <div className="live-map-footer">
                <div className="live-map-text">
                  <h4>{t('card-map-title')}</h4>
                  <p>{t('card-map-desc')}</p>
                </div>
                <button type="button" className="live-map-btn" aria-label="Launch tool">
                  <i className="fa-solid fa-paper-plane"></i>
                </button>
              </div>
            </div>

          </div>

          </div>
        </div>

        {/* 🌟 Minimal Footer */}
        <div style={{
          width: '100%',
          marginTop: '10px',
          padding: '24px 20px',
          background: 'linear-gradient(180deg, transparent 0%, rgba(15, 23, 42, 0.4) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, fontWeight: '500', letterSpacing: '1px' }}>
            Designed & Developed by <strong style={{ color: 'var(--text-main)', fontWeight: '800', letterSpacing: '1.5px' }}>Team ARPS</strong> &copy; 2026
          </p>
        </div>

      </div>
    </div>
  );
}
