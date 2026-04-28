// JTLW Agent — Settings (localStorage-backed)
import { CONFIG } from './config.js';

const DEFAULTS = {
  geminiApiKey: '',
  alphaVantageKey: '',
  githubToken: '',
  githubRepo: '',           // e.g. "Codesurfing10/JTLW"
  speechSynthesisEnabled: true,
  speechRate: 1.0,
};

export class Settings {
  constructor() {
    this._data = { ...DEFAULTS };
    this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem(CONFIG.STORAGE_SETTINGS);
      if (saved) {
        this._data = { ...DEFAULTS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('JTLW: Failed to load settings:', e);
    }
  }

  save() {
    try {
      localStorage.setItem(CONFIG.STORAGE_SETTINGS, JSON.stringify(this._data));
    } catch (e) {
      console.warn('JTLW: Failed to save settings:', e);
    }
  }

  get(key) {
    return this._data[key];
  }

  update(updates) {
    this._data = { ...this._data, ...updates };
    this.save();
  }

  hasGeminiKey() {
    return !!this._data.geminiApiKey;
  }

  hasAlphaVantageKey() {
    return !!this._data.alphaVantageKey;
  }

  hasGitHubConfig() {
    return !!(this._data.githubToken && this._data.githubRepo);
  }
}
