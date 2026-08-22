import { useId } from 'react';
import speechService, { SUPPORTED_LANGUAGES } from '../../services/speechService';

export default function SpeechControls({
  language,
  onLanguageChange,
  voices,
  selectedVoiceURI,
  onVoiceChange,
  speed,
  onSpeedChange,
  speechStatus,
  activeTarget,
  onPause,
  onResume,
  onStop,
  errorMessage
}) {
  const langSelectId = useId();
  const voiceSelectId = useId();
  const speedSelectId = useId();
  const controlsRegionId = useId();

  const isSpeaking = speechStatus === 'speaking';
  const isPaused = speechStatus === 'paused';
  const isActive = isSpeaking || isPaused;

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === language);
  const matchingVoices = speechService.getVoicesForLanguage(voices, language);
  const hasVoiceForSelectedLang = matchingVoices.length > 0;

  // Determine available voices for the select dropdown
  const availableVoiceOptions = hasVoiceForSelectedLang ? matchingVoices : (currentLangObj?.requiresStrictVoice ? [] : voices);

  const getStatusBadge = () => {
    switch (speechStatus) {
      case 'speaking':
        return {
          icon: '🔊',
          label: 'Speaking',
          className: 'status-badge status-speaking',
          desc: activeTarget === 'simplified' ? 'Reading Simple Explanation...' : 'Reading Original Document...'
        };
      case 'paused':
        return {
          icon: '⏸',
          label: 'Paused',
          className: 'status-badge status-paused',
          desc: 'Speech is paused. Press Resume to continue.'
        };
      case 'error':
        return {
          icon: '⚠️',
          label: 'Error',
          className: 'status-badge status-error',
          desc: errorMessage || 'An error occurred.'
        };
      case 'ready':
      default:
        return {
          icon: '✨',
          label: 'Ready',
          className: 'status-badge status-ready',
          desc: 'Click "Read Aloud" or "Listen" on any section above.'
        };
    }
  };

  const statusInfo = getStatusBadge();

  return (
    <section className="speech-controls-card" aria-labelledby={controlsRegionId}>
      <div className="card-header">
        <div className="header-left">
          <span className="card-icon" aria-hidden="true">🎙️</span>
          <div>
            <h3 id={controlsRegionId} className="card-title">Voice & Playback Controls</h3>
            <span className="card-hint">Customize reader voice, speed, and language</span>
          </div>
        </div>

        <div className="header-right">
          <div className={statusInfo.className} role="status" aria-live="polite">
            <span className="status-dot" aria-hidden="true"></span>
            <span className="status-icon" aria-hidden="true">{statusInfo.icon}</span>
            <strong className="status-text">{statusInfo.label}</strong>
          </div>
        </div>
      </div>

      {/* Warning banner if Kannada / Hindi voice is missing in the browser */}
      {currentLangObj?.requiresStrictVoice && !hasVoiceForSelectedLang && (
        <div className="alert-box alert-warning" role="alert">
          <span className="alert-icon" aria-hidden="true">⚠️</span>
          <div>
            <strong>No {currentLangObj.label.split(' ')[0]} Voice Installed:</strong> No dedicated {currentLangObj.label} text-to-speech voice is currently installed in this browser or OS.
            <div className="alert-subnote">
              To hear {currentLangObj.label.split(' ')[0]} speech, install the language pack in your OS settings or open Google Chrome with online voice support.
            </div>
          </div>
        </div>
      )}

      {/* Select Controls Grid */}
      <div className="controls-grid">
        {/* Language Selector */}
        <div className="form-group">
          <label htmlFor={langSelectId} className="control-label">
            <span aria-hidden="true">🌐</span> Language
          </label>
          <select
            id={langSelectId}
            className="app-select"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            aria-label="Select speech language"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Voice Selector */}
        <div className="form-group">
          <label htmlFor={voiceSelectId} className="control-label">
            <span aria-hidden="true">🗣️</span> Voice
          </label>
          <select
            id={voiceSelectId}
            className="app-select"
            value={selectedVoiceURI}
            onChange={(e) => onVoiceChange(e.target.value)}
            disabled={availableVoiceOptions.length === 0}
            aria-label="Select speech voice actor"
          >
            {availableVoiceOptions.length === 0 ? (
              <option value="">No voice available for this language</option>
            ) : (
              availableVoiceOptions.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang}) {v.default ? '★ Default' : ''}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Speed Selector */}
        <div className="form-group">
          <label htmlFor={speedSelectId} className="control-label">
            <span aria-hidden="true">⚡</span> Speech Speed
          </label>
          <select
            id={speedSelectId}
            className="app-select"
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            aria-label="Select playback speed"
          >
            <option value={0.75}>0.75x (Slower)</option>
            <option value={1}>1x (Normal)</option>
            <option value={1.25}>1.25x (Brisk)</option>
            <option value={1.5}>1.5x (Fast)</option>
            <option value={2}>2x (Double Speed)</option>
          </select>
        </div>
      </div>

      {/* Playback Controls & Status Info */}
      <div className="playback-bar">
        <div className="playback-buttons">
          {/* Pause Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onPause}
            disabled={!isSpeaking}
            aria-label="Pause speech playback"
          >
            <span aria-hidden="true">⏸</span>
            <span>Pause</span>
          </button>

          {/* Resume Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onResume}
            disabled={!isPaused}
            aria-label="Resume paused speech"
          >
            <span aria-hidden="true">▶</span>
            <span>Resume</span>
          </button>

          {/* Stop Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onStop}
            disabled={!isActive}
            aria-label="Stop speech playback"
          >
            <span aria-hidden="true">⏹</span>
            <span>Stop</span>
          </button>
        </div>

        <div className="playback-status-detail">
          <span className="status-detail-text">{statusInfo.desc}</span>
        </div>
      </div>
    </section>
  );
}
