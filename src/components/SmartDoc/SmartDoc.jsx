import { useState, useEffect, useRef } from 'react';
import DocumentUploader from './DocumentUploader';
import OCRViewer from './OCRViewer';
import SimplifiedText from './SimplifiedText';
import SpeechControls from './SpeechControls';
import VoiceAssistant from './VoiceAssistant';
import VoiceForm from './VoiceForm';

import ocrService from '../../services/ocrService';
import simplifierService from '../../services/simplifierService';
import speechService from '../../services/speechService';
import { VOICE_ACTIONS } from '../../services/voiceCommandService';
import './SmartDoc.css';

export default function SmartDoc() {
  const isSpeechSupported = speechService.isSupported();

  // Upload & OCR State
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [ocrStatus, setOcrStatus] = useState('idle'); // 'idle' | 'processing' | 'success' | 'error'
  const [confidence, setConfidence] = useState(0);

  // Text Content State
  const [originalText, setOriginalText] = useState('');
  const [simplifiedText, setSimplifiedText] = useState('');
  const [replacedTermsCount, setReplacedTermsCount] = useState(0);
  const [replacedTermsList, setReplacedTermsList] = useState([]);
  const [isSimplifying, setIsSimplifying] = useState(false);

  // Speech State
  const [voices, setVoices] = useState([]);
  const [language, setLanguage] = useState('en');
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [speed, setSpeed] = useState(1);
  const [speechStatus, setSpeechStatus] = useState('ready'); // 'ready' | 'speaking' | 'paused' | 'error'
  const [activeSpeechTarget, setActiveSpeechTarget] = useState(null); // 'original' | 'simplified' | null
  const [appError, setAppError] = useState('');

  const isMountedRef = useRef(true);
  const formSectionRef = useRef(null);

  // Initialize SpeechSynthesis and voice listeners
  useEffect(() => {
    isMountedRef.current = true;

    if (!speechService.isSupported()) {
      return;
    }

    const unsubscribe = speechService.onVoicesChanged((availableVoices) => {
      if (!isMountedRef.current) return;
      setVoices(availableVoices);
    });

    return () => {
      isMountedRef.current = false;
      speechService.stop();
      unsubscribe();
    };
  }, []);

  // Compute active selected voice derived from state
  const matchingVoices = speechService.getVoicesForLanguage(voices, language);
  const activeVoiceURI = selectedVoiceURI && voices.some((v) => v.voiceURI === selectedVoiceURI)
    ? selectedVoiceURI
    : (speechService.getBestVoice(voices, language)?.voiceURI || (matchingVoices[0]?.voiceURI || ''));

  // Handle File Selection and automatic OCR extraction
  const handleFileSelected = (selectedFile) => {
    setAppError('');
    setFile(selectedFile);

    // Create object URL for preview if image
    if (selectedFile.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(selectedFile);
      setFilePreview(previewUrl);
    } else {
      setFilePreview(null);
    }

    // Run OCR immediately
    runOCR(selectedFile);
  };

  const handleFileRemoved = () => {
    handleStartOver();
  };

  // Run OCR on the selected file (Image or PDF)
  const runOCR = async (fileToProcess) => {
    const targetFile = fileToProcess || file;
    if (!targetFile) return;

    setOcrStatus('processing');
    setOcrProgress(5);
    setOcrStatusText('Loading document...');
    setAppError('');
    speechService.stop();
    setSpeechStatus('ready');
    setActiveSpeechTarget(null);

    try {
      const result = await ocrService.extractText(targetFile, {
        onProgress: ({ progress, status }) => {
          if (!isMountedRef.current) return;
          setOcrProgress(progress);
          setOcrStatusText(status);
        }
      });

      if (!isMountedRef.current) return;

      if (!result.text || result.text.trim() === '') {
        setOcrStatus('error');
        setAppError('No readable text was found in this document. Please try a clearer document or image.');
        return;
      }

      setOriginalText(result.text);
      setConfidence(result.confidence);
      setOcrStatus('success');
      setOcrStatusText('Text extracted successfully');
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('OCR Error:', err);
      setOcrStatus('error');
      setAppError(err.message || 'An error occurred while reading the document.');
    }
  };

  // Handle Text Simplification
  const handleSimplify = async () => {
    if (!originalText.trim()) {
      setAppError('Please ensure there is text to simplify.');
      return;
    }

    setIsSimplifying(true);
    setAppError('');
    speechService.stop();
    setSpeechStatus('ready');
    setActiveSpeechTarget(null);

    try {
      const result = await simplifierService.simplifyText(originalText);
      if (!isMountedRef.current) return;

      setSimplifiedText(result.simplifiedText);
      setReplacedTermsCount(result.replacedTermsCount);
      setReplacedTermsList(result.replacedTermsList);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Simplification Error:', err);
      setAppError(err.message || 'An error occurred during text simplification.');
    } finally {
      if (isMountedRef.current) {
        setIsSimplifying(false);
      }
    }
  };

  // Speech Handlers
  const handlePlaySpeech = (textToSpeak, targetType) => {
    if (!textToSpeak || !textToSpeak.trim()) {
      setAppError('No text available to read aloud.');
      return;
    }

    setAppError('');
    setActiveSpeechTarget(targetType);
    setSpeechStatus('speaking');

    const activeVoice = voices.find((v) => v.voiceURI === activeVoiceURI) || null;

    speechService.speak(textToSpeak, {
      voice: activeVoice,
      lang: language,
      rate: Number(speed),
      pitch: 1.0,
      onStart: () => {
        if (isMountedRef.current) setSpeechStatus('speaking');
      },
      onEnd: () => {
        if (isMountedRef.current) {
          setSpeechStatus('ready');
          setActiveSpeechTarget(null);
        }
      },
      onPause: () => {
        if (isMountedRef.current) setSpeechStatus('paused');
      },
      onResume: () => {
        if (isMountedRef.current) setSpeechStatus('speaking');
      },
      onError: (err) => {
        if (isMountedRef.current) {
          setSpeechStatus('error');
          setActiveSpeechTarget(null);
          setAppError(err?.message || 'Speech synthesis error.');
        }
      }
    });
  };

  const handlePauseSpeech = () => {
    speechService.pause(() => {
      setSpeechStatus('paused');
    });
  };

  const handleResumeSpeech = () => {
    speechService.resume(() => {
      setSpeechStatus('speaking');
    });
  };

  const handleStopSpeech = () => {
    speechService.stop(() => {
      setSpeechStatus('ready');
      setActiveSpeechTarget(null);
    });
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    setSelectedVoiceURI('');
    if (speechStatus === 'speaking' || speechStatus === 'paused') {
      speechService.stop();
      setSpeechStatus('ready');
      setActiveSpeechTarget(null);
    }
  };

  const handleSpeedChange = (newSpeed) => {
    setSpeed(newSpeed);
    if (speechStatus === 'speaking' && activeSpeechTarget) {
      const activeText = activeSpeechTarget === 'simplified' ? simplifiedText : originalText;
      const activeVoice = voices.find((v) => v.voiceURI === activeVoiceURI) || null;

      speechService.stop();
      setTimeout(() => {
        speechService.speak(activeText, {
          voice: activeVoice,
          lang: language,
          rate: newSpeed,
          onStart: () => setSpeechStatus('speaking'),
          onEnd: () => {
            setSpeechStatus('ready');
            setActiveSpeechTarget(null);
          },
          onPause: () => setSpeechStatus('paused'),
          onResume: () => setSpeechStatus('speaking'),
          onError: (err) => {
            setSpeechStatus('error');
            setActiveSpeechTarget(null);
            setAppError(err?.message || 'Error updating speech rate.');
          }
        });
      }, 50);
    }
  };

  // Voice Assistant command dispatcher
  const handleExecuteVoiceCommand = async (action) => {
    switch (action) {
      case VOICE_ACTIONS.SIMPLIFY:
        if (originalText.trim()) {
          handleSimplify();
        } else {
          setAppError('Please upload a document before simplifying.');
        }
        break;

      case VOICE_ACTIONS.READ_ORIGINAL:
        if (originalText.trim()) {
          handlePlaySpeech(originalText, 'original');
        } else {
          setAppError('No original document text available to read aloud.');
        }
        break;

      case VOICE_ACTIONS.READ_SIMPLIFIED:
        if (simplifiedText.trim()) {
          handlePlaySpeech(simplifiedText, 'simplified');
        } else if (originalText.trim()) {
          // Auto-simplify and then read
          await handleSimplify();
        } else {
          setAppError('No document text available.');
        }
        break;

      case VOICE_ACTIONS.PAUSE:
        handlePauseSpeech();
        break;

      case VOICE_ACTIONS.RESUME:
        handleResumeSpeech();
        break;

      case VOICE_ACTIONS.STOP:
        handleStopSpeech();
        break;

      case VOICE_ACTIONS.COPY_ORIGINAL:
        if (originalText) {
          try {
            await navigator.clipboard.writeText(originalText);
          } catch (e) {
            console.error(e);
          }
        }
        break;

      case VOICE_ACTIONS.COPY_SIMPLIFIED:
        if (simplifiedText) {
          try {
            await navigator.clipboard.writeText(simplifiedText);
          } catch (e) {
            console.error(e);
          }
        }
        break;

      case VOICE_ACTIONS.START_OVER:
        handleStartOver();
        break;

      case VOICE_ACTIONS.FILL_FORM:
        if (formSectionRef.current) {
          formSectionRef.current.scrollIntoView({ behavior: 'smooth' });
        }
        break;

      default:
        break;
    }
  };

  // Reset entire application to initial state
  const handleStartOver = () => {
    speechService.stop();
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setFile(null);
    setFilePreview(null);
    setOcrProgress(0);
    setOcrStatusText('');
    setOcrStatus('idle');
    setConfidence(0);
    setOriginalText('');
    setSimplifiedText('');
    setReplacedTermsCount(0);
    setReplacedTermsList([]);
    setIsSimplifying(false);
    setSpeechStatus('ready');
    setActiveSpeechTarget(null);
    setAppError('');
  };

  const hasOriginalText = Boolean(originalText && originalText.trim().length > 0);
  const hasSimplifiedText = Boolean(simplifiedText && simplifiedText.trim().length > 0);

  return (
    <div className="smartdoc-container">
      {/* Product Hero Header with exact required copy */}
      <header className="smartdoc-hero">
        <div className="hero-badge">
          <span className="hero-badge-icon" aria-hidden="true">📄</span>
          <span>Smart Doc</span>
        </div>
        <h1 className="hero-title">Make Every Document Easier.</h1>
        <p className="hero-subtitle">
          Read it. Understand it. Hear it.
        </p>
        <p className="hero-description">
          Turn complex documents into clear, accessible information.
        </p>
      </header>

      {/* Browser Support Notice if Web Speech not supported */}
      {!isSpeechSupported && (
        <div className="alert-box alert-warning" role="alert">
          <span className="alert-icon" aria-hidden="true">⚠️</span>
          <span>
            Web Speech API is not supported in this browser. You can still upload documents, perform OCR, and simplify text, but text-to-speech reading is unavailable.
          </span>
        </div>
      )}

      {/* Global Error Banner */}
      {appError && (
        <div className="alert-box alert-error" role="alert">
          <span className="alert-icon" aria-hidden="true">⚠️</span>
          <span>{appError}</span>
          <button
            type="button"
            className="alert-dismiss-btn"
            onClick={() => setAppError('')}
            aria-label="Dismiss error message"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. DOCUMENT UPLOADER */}
      <DocumentUploader
        file={file}
        filePreview={filePreview}
        ocrProgress={ocrProgress}
        ocrStatus={ocrStatus}
        ocrStatusText={ocrStatusText}
        onFileSelected={handleFileSelected}
        onFileRemoved={handleFileRemoved}
        onStartOCR={() => runOCR()}
        disabled={ocrStatus === 'processing'}
      />

      {/* 2. ORIGINAL EXTRACTED DOCUMENT TEXT */}
      {hasOriginalText && (
        <OCRViewer
          originalText={originalText}
          onTextChange={setOriginalText}
          onSimplify={handleSimplify}
          onReadAloud={() => handlePlaySpeech(originalText, 'original')}
          isSpeakingThis={speechStatus === 'speaking' && activeSpeechTarget === 'original'}
          isSimplifying={isSimplifying}
          confidence={confidence}
        />
      )}

      {/* 3. SIMPLE EXPLANATION */}
      {hasSimplifiedText && (
        <SimplifiedText
          simplifiedText={simplifiedText}
          replacedTermsCount={replacedTermsCount}
          replacedTermsList={replacedTermsList}
          onListen={() => handlePlaySpeech(simplifiedText, 'simplified')}
          isSpeakingThis={speechStatus === 'speaking' && activeSpeechTarget === 'simplified'}
        />
      )}

      {/* 4. VOICE & PLAYBACK CONTROLS */}
      {(hasOriginalText || hasSimplifiedText) && (
        <SpeechControls
          language={language}
          onLanguageChange={handleLanguageChange}
          voices={voices}
          selectedVoiceURI={activeVoiceURI}
          onVoiceChange={setSelectedVoiceURI}
          speed={speed}
          onSpeedChange={handleSpeedChange}
          speechStatus={speechStatus}
          activeTarget={activeSpeechTarget}
          onPause={handlePauseSpeech}
          onResume={handleResumeSpeech}
          onStop={handleStopSpeech}
          errorMessage={appError}
        />
      )}

      {/* 5. VOICE ASSISTANT & SPEECH-TO-TEXT (COMMAND & DICTATION MODES) */}
      <VoiceAssistant
        onExecuteCommand={handleExecuteVoiceCommand}
        onStartVoiceForm={() => {
          if (formSectionRef.current) {
            formSectionRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />

      {/* 6. ACCESSIBLE VOICE FORM FILLING */}
      <div ref={formSectionRef}>
        <VoiceForm documentText={originalText} />
      </div>

      {/* 7. START OVER / RESET ACTION */}
      {file && (
        <div className="start-over-container">
          <button
            type="button"
            className="btn btn-outline-danger btn-start-over"
            onClick={handleStartOver}
            aria-label="Start over with a new document"
          >
            <span aria-hidden="true">🔄</span>
            <span>Start Over with New Document</span>
          </button>
        </div>
      )}
    </div>
  );
}
