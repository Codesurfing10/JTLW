// JTLW Agent — Voice Recognition & Speech Synthesis

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

export class VoiceManager {
  /**
   * @param {object} handlers
   *   onStart()             — mic opened
   *   onEnd()               — mic closed
   *   onInterim(text)       — partial transcript
   *   onFinal(text)         — complete utterance
   *   onError(msg)          — error string
   */
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.recognition = null;
    this.listening = false;
    this.synthesis = window.speechSynthesis;
    this._supported = !!SpeechRecognition;
    this._init();
  }

  get supported() {
    return this._supported;
  }

  _init() {
    if (!this._supported) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.listening = true;
      this.handlers.onStart?.();
    };

    this.recognition.onend = () => {
      this.listening = false;
      this.handlers.onEnd?.();
    };

    this.recognition.onerror = (e) => {
      this.listening = false;
      const msgs = {
        'not-allowed': 'Microphone access denied. Please allow mic access.',
        'no-speech': 'No speech detected. Try again.',
        network: 'Network error during voice recognition.',
      };
      this.handlers.onError?.(msgs[e.error] || `Voice error: ${e.error}`);
    };

    this.recognition.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }
      if (interim) this.handlers.onInterim?.(interim);
      if (final) this.handlers.onFinal?.(final.trim());
    };
  }

  startListening() {
    if (!this._supported) {
      this.handlers.onError?.(
        'Speech recognition is not supported in this browser. Try Chrome or Edge.'
      );
      return;
    }
    if (this.listening) return;
    try {
      this.recognition.start();
    } catch (e) {
      // recognition may already be running
      console.warn('VoiceManager start error:', e);
    }
  }

  stopListening() {
    if (!this.listening) return;
    try {
      this.recognition.stop();
    } catch (e) {
      console.warn('VoiceManager stop error:', e);
    }
  }

  toggle() {
    if (this.listening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  /**
   * Speak text using Web Speech Synthesis.
   * @param {string} text
   * @param {object} opts  { rate, pitch, volume }
   */
  speak(text, opts = {}) {
    if (!this.synthesis || !text) return;
    this.synthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = opts.rate ?? 1.0;
    utter.pitch = opts.pitch ?? 1.0;
    utter.volume = opts.volume ?? 1.0;
    utter.lang = 'en-US';

    // Prefer a natural-sounding voice if available
    const voices = this.synthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang === 'en-US' && /google|natural|premium/i.test(v.name)
    );
    if (preferred) utter.voice = preferred;

    this.synthesis.speak(utter);
    return utter;
  }

  stopSpeaking() {
    this.synthesis?.cancel();
  }
}
