import { useState, useEffect, useRef, useId } from 'react';
import formService from '../../services/formService';
import ocrService from '../../services/ocrService';
import voiceCommandService from '../../services/voiceCommandService';
import speechService from '../../services/speechService';

export default function VoiceForm({ documentText }) {
  const [fields, setFields] = useState([]);
  const [detectionSource, setDetectionSource] = useState('none'); // 'detected' | 'none'
  const [detectedCount, setDetectedCount] = useState(0);
  const [extractedOcrText, setExtractedOcrText] = useState('');

  // Form Document Upload & OCR State
  const [uploadedFormFile, setUploadedFormFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFormOcrProcessing, setIsFormOcrProcessing] = useState(false);
  const [formOcrProgress, setFormOcrProgress] = useState(0);
  const [formOcrStatusText, setFormOcrStatusText] = useState('');
  const [formUploadError, setFormUploadError] = useState('');
  const [showExtractedTextView, setShowExtractedTextView] = useState(false);

  // Voice Filling State
  const [isVoiceFilling, setIsVoiceFilling] = useState(false);
  const [voiceHint, setVoiceHint] = useState('');
  const [recentlyFilledFields, setRecentlyFilledFields] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState('');
  const [completedFormData, setCompletedFormData] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [validationWarnings, setValidationWarnings] = useState({});
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');

  const formLiveId = useId();
  const reviewModalId = useId();
  const addFieldModalId = useId();
  const fileInputRef = useRef(null);
  const isMountedRef = useRef(true);

  const [prevDocText, setPrevDocText] = useState(documentText);

  // Synchronize dynamic form fields when global document text changes during render (if no dedicated form file uploaded)
  if (!uploadedFormFile && documentText !== prevDocText) {
    setPrevDocText(documentText);
    if (documentText && documentText.trim().length > 0) {
      const result = formService.detectFormFields(documentText);
      setFields(result.fields);
      setDetectionSource(result.source);
      setDetectedCount(result.detectedCount);
      setExtractedOcrText(documentText);
      setSubmittedStatus('');
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      voiceCommandService.stopListening();
    };
  }, []);

  // Process uploaded form file using the existing Smart Doc OCR pipeline
  const processUploadedFormFile = async (file) => {
    if (!file) return;

    setFormUploadError('');
    setSubmittedStatus('');
    setCompletedFormData('');
    setShowExtractedTextView(false);

    // Validate file with existing OCR service validator
    const validation = ocrService.validateFile(file);
    if (!validation.valid) {
      setFormUploadError(validation.error || 'Please select a valid PDF, JPG, PNG, or JPEG file.');
      return;
    }

    setUploadedFormFile(file);
    setIsFormOcrProcessing(true);
    setFormOcrProgress(10);
    setFormOcrStatusText('Reading form...');

    try {
      // Execute existing OCR extraction pipeline
      const result = await ocrService.extractText(file, {
        onProgress: ({ progress, status }) => {
          if (!isMountedRef.current) return;
          setFormOcrProgress(Math.max(10, Math.min(85, progress)));
          setFormOcrStatusText(status || 'Extracting text...');
        }
      });

      if (!isMountedRef.current) return;

      const rawText = result.text || '';
      setExtractedOcrText(rawText);

      if (!rawText || rawText.trim() === '') {
        setIsFormOcrProcessing(false);
        setDetectionSource('none');
        setFields([]);
        setDetectedCount(0);
        setFormUploadError("We couldn't confidently detect fillable fields in this document.");
        return;
      }

      setFormOcrProgress(90);
      setFormOcrStatusText('Detecting fields...');

      // Detect fields from the extracted OCR text and positional metadata
      const detection = formService.detectFormFields(rawText, result.ocrData);

      setFields(detection.fields);
      setDetectionSource(detection.source);
      setDetectedCount(detection.detectedCount);
      setFormOcrProgress(100);
      setFormOcrStatusText('Form ready.');

      setTimeout(() => {
        if (isMountedRef.current) {
          setIsFormOcrProcessing(false);
        }
      }, 700);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Form OCR Error:', err);
      setIsFormOcrProcessing(false);
      setDetectionSource('none');
      setFields([]);
      setFormUploadError(err?.message || 'Failed to read and process the form. Please check if the file is valid.');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      processUploadedFormFile(droppedFile);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      processUploadedFormFile(selectedFile);
    }
  };

  const handleDropzoneKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const handleRemoveUploadedForm = () => {
    setUploadedFormFile(null);
    setFormUploadError('');
    setIsFormOcrProcessing(false);
    setFormOcrProgress(0);
    setFormOcrStatusText('');
    setSubmittedStatus('');
    setCompletedFormData('');
    setShowExtractedTextView(false);
    setFields([]);
    setDetectionSource('none');
    setDetectedCount(0);
    setExtractedOcrText('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFieldChange = (id, newValue) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, value: newValue } : f))
    );
    setSubmittedStatus('');
    if (validationErrors[id]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleToggleVoiceFill = () => {
    if (isVoiceFilling) {
      voiceCommandService.stopListening();
      setIsVoiceFilling(false);
      setVoiceHint('');
      return;
    }

    if (fields.length === 0) {
      setVoiceHint('Please upload a form document first to generate fillable fields.');
      return;
    }

    setSubmittedStatus('');
    setIsVoiceFilling(true);
    setVoiceHint('Listening... Speak naturally (e.g. "My account number is 1234567890" or "Set branch to Bengaluru")');

    voiceCommandService.startListening({
      mode: 'dictation',
      continuous: true,
      onResult: ({ finalChunk, interimTranscript }) => {
        if (!isMountedRef.current) return;
        const activeText = finalChunk || interimTranscript;
        if (!activeText) return;

        setVoiceHint(`Heard: "${activeText}"`);

        // Check for voice submission command
        if (/^(submit( the)? form|submit)$/i.test(activeText.trim())) {
          handleRequestSubmit();
          return;
        }

        // Match speech to fields
        setFields((prevFields) => {
          const matchResult = formService.matchSpeechToFields(activeText, prevFields);
          if (matchResult.changedFieldIds.length > 0) {
            setRecentlyFilledFields(matchResult.changedFieldIds);
            setTimeout(() => {
              if (isMountedRef.current) setRecentlyFilledFields([]);
            }, 3000);
            if (matchResult.actionMessage) {
              setVoiceHint(matchResult.actionMessage);
            }
          }
          return matchResult.updatedFields;
        });
      },
      onStatusChange: (status) => {
        if (!isMountedRef.current) return;
        if (status !== 'listening') {
          setIsVoiceFilling(false);
        }
      },
      onError: (err) => {
        if (!isMountedRef.current) return;
        setIsVoiceFilling(false);
        setVoiceHint(err.message || 'Voice input error.');
      }
    });
  };

  const handleRequestSubmit = (e) => {
    if (e) e.preventDefault();

    // Check if at least one field has a value
    const hasValues = fields.some((f) => f.value && f.value.trim() !== '');
    if (!hasValues) {
      setSubmittedStatus('Please fill in at least one field before submitting.');
      return;
    }

    // Format validation
    const valResult = formService.validateFields(fields);
    if (!valResult.isValid) {
      setValidationErrors(valResult.errors);
      setValidationWarnings(valResult.warnings || {});
      setSubmittedStatus('Please correct the highlighted format errors before submitting.');
      return;
    }

    setValidationErrors({});
    setValidationWarnings(valResult.warnings || {});
    setShowReviewModal(true);

    // Stop voice listening while reviewing
    voiceCommandService.stopListening();
    setIsVoiceFilling(false);

    // Speak confirmation prompt via TTS
    const promptText = 'Please review your information before submitting. Would you like to continue?';
    if (speechService.isSupported()) {
      speechService.speak(promptText, { rate: 1.0 });
    }
  };

  const handleConfirmSubmit = () => {
    setShowReviewModal(false);
    const exportStr = formService.exportFormData(fields);
    setCompletedFormData(exportStr);
    setSubmittedStatus('Form completed successfully! Your entered information has been safely structured.');

    if (speechService.isSupported()) {
      speechService.speak('Form completed successfully.', { rate: 1.0 });
    }
  };

  const handleCancelSubmit = () => {
    setShowReviewModal(false);
    setSubmittedStatus('Submission cancelled.');
  };

  const handleClearForm = () => {
    setFields((prev) => prev.map((f) => ({ ...f, value: '' })));
    setSubmittedStatus('');
    setVoiceHint('');
    setValidationErrors({});
    setValidationWarnings({});
    setCompletedFormData('');
  };

  const handleAddCustomField = (e) => {
    if (e) e.preventDefault();
    const label = newFieldLabel.trim();
    if (!label) return;

    const customField = {
      id: formService.generateFieldId(label) + '_' + (fields.length + 1),
      label: formService.toTitleCase(label),
      type: newFieldType || 'text',
      placeholder: `Enter ${formService.toTitleCase(label)}`,
      value: ''
    };

    setFields((prev) => [...prev, customField]);
    setDetectedCount((prev) => prev + 1);
    setDetectionSource('detected');
    setNewFieldLabel('');
    setShowAddFieldModal(false);
    setSubmittedStatus(`Added field "${customField.label}"`);
  };

  const handleCopyCompletedData = () => {
    if (!completedFormData) return;
    navigator.clipboard.writeText(completedFormData);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const isPdf = uploadedFormFile?.type === 'application/pdf' || uploadedFormFile?.name?.toLowerCase().endsWith('.pdf');

  return (
    <section id="voice-form-section" className="content-card voice-form-card" aria-labelledby="form-title">
      <div className="card-header">
        <div className="header-left">
          <span className="card-icon" aria-hidden="true">📝</span>
          <div>
            <h3 id="form-title" className="card-title">Fill Form by Voice</h3>
            <span className="card-hint">
              {detectionSource === 'detected' && fields.length > 0
                ? `✨ Auto-detected ${detectedCount} fillable fields from your uploaded document`
                : 'Upload a document or form to automatically extract and fill fields by voice'}
            </span>
          </div>
        </div>

        <div className="header-right">
          {detectionSource === 'detected' && fields.length > 0 && (
            <span className="badge badge-success">
              ✓ {fields.length} Fields Detected
            </span>
          )}

          {fields.length > 0 && (
            <button
              type="button"
              className={`btn btn-sm ${isVoiceFilling ? 'btn-mic-active' : 'btn-primary'}`}
              onClick={handleToggleVoiceFill}
              aria-label={isVoiceFilling ? 'Stop voice form filling' : 'Start filling form by voice'}
            >
              <span aria-hidden="true">{isVoiceFilling ? '🔴' : '🎙️'}</span>
              <span>{isVoiceFilling ? 'Listening for Details...' : 'Fill Form by Voice'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp, .pdf, application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
        aria-hidden="true"
      />

      {/* 1. DRAG AND DROP FORM UPLOAD AREA (BEFORE UPLOAD) */}
      {!uploadedFormFile ? (
        <div className="form-upload-container">
          <div
            tabIndex={0}
            role="region"
            aria-label="Upload form document drop zone. Press Enter or Space to choose a file"
            className={`form-dropzone ${isDragging ? 'form-dropzone-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onKeyDown={handleDropzoneKeyDown}
          >
            <span className="form-dropzone-icon" aria-hidden="true">📄</span>
            <h4 className="form-dropzone-heading">Drop your form here</h4>
            <span className="form-dropzone-or">or</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              Choose a file
            </button>
            <span className="form-dropzone-formats">
              Supported formats: PDF, JPG, PNG, JPEG
            </span>
          </div>

          <div className="form-instructions-box">
            <h5 className="instructions-title">💡 How Dynamic Voice Form Filling Works:</h5>
            <ol className="instructions-list">
              <li><strong>Upload any form or document:</strong> Bank application, college admission form, official invoice, or identity form.</li>
              <li><strong>Smart OCR & Field Discovery:</strong> The document is scanned and real fillable fields are dynamically generated.</li>
              <li><strong>Speak naturally:</strong> Use your voice to fill the detected fields hands-free.</li>
            </ol>
          </div>
        </div>
      ) : (
        /* 2. UPLOADED FORM FILE CARD WITH OCR FEEDBACK */
        <div className="form-file-card">
          <div className="form-file-header-row">
            <div className="form-file-info">
              <span className="form-file-icon" aria-hidden="true">
                {isPdf ? '📕' : '📄'}
              </span>
              <div className="form-file-details">
                <span className="form-file-name">{uploadedFormFile.name}</span>
                <span className="form-file-meta">
                  {isPdf ? 'PDF' : (uploadedFormFile.type?.split('/')[1]?.toUpperCase() || 'IMAGE')} • {formatFileSize(uploadedFormFile.size)}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={handleRemoveUploadedForm}
              aria-label={`Remove uploaded form ${uploadedFormFile.name}`}
            >
              Remove
            </button>
          </div>

          {/* OCR Processing Feedback Bar */}
          {isFormOcrProcessing && (
            <div className="form-ocr-progress-box" role="status" aria-live="polite">
              <div className="progress-header">
                <span className="progress-status-text">
                  <span className="spinner-dot" aria-hidden="true"></span>
                  <strong>{formOcrStatusText}</strong>
                </span>
                <span className="progress-percent">{formOcrProgress}%</span>
              </div>
              <div className="progress-bar-bg" aria-hidden="true">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${formOcrProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Error Banner */}
      {formUploadError && (
        <div className="alert-box alert-error" role="alert">
          <span className="alert-icon" aria-hidden="true">⚠️</span>
          <span>{formUploadError}</span>
          <button
            type="button"
            className="alert-dismiss-btn"
            onClick={() => setFormUploadError('')}
            aria-label="Dismiss error message"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. NO DETECTABLE FIELDS FALLBACK STATE */}
      {!isFormOcrProcessing && uploadedFormFile && fields.length === 0 && (
        <div className="no-fields-fallback-card" role="status">
          <span className="fallback-icon" aria-hidden="true">🔍</span>
          <h4 className="fallback-title">We couldn't confidently detect fillable fields in this document.</h4>
          <p className="fallback-desc">
            The document text was extracted, but standard labeled input blanks (e.g. "Name: ___") were not found.
          </p>

          <div className="fallback-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowExtractedTextView(!showExtractedTextView)}
            >
              <span aria-hidden="true">{showExtractedTextView ? '▲' : '👁️'}</span>
              <span>{showExtractedTextView ? 'Hide Extracted Text' : 'View Extracted Text'}</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAddFieldModal(true)}
            >
              <span aria-hidden="true">➕</span> Add Field Manually
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                handleRemoveUploadedForm();
                if (fileInputRef.current) fileInputRef.current.click();
              }}
            >
              <span aria-hidden="true">📁</span> Try Another Document
            </button>
          </div>

          {showExtractedTextView && extractedOcrText && (
            <div className="extracted-text-preview">
              <label htmlFor="extracted-ocr-preview" className="control-label">
                Extracted Document OCR Text:
              </label>
              <textarea
                id="extracted-ocr-preview"
                className="app-textarea"
                rows={6}
                value={extractedOcrText}
                readOnly
              />
            </div>
          )}
        </div>
      )}

      {/* Voice Guidance Note */}
      {voiceHint && (
        <div className="voice-form-hint" role="status" aria-live="polite">
          <span className="hint-icon" aria-hidden="true">💬</span>
          <span>{voiceHint}</span>
        </div>
      )}

      {/* Submission Status Message */}
      {submittedStatus && (
        <div
          className={`alert-box ${submittedStatus.includes('successfully') ? 'alert-success' : 'alert-warning'}`}
          role="status"
          aria-live="polite"
        >
          <span className="alert-icon" aria-hidden="true">
            {submittedStatus.includes('successfully') ? '✓' : 'ℹ️'}
          </span>
          <span>{submittedStatus}</span>
        </div>
      )}

      {/* 4. DYNAMIC FORM GRID (ONLY DISPLAYED IF FIELDS ARE DETECTED) */}
      {fields.length > 0 && (
        <form onSubmit={handleRequestSubmit} className="accessible-form">
          <div className="form-grid">
            {fields.map((field) => {
              const isUpdated = recentlyFilledFields.includes(field.id);
              const errorMsg = validationErrors[field.id];
              const warningMsg = validationWarnings[field.id];

              return (
                <div className="form-group" key={field.id}>
                  <label htmlFor={`form-field-${field.id}`} className="control-label">
                    <span>{field.label}</span>
                    {isUpdated && (
                      <span className="field-updated-badge" aria-live="polite">
                        ✓ Voice filled
                      </span>
                    )}
                  </label>
                  <input
                    id={`form-field-${field.id}`}
                    type={field.type || 'text'}
                    className={`app-input ${isUpdated ? 'input-highlight' : ''} ${errorMsg ? 'input-error' : ''}`}
                    placeholder={field.placeholder || `Enter ${field.label}`}
                    value={field.value || ''}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    aria-invalid={Boolean(errorMsg)}
                    aria-describedby={errorMsg ? `error-${field.id}` : undefined}
                  />
                  {errorMsg && (
                    <span id={`error-${field.id}`} className="field-error-text" role="alert">
                      {errorMsg}
                    </span>
                  )}
                  {!errorMsg && warningMsg && (
                    <span className="field-warning-text" role="status">
                      {warningMsg}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Form Action Buttons */}
          <div className="form-actions-row">
            <div className="actions-left">
              <button
                type="submit"
                className="btn btn-primary"
                aria-label="Review and submit form information"
              >
                <span aria-hidden="true">📤</span> Submit Form
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddFieldModal(true)}
                aria-label="Add a custom field manually"
              >
                <span aria-hidden="true">➕</span> Add Field
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClearForm}
                aria-label="Clear all form values"
              >
                <span aria-hidden="true">🗑️</span> Clear Values
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 5. COMPLETED FORM DATA CARD & EXPORT */}
      {completedFormData && (
        <div className="completed-form-card" role="region" aria-label="Completed Form Data">
          <div className="completed-form-header">
            <span className="card-icon" aria-hidden="true">📋</span>
            <div>
              <h4 className="completed-form-title">Structured Completed Form Data</h4>
              <span className="card-hint">Your form information is safely stored locally.</span>
            </div>
          </div>
          <pre className="completed-form-pre">{completedFormData}</pre>
          <div className="completed-form-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyCompletedData}
            >
              <span aria-hidden="true">{copiedSuccess ? '✓' : '📋'}</span>
              <span>{copiedSuccess ? 'Copied to Clipboard!' : 'Copy Form Data'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. MANUAL ADD FIELD MODAL */}
      {showAddFieldModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={addFieldModalId}
        >
          <div className="modal-card">
            <div className="modal-header">
              <span className="modal-icon" aria-hidden="true">➕</span>
              <h4 id={addFieldModalId} className="modal-title">Add Custom Field</h4>
            </div>

            <form onSubmit={handleAddCustomField} className="modal-summary">
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="custom-field-label-input" className="control-label">
                  Field Label:
                </label>
                <input
                  id="custom-field-label-input"
                  type="text"
                  className="app-input"
                  placeholder="e.g. Emergency Contact, Total Experience"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="custom-field-type-select" className="control-label">
                  Field Type:
                </label>
                <select
                  id="custom-field-type-select"
                  className="app-select"
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="tel">Phone / Mobile</option>
                  <option value="number">Number</option>
                </select>
              </div>

              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  aria-label="Add custom field"
                >
                  <span aria-hidden="true">✓</span> Add Field
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddFieldModal(false)}
                  aria-label="Cancel adding custom field"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. ACCESSIBLE REVIEW & SAFETY CONFIRMATION MODAL */}
      {showReviewModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={reviewModalId}
        >
          <div className="modal-card">
            <div className="modal-header">
              <span className="modal-icon" aria-hidden="true">🛡️</span>
              <h4 id={reviewModalId} className="modal-title">Review Your Information</h4>
            </div>

            <p className="modal-prompt" id={formLiveId}>
              "Please review your information before submitting."
            </p>

            <div className="modal-summary">
              <strong>Please review all detected fields and entered values:</strong>
              <ul className="modal-fields-list">
                {fields.map((f) => (
                  <li key={f.id}>
                    <strong>{f.label}:</strong> {f.value ? f.value : <span className="text-muted">[Not Provided]</span>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmSubmit}
                aria-label="Confirm and submit form"
              >
                <span aria-hidden="true">✓</span> Confirm & Submit
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowReviewModal(false)}
                aria-label="Edit form values before submitting"
              >
                <span aria-hidden="true">✏️</span> Edit
              </button>

              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={handleCancelSubmit}
                aria-label="Cancel form submission"
              >
                <span aria-hidden="true">✕</span> Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
