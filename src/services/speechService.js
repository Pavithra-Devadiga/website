/**
 * Speech Service
 * Modular Web Speech API wrapper with strict regional voice checking
 * (Kannada, Hindi, English).
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', matchPrefix: 'en', defaultTag: 'en-US', requiresStrictVoice: false },
  { code: 'hi', label: 'Hindi (हिंदी)', matchPrefix: 'hi', defaultTag: 'hi-IN', requiresStrictVoice: true },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)', matchPrefix: 'kn', defaultTag: 'kn-IN', requiresStrictVoice: true }
];

class SpeechService {
  constructor() {
    this.currentUtterance = null;
    this.isPausedState = false;
  }

  /**
   * Check if browser supports Web Speech API SpeechSynthesis
   */
  isSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  /**
   * Get list of currently available voices from the browser
   */
  getVoices() {
    if (!this.isSupported()) return [];
    return window.speechSynthesis.getVoices() || [];
  }

  /**
   * Subscribes to voiceschanged event and returns an unsubscribe function
   */
  onVoicesChanged(callback) {
    if (!this.isSupported()) return () => {};

    const handler = () => {
      const voices = this.getVoices();
      callback(voices);
    };

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.addEventListener('voiceschanged', handler);
    }

    // Call once immediately in case voices are already loaded
    const initialVoices = this.getVoices();
    if (initialVoices.length > 0) {
      callback(initialVoices);
    }

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
    };
  }

  /**
   * Filter voices matching a specific language code
   */
  getVoicesForLanguage(voices, langCode) {
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
    const prefix = langObj ? langObj.matchPrefix.toLowerCase() : langCode.toLowerCase();

    return (voices || []).filter((voice) => {
      const vLang = (voice.lang || '').toLowerCase().replace('_', '-');
      return vLang.startsWith(prefix) || vLang.includes(prefix);
    });
  }

  /**
   * Checks if an installed browser voice exists for a specific language
   */
  hasVoiceForLanguage(voices, langCode) {
    const matching = this.getVoicesForLanguage(voices, langCode);
    return matching.length > 0;
  }

  /**
   * Select best voice for the chosen language.
   * If requiresStrictVoice is true and no native voice is installed, returns null.
   */
  getBestVoice(voices, langCode) {
    if (!voices || voices.length === 0) return null;

    const matchingVoices = this.getVoicesForLanguage(voices, langCode);
    if (matchingVoices.length > 0) {
      return matchingVoices.find((v) => v.default) || matchingVoices[0];
    }

    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
    if (langObj && langObj.requiresStrictVoice) {
      // Do not return an English voice pretending to be Kannada or Hindi!
      return null;
    }

    // Default English fallback for English or general speech
    const defaultVoice = voices.find((v) => v.default);
    if (defaultVoice) return defaultVoice;

    const englishVoice = voices.find((v) => (v.lang || '').toLowerCase().startsWith('en'));
    return englishVoice || voices[0];
  }

  /**
   * Speaks the provided text with given configurations
   */
  speak(text, options = {}) {
    if (!this.isSupported()) {
      if (options.onError) {
        options.onError(new Error('Web Speech API is not supported in this browser.'));
      }
      return;
    }

    const trimmedText = (text || '').trim();
    if (!trimmedText) {
      if (options.onError) {
        options.onError(new Error('Please enter or extract some text to read aloud.'));
      }
      return;
    }

    const langCode = options.lang || 'en';
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);

    // Strict validation for Kannada and Hindi:
    // Do NOT silently read Kannada / Hindi text using an English voice!
    if (langObj && langObj.requiresStrictVoice) {
      const availableVoices = this.getVoices();
      const hasVoice = this.hasVoiceForLanguage(availableVoices, langCode);
      if (!hasVoice && !options.voice) {
        const errorMsg = `No ${langObj.label.split(' ')[0]} text-to-speech voice is installed in this browser.`;
        if (options.onError) {
          options.onError(new Error(errorMsg));
        }
        return;
      }
    }

    // Cancel any ongoing speech before starting new utterance
    this.stop();

    const utterance = new SpeechSynthesisUtterance(trimmedText);
    this.currentUtterance = utterance; // Retain reference to prevent garbage collection drop

    if (options.voice) {
      utterance.voice = options.voice;
      utterance.lang = options.voice.lang;
    } else if (options.lang) {
      const best = this.getBestVoice(this.getVoices(), options.lang);
      if (best) {
        utterance.voice = best;
        utterance.lang = best.lang;
      } else {
        utterance.lang = langObj?.defaultTag || options.lang;
      }
    }

    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    utterance.onstart = () => {
      this.isPausedState = false;
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      this.isPausedState = false;
      this.currentUtterance = null;
      if (options.onEnd) options.onEnd();
    };

    utterance.onpause = () => {
      this.isPausedState = true;
      if (options.onPause) options.onPause();
    };

    utterance.onresume = () => {
      this.isPausedState = false;
      if (options.onResume) options.onResume();
    };

    utterance.onerror = (event) => {
      this.isPausedState = false;
      this.currentUtterance = null;
      // Normal stop/cancel fires canceled error
      if (event.error === 'canceled' || event.error === 'interrupted') {
        if (options.onEnd) options.onEnd();
        return;
      }
      if (options.onError) {
        options.onError(new Error(event.error || 'An error occurred during speech playback.'));
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Pause current speech
   */
  pause(onPauseCallback) {
    if (!this.isSupported()) return;
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      this.isPausedState = true;
      if (onPauseCallback) onPauseCallback();
    }
  }

  /**
   * Resume paused speech
   */
  resume(onResumeCallback) {
    if (!this.isSupported()) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      this.isPausedState = false;
      if (onResumeCallback) onResumeCallback();
    }
  }

  /**
   * Stop/cancel current speech
   */
  stop(onStopCallback) {
    if (!this.isSupported()) return;
    this.isPausedState = false;
    this.currentUtterance = null;
    window.speechSynthesis.cancel();
    if (onStopCallback) onStopCallback();
  }

  /**
   * Check if speech is currently active
   */
  isSpeaking() {
    if (!this.isSupported()) return false;
    return window.speechSynthesis.speaking;
  }

  /**
   * Check if speech is paused
   */
  isPaused() {
    if (!this.isSupported()) return false;
    return window.speechSynthesis.paused || this.isPausedState;
  }
}

export const speechService = new SpeechService();
export default speechService;
