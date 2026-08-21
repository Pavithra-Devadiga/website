/**
 * Voice Command & Speech-to-Text Service
 * Provides Speech Recognition for:
 * 1. Command Mode (Controlling Smart Doc actions via natural voice commands)
 * 2. Dictation Mode (Live transcription of spoken voice into editable text with zero duplication)
 * 3. Intelligent Form Field Extraction (Voice-assisted form filling)
 */

export const VOICE_ACTIONS = {
  SIMPLIFY: 'SIMPLIFY',
  READ_ORIGINAL: 'READ_ORIGINAL',
  READ_SIMPLIFIED: 'READ_SIMPLIFIED',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  STOP: 'STOP',
  COPY_ORIGINAL: 'COPY_ORIGINAL',
  COPY_SIMPLIFIED: 'COPY_SIMPLIFIED',
  START_OVER: 'START_OVER',
  FILL_FORM: 'FILL_FORM',
  SUBMIT_FORM: 'SUBMIT_FORM',
  CONFIRM_YES: 'CONFIRM_YES',
  CONFIRM_NO: 'CONFIRM_NO'
};

class VoiceCommandService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.currentMode = 'command'; // 'command' | 'dictation'
    this.onResultCallback = null;
    this.onCommandCallback = null;
    this.onStatusChangeCallback = null;
    this.onErrorCallback = null;
  }

  /**
   * Check if the browser supports Speech Recognition
   */
  isSupported() {
    return typeof window !== 'undefined' && (
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    );
  }

  /**
   * Get SpeechRecognition Constructor
   */
  getRecognitionClass() {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  /**
   * Parse spoken text and identify if it matches a known Smart Doc voice command
   * @param {string} rawText Spoken text
   * @returns {{ action: string, label: string, confidence: number } | null}
   */
  parseCommand(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    // Normalize and clean punctuation for natural intent matching
    const cleanText = rawText.toLowerCase().replace(/[,.?!]/g, '').trim();

    // Confirmation commands
    if (/^(yes|confirm|yes please|yes submit|yes submit it|submit it|go ahead|proceed)(\s|$)/i.test(cleanText)) {
      return { action: VOICE_ACTIONS.CONFIRM_YES, label: 'Confirming action' };
    }
    if (/^(no|cancel|no cancel|do not submit|dont submit|no dont submit|abort)(\s|$)/i.test(cleanText)) {
      return { action: VOICE_ACTIONS.CONFIRM_NO, label: 'Cancelling action' };
    }

    // Simplification commands
    if (/simplify|make simple|explain simply|simplify this document|simplify document|convert to simple/i.test(cleanText)) {
      return { action: VOICE_ACTIONS.SIMPLIFY, label: 'Simplifying document...' };
    }

    // Playback commands
    if (/read (the )?simplified|listen to (the )?simplified|listen simplified|read simple version|listen to simple/i.test(cleanText)) {
      return { action: VOICE_ACTIONS.READ_SIMPLIFIED, label: 'Reading simplified text aloud...' };
    }
    if (/read (the )?original|read this document|read document|read text|read aloud/i.test(cleanText)) {
      return { action: VOICE_ACTIONS.READ_ORIGINAL, label: 'Reading original document aloud...' };
    }
    if (/^pause(\s+(reading|speech|playback|audio))?$/i.test(cleanText)) {
      return { action: VOICE_ACTIONS.PAUSE, label: 'Pausing playback...' };
    }
    if (/^resume(\s+(reading|speech|playback|audio))?$/i.test(cleanText) || /^continue(\s+(reading|speech))?$/i.test(cleanText)) {
      return { action: VOICE_ACTIONS.RESUME, label: 'Resuming playback...' };
    }
    if (/^stop(\s+(reading|speech|playback|audio))?$/i.test(cleanText) || /^cancel(\s+speech)?$/i.test(cleanText)) {
      return { action: VOICE_ACTIONS.STOP, label: 'Stopping playback...' };
    }

    // Copy commands
    if (/copy (the )?simplified( text)?/i.test(cleanText)) {
      return { action: VOICE_ACTIONS.COPY_SIMPLIFIED, label: 'Copying simplified text...' };
    }
    if (/copy (the )?(original|document|text)/i.test(cleanText)) {
      return { action: VOICE_ACTIONS.COPY_ORIGINAL, label: 'Copying original text...' };
    }

    // Form commands
    if (/submit (the )?form/i.test(cleanText)) {
      return { action: VOICE_ACTIONS.SUBMIT_FORM, label: 'Preparing form submission...' };
    }
    if (/fill form|fill by voice|voice form/i.test(cleanText)) {
      return { action: VOICE_ACTIONS.FILL_FORM, label: 'Focusing voice form...' };
    }

    // Reset commands
    if (/start over|clear document|clear all|reset/i.test(cleanText)) {
      return { action: VOICE_ACTIONS.START_OVER, label: 'Starting over...' };
    }

    return null;
  }

  /**
   * Start Speech Recognition in Command or Dictation mode
   */
  startListening(options = {}) {
    if (!this.isSupported()) {
      if (options.onError) {
        options.onError(new Error('Speech Recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.'));
      }
      return;
    }

    // Stop existing session if running
    this.stopListening();

    const SpeechRecClass = this.getRecognitionClass();
    const rec = new SpeechRecClass();

    this.recognition = rec;
    this.currentMode = options.mode || 'command';
    this.onResultCallback = options.onResult || null;
    this.onCommandCallback = options.onCommand || null;
    this.onStatusChangeCallback = options.onStatusChange || null;
    this.onErrorCallback = options.onError || null;

    rec.continuous = options.continuous ?? (this.currentMode === 'dictation');
    rec.interimResults = true;
    rec.lang = options.lang || 'en-US';

    rec.onstart = () => {
      this.isListening = true;
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback('listening');
      }
    };

    rec.onresult = (event) => {
      let finalChunk = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalChunk += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      // In Dictation Mode: Send finalized chunk separately from transient interim text
      if (this.onResultCallback) {
        this.onResultCallback({
          finalChunk: finalChunk.trim(),
          interimTranscript: interimTranscript.trim(),
          isFinal: Boolean(finalChunk.trim())
        });
      }

      // In Command Mode: If final, parse commands
      if (this.currentMode === 'command' && finalChunk.trim()) {
        const command = this.parseCommand(finalChunk);
        if (command && this.onCommandCallback) {
          this.onCommandCallback({
            command,
            rawText: finalChunk.trim()
          });
        }
      }
    };

    rec.onerror = (event) => {
      // Ignore normal abort / no-speech events from user silence
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }

      this.isListening = false;
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback('error');
      }

      if (this.onErrorCallback) {
        let msg = 'Speech recognition error.';
        if (event.error === 'not-allowed') {
          msg = 'Microphone access was denied. Please allow microphone permissions in your browser.';
        } else if (event.error === 'network') {
          msg = 'Network connection issue during speech recognition.';
        }
        this.onErrorCallback(new Error(msg));
      }
    };

    rec.onend = () => {
      this.isListening = false;
      if (this.onStatusChangeCallback) {
        this.onStatusChangeCallback('ready');
      }
    };

    try {
      rec.start();
    } catch (err) {
      console.error('Recognition Start Error:', err);
      if (this.onErrorCallback) {
        this.onErrorCallback(err);
      }
    }
  }

  /**
   * Stop Speech Recognition
   */
  stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Safe ignore
      }
      this.recognition = null;
    }
    this.isListening = false;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback('ready');
    }
  }
}

export const voiceCommandService = new VoiceCommandService();
export default voiceCommandService;
