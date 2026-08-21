import { useState, useRef, useId } from 'react';
import ocrService from '../../services/ocrService';

export default function DocumentUploader({
  file,
  filePreview,
  ocrProgress,
  ocrStatus,
  ocrStatusText,
  onFileSelected,
  onFileRemoved,
  onStartOCR,
  disabled
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState('');
  const fileInputRef = useRef(null);
  const uploadAreaId = useId();
  const fileInputId = useId();

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    processFile(selected);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const processFile = (selectedFile) => {
    setLocalError('');
    const validation = ocrService.validateFile(selectedFile);

    if (!validation.valid) {
      setLocalError(validation.error);
      return;
    }

    onFileSelected(selectedFile);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isProcessing = ocrStatus === 'processing';
  const isPdf = file?.type === 'application/pdf' || file?.name?.toLowerCase().endsWith('.pdf');

  return (
    <section className="uploader-section" aria-labelledby={uploadAreaId}>
      <h2 id={uploadAreaId} className="sr-only">Document Upload</h2>

      {localError && (
        <div className="alert-box alert-error" role="alert">
          <span className="alert-icon" aria-hidden="true">⚠️</span>
          <span>{localError}</span>
        </div>
      )}

      {!file ? (
        <div
          className={`dropzone-card ${isDragOver ? 'dropzone-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Upload document by dropping here or clicking to select file"
        >
          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp, .pdf, application/pdf"
            onChange={handleFileChange}
            className="sr-only"
            tabIndex={-1}
            disabled={disabled}
          />
          <div className="dropzone-content">
            <div className="dropzone-icon" aria-hidden="true">📄</div>
            <h3 className="dropzone-heading">Drop your document here</h3>
            <p className="dropzone-sub">or</p>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              tabIndex={-1}
              aria-hidden="true"
            >
              Choose a file
            </button>
            <p className="dropzone-formats">Supported formats: JPG, PNG, JPEG, PDF</p>
          </div>
        </div>
      ) : (
        <div className="file-preview-card">
          <div className="file-info-row">
            {filePreview ? (
              <img
                src={filePreview}
                alt="Document preview"
                className="file-thumbnail"
              />
            ) : (
              <div className="file-icon-badge" aria-hidden="true">
                {isPdf ? '📕' : '📄'}
              </div>
            )}
            <div className="file-details">
              <div className="file-name" title={file.name}>
                <span aria-hidden="true">{isPdf ? '📕' : '📄'}</span> {file.name}
              </div>
              <div className="file-size">
                {formatFileSize(file.size)} {isPdf ? '• PDF Document' : '• Image'}
              </div>
            </div>

            {!isProcessing && (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={onFileRemoved}
                aria-label={`Remove file ${file.name}`}
              >
                <span aria-hidden="true">✕</span> Remove
              </button>
            )}
          </div>

          {/* Progress bar during OCR */}
          {isProcessing && (
            <div className="progress-container" aria-live="polite" role="status">
              <div className="progress-header">
                <span className="progress-status-text">
                  <span className="spinner-dot" aria-hidden="true"></span>
                  {ocrStatusText || 'Reading document...'}
                </span>
                <span className="progress-percent">{ocrProgress}%</span>
              </div>
              <div
                className="progress-bar-bg"
                role="progressbar"
                aria-valuenow={ocrProgress}
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.max(5, ocrProgress)}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* If uploaded but not yet started reading */}
          {ocrStatus === 'idle' && (
            <div className="ocr-action-prompt">
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={onStartOCR}
              >
                <span aria-hidden="true">✨</span> Extract Text from Document
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
