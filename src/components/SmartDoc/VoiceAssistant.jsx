import { useState, useEffect, useRef, useId } from 'react';
import voiceCommandService from '../../services/voiceCommandService';

export default function VoiceAssistant({
  onExecuteCommand,
  onStartVoiceForm
}) {
  const isSupported = voiceCommandService.isSupported();

  const [mode, setMode] = useState('command'); // 'command' | 'dictation'
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('ready'); // 'ready' | 'listening' | 'processing' | 'error'
  const [lastSpokenText, setLastSpokenText] = useState('');
  const [lastActionText, setLastActionText] = useState('');
  const [dictatedText, setDictatedText] = useState('');
  const [interimSpeech, setInterimSpeech] = useState('');
  const [dictationCopied, setDictationCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const liveRegionId = useId();
  const dictationTextareaId = useId();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      voiceCommandService.stopListening();
    };
  }, []);

  const handleToggleListening = () => {
    if (isListening) {
      voiceCommandService.stopListening();
      setIsListening(false);
      setStatus('ready');
      setInterimSpeech('');
      return;
    }

    setErrorMessage('');
    setIsListening(true);
    setStatus('listening');
    setInterimSpeech('');

    voiceCommandService.startListening({
      mode,
      onResult: ({ finalChunk, interimTranscript }) => {
        if (!isMountedRef.current) return;

        if (mode === 'dictation') {
          if (finalChunk) {
            setDictatedText((prev) => (prev ? `${prev} ${finalChunk}` : finalChunk));
          }
          setInterimSpeech(interimTranscript);
        } else {
          setLastSpokenText(finalChunk || interimTranscript);
        }
      },
      onCommand: ({ command, rawText }) => {
        if (!isMountedRef.current) return;
        setLastSpokenText(rawText);
        setLastActionText(command.label);
        setStatus('ready');
        setIsListening(false);

        if (onExecuteCommand) {
          onExecuteCommand(command.action);
        }
      },
      onStatusChange: (newStatus) => {
        if (!isMountedRef.current) return;
        setStatus(newStatus);
        if (newStatus !== 'listening') {
          setIsListening(false);
          setInterimSpeech('');
        }
      },
      onError: (err) => {
        if (!isMountedRef.current) return;
        setStatus('error');
        setIsListening(false);
        setInterimSpeech('');
        setErrorMessage(err.message || 'Speech recognition error.');
      }
    });
  };

  const handleCopyDictation = async () => {
    if (!dictatedText) return;
    try {
      await navigator.clipboard.writeText(dictatedText);
      setDictationCopied(true);
      setTimeout(() => setDictationCopied(false), 2000);
    } catch (e) {
      console.error('Copy Error:', e);
    }
  };

  const handleClearDictation = () => {
    setDictatedText('');
    setInterimSpeech('');
    setLastSpokenText('');
  };

  const quickCommands = [
    { label: 'Simplify Document', action: 'SIMPLIFY', icon: '✨' },
    { label: 'Read Original', action: 'READ_ORIGINAL', icon: '🔊' },
    { label: 'Read Simplified', action: 'READ_SIMPLIFIED', icon: '💡' },
    { label: 'Pause Speech', action: 'PAUSE', icon: '⏸' },
    { label: 'Resume Speech', action: 'RESUME', icon: '▶' },
    { label: 'Stop Speech', action: 'STOP', icon: '⏹' },
    { label: 'Copy Text', action: 'COPY_ORIGINAL', icon: '📋' },
    { label: 'Fill Form by Voice', action: 'FILL_FORM', icon: '📝' },
    { label: 'Start Over', action: 'START_OVER', icon: '🔄' }
  ];

  return (
    <section className="voice-assistant-card" aria-labelledby="va-title">
      <div className="card-header">
        <div className="header-left">
          <span className="card-icon" aria-hidden="true">🎙️</span>
          <div>
            <h3 id="va-title" className="card-title">Voice Assistant & Speech-to-Text</h3>
            <span className="card-hint">Control Smart Doc actions or dictate text hands-free</span>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="mode-toggle-group" role="tablist" aria-label="Speech to Text mode selection">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'command'}
            className={`mode-btn ${mode === 'command' ? 'mode-btn-active' : ''}`}
            onClick={() => {
              if (isListening) voiceCommandService.stopListening();
              setMode('command');
              setIsListening(false);
              setStatus('ready');
              setInterimSpeech('');
            }}
          >
            <span aria-hidden="true">⚡</span> Command Mode
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'dictation'}
            className={`mode-btn ${mode === 'dictation' ? 'mode-btn-active' : ''}`}
            onClick={() => {
              if (isListening) voiceCommandService.stopListening();
              setMode('dictation');
              setIsListening(false);
              setStatus('ready');
              setInterimSpeech('');
            }}
          >
            <span aria-hidden="true">✍️</span> Dictation Mode
          </button>
        </div>
      </div>

      {/* Browser Support Warning if SpeechRecognition not supported */}
      {!isSupported && (
        <div className="alert-box alert-warning" role="alert">
          <span className="alert-icon" aria-hidden="true">⚠️</span>
          <div>
            <strong>Voice Input Not Supported in this Browser:</strong> Speech recognition is available in Google Chrome, Microsoft Edge, and Safari. You can still use all mouse and keyboard controls normally.
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="alert-box alert-error" role="alert">
          <span className="alert-icon" aria-hidden="true">⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Voice Assistant Interaction Zone */}
      <div className="va-action-area">
        <div className="mic-control-row">
          <button
            type="button"
            className={`btn-mic ${isListening ? 'btn-mic-active' : ''}`}
            onClick={handleToggleListening}
            disabled={!isSupported}
            aria-label={isListening ? 'Stop listening to voice' : `Start voice input in ${mode} mode`}
          >
            <span className="mic-icon" aria-hidden="true">{isListening ? '🔴' : '🎙️'}</span>
            <span className="mic-label">
              {isListening
                ? (mode === 'command' ? 'Listening for Command...' : 'Dictating (Listening)...')
                : (mode === 'command' ? 'Speak a Command' : 'Start Dictation')}
            </span>
          </button>

          <div className="status-live-container" id={liveRegionId} role="status" aria-live="polite">
            <span className={`status-badge ${status === 'listening' ? 'status-speaking' : (status === 'error' ? 'status-error' : 'status-ready')}`}>
              <span className="status-dot" aria-hidden="true"></span>
              <strong>{status === 'listening' ? 'Listening...' : (status === 'error' ? 'Voice Error' : 'Microphone Ready')}</strong>
            </span>
          </div>
        </div>

        {/* COMMAND MODE DISPLAY */}
        {mode === 'command' && (
          <div className="command-feedback-box">
            {lastSpokenText ? (
              <div className="speech-result-display">
                <div className="speech-said-row">
                  <span className="speech-tag">You said:</span>
                  <span className="speech-text">"{lastSpokenText}"</span>
                </div>
                {lastActionText && (
                  <div className="speech-action-row">
                    <span className="action-tag">Action:</span>
                    <span className="action-text">{lastActionText}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="command-instructions">
                Click the microphone and speak naturally: <em>"Simplify this document"</em>, <em>"Read aloud"</em>, <em>"Pause"</em>, or <em>"Fill form by voice"</em>.
              </p>
            )}

            {/* Quick Command Chips */}
            <div className="command-chips-wrapper">
              <span className="chips-label">Quick Voice Commands:</span>
              <div className="command-chips">
                {quickCommands.map((cmd) => (
                  <button
                    key={cmd.action}
                    type="button"
                    className="cmd-chip"
                    onClick={() => {
                      if (cmd.action === 'FILL_FORM' && onStartVoiceForm) {
                        onStartVoiceForm();
                      } else if (onExecuteCommand) {
                        onExecuteCommand(cmd.action);
                      }
                    }}
                  >
                    <span aria-hidden="true">{cmd.icon}</span> {cmd.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DICTATION MODE DISPLAY */}
        {mode === 'dictation' && (
          <div className="dictation-box">
            <label htmlFor={dictationTextareaId} className="dictation-label">
              Dictated Text Note (Speech-to-Text)
            </label>
            <textarea
              id={dictationTextareaId}
              className="app-textarea"
              rows={4}
              value={dictatedText}
              onChange={(e) => setDictatedText(e.target.value)}
              placeholder="Speak to see your words typed here without duplication. Dictation mode will not execute commands..."
              aria-label="Editable transcribed dictation text"
            />

            {/* Live interim preview when user is currently speaking */}
            {interimSpeech && (
              <div className="interim-speech-preview" aria-live="polite">
                <span className="interim-label">Speaking:</span>
                <span className="interim-text">{interimSpeech}</span>
              </div>
            )}

            <div className="dictation-actions-row">
              <div className="dictation-counts">
                <span><strong>{dictatedText.length}</strong> chars</span>
                <span aria-hidden="true">•</span>
                <span><strong>{dictatedText.trim() === '' ? 0 : dictatedText.trim().split(/\s+/).filter(Boolean).length}</strong> words</span>
              </div>

              <div className="dictation-btn-group">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyDictation}
                  disabled={!dictatedText.trim()}
                  aria-label="Copy dictated text note"
                >
                  <span aria-hidden="true">{dictationCopied ? '✓' : '📋'}</span>
                  <span>{dictationCopied ? 'Copied!' : 'Copy Note'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={handleClearDictation}
                  disabled={!dictatedText}
                  aria-label="Clear dictated text note"
                >
                  <span aria-hidden="true">🗑️</span> Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
