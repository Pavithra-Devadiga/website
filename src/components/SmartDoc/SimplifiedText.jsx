import { useState, useId } from 'react';

export default function SimplifiedText({
  simplifiedText,
  replacedTermsCount,
  replacedTermsList,
  onListen,
  isSpeakingThis
}) {
  const [copied, setCopied] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const simplifiedCardId = useId();

  const handleCopy = async () => {
    if (!simplifiedText) return;
    try {
      await navigator.clipboard.writeText(simplifiedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const charCount = simplifiedText.length;
  const wordCount = simplifiedText.trim() === '' ? 0 : simplifiedText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="content-card simplified-card" aria-labelledby={simplifiedCardId}>
      <div className="card-header">
        <div className="header-left">
          <span className="card-icon" aria-hidden="true">💡</span>
          <div>
            <h3 id={simplifiedCardId} className="card-title">Simple Explanation</h3>
            <span className="card-hint">Easy-to-understand plain language with jargon removed</span>
          </div>
        </div>

        <div className="header-right">
          {replacedTermsCount > 0 && (
            <span className="badge badge-success">
              {replacedTermsCount} terms simplified
            </span>
          )}
          <div className="counts-pill" aria-live="polite">
            <span><strong>{charCount}</strong> chars</span>
            <span className="divider" aria-hidden="true">•</span>
            <span><strong>{wordCount}</strong> words</span>
          </div>
        </div>
      </div>

      {/* Simplified Text Display */}
      <div className="simplified-content-box" tabIndex={0} role="region" aria-label="Simplified text content">
        <p className="simplified-paragraph">{simplifiedText}</p>
      </div>

      {/* Glossary of translated terms toggle if terms were replaced */}
      {replacedTermsList && replacedTermsList.length > 0 && (
        <div className="glossary-section">
          <button
            type="button"
            className="glossary-toggle-btn"
            onClick={() => setShowGlossary(!showGlossary)}
            aria-expanded={showGlossary}
          >
            <span aria-hidden="true">{showGlossary ? '▼' : '▶'}</span>
            <span>View {replacedTermsList.length} simplified terms & plain definitions</span>
          </button>

          {showGlossary && (
            <ul className="glossary-list" aria-label="List of simplified jargon terms">
              {replacedTermsList.map((item, idx) => (
                <li key={idx} className="glossary-item">
                  <span className="glossary-original">{item.term}</span>
                  <span className="glossary-arrow" aria-hidden="true">→</span>
                  <span className="glossary-simple">{item.simple}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="card-actions-row">
        <div className="actions-left">
          {/* Copy Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopy}
            disabled={!simplifiedText.trim()}
            aria-label="Copy simplified text to clipboard"
          >
            <span aria-hidden="true">{copied ? '✓' : '📋'}</span>
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>

        <div className="actions-right">
          {/* Listen Button for Simplified Text */}
          <button
            type="button"
            className={`btn btn-large ${isSpeakingThis ? 'btn-active-speaking' : 'btn-primary'}`}
            onClick={onListen}
            disabled={!simplifiedText.trim()}
            aria-label="Listen to simplified text aloud"
          >
            <span aria-hidden="true">🔊</span>
            <span>{isSpeakingThis ? 'Listening to Simple...' : 'Listen to Simple Text'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
