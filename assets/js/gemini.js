// JTLW Agent — Gemini 1.5 Flash API wrapper
import { CONFIG } from './config.js';

export class GeminiClient {
  constructor(apiKey = '') {
    this.apiKey = apiKey;
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Send a prompt to Gemini and return the raw text response.
   * @param {string} prompt
   * @param {object} opts  { systemPrompt, temperature, maxTokens }
   */
  async generate(prompt, opts = {}) {
    if (!this.apiKey) {
      throw new Error(
        'Gemini API key not configured. Open Settings (⚙️) and add your key.'
      );
    }

    const { systemPrompt, temperature = 0.7, maxTokens = 8192 } = opts;

    const contents = [];
    if (systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. I am JTLW, ready to assist.' }],
      });
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const url = `${CONFIG.GEMINI_API_BASE}/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    });

    if (!response.ok) {
      let msg = `Gemini API error ${response.status}`;
      try {
        const errData = await response.json();
        if (errData.error?.message) msg = errData.error.message;
      } catch (_) { /* ignore */ }
      throw new Error(msg);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini.');
    return text;
  }

  /**
   * Send a prompt and parse the JSON object from the response.
   */
  async generateJSON(prompt, opts = {}) {
    const raw = await this.generate(prompt, { ...opts, temperature: 0.3 });

    // Strip optional markdown code fences
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // Find the first { ... } block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Gemini did not return a JSON object.');

    try {
      return JSON.parse(match[0]);
    } catch (e) {
      throw new Error(`Failed to parse Gemini JSON: ${e.message}`);
    }
  }
}
