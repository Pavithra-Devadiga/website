import { useState, useId } from 'react';

export default function OCRViewer({
  originalText,
  onTextChange,
  onSimplify,
  onReadAloud,
  isSpeakingThis,
  isSimplifying,
  confidence
}) {
  const [copied, setCopied] = useState(false);
  const textareaId = useId();
  const charWordId = useId();

  const charCount = originalText.length;
  const wordCount = originalText.trim() === '' ? 0 : originalText.trim().split(/\s+/).filter(Boolean).length;

  const handleCopy = async () => {
    if (!originalText) return;
    try {
      await navigator.clipboard.writeText(originalText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className="content-card ocr-card" aria-labelledby="original-text-title">
      <div className="card-header">
        <div className="header-left">
          <span className="card-icon" aria-hidden="true">📄</span>
          <div>
            <h3 id="original-text-title" className="card-title">Original Document Text</h3>
            <span className="card-hint">Extracted from image (editable if OCR made mistakes)</span>
          </div>
        </div>

        <div className="header-right">
          {confidence > 0 && (
            <span className="badge badge-neutral" title="OCR confidence score">
              Accuracy: ~{confidence}%
            </span>
          )}
          <div id={charWordId} className="counts-pill" aria-live="polite">
            <span><strong>{charCount}</strong> chars</span>
            <span className="divider" aria-hidden="true">•</span>
            <span><strong>{wordCount}</strong> words</span>
          </div>
        </div>
      </div>

      <div className="textarea-container">
        <textarea
          id={textareaId}
          className="app-textarea"
          value={originalText}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Extracted text will appear here. You can also edit it..."
          rows={6}
          aria-label="Editable original document text"
          aria-describedby={charWordId}
        />
      </div>

      <div className="card-actions-row">
        <div className="actions-left">
          {/* Copy Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopy}
            disabled={!originalText.trim()}
            aria-label="Copy original text to clipboard"
          >
            <span aria-hidden="true">{copied ? '✓' : '📋'}</span>
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          {/* Read Aloud Button for Original Text */}
          <button
            type="button"
            className={`btn ${isSpeakingThis ? 'btn-active-speaking' : 'btn-secondary'}`}
            onClick={onReadAloud}
            disabled={!originalText.trim()}
            aria-label="Read original text aloud"
          >
            <span aria-hidden="true">🔊</span>
            <span>{isSpeakingThis ? 'Reading Original...' : 'Read Aloud'}</span>
          </button>
        </div>

        <div className="actions-right">
          {/* Simplify Button */}
          <button
            type="button"
            className="btn btn-primary btn-simplify"
            onClick={onSimplify}
            disabled={!originalText.trim() || isSimplifying}
            aria-label="Simplify document text and remove jargon"
          >
            <span aria-hidden="true">{isSimplifying ? '⏳' : '✨'}</span>
            <span>{isSimplifying ? 'Simplifying...' : 'Simplify Language'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
