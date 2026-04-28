// JTLW Agent — Innovations Gallery (localStorage + optional GitHub API save)
import { CONFIG } from './config.js';

/**
 * @typedef {object} Innovation
 * @property {string} id
 * @property {string} type       — "creative" | "stocks" | "weather" | "general"
 * @property {string} title
 * @property {string} description
 * @property {string} timestamp  — ISO 8601
 * @property {string} [html]     — self-contained HTML for creative items
 * @property {object} [data]     — structured data for stocks/weather items
 */

export class Gallery {
  constructor() {
    this._items = [];
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_INNOVATIONS);
      this._items = raw ? JSON.parse(raw) : [];
    } catch (_) {
      this._items = [];
    }
  }

  _persist() {
    try {
      localStorage.setItem(CONFIG.STORAGE_INNOVATIONS, JSON.stringify(this._items));
    } catch (_) { /* ignore quota errors */ }
  }

  getAll() {
    return [...this._items].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
  }

  getById(id) {
    return this._items.find((i) => i.id === id) || null;
  }

  /**
   * Add a new innovation and persist it.
   * @param {Partial<Innovation>} item
   * @returns {Innovation}
   */
  add(item) {
    const innovation = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'general',
      title: 'Untitled',
      description: '',
      ...item,
    };
    this._items.unshift(innovation);
    this._persist();
    return innovation;
  }

  remove(id) {
    this._items = this._items.filter((i) => i.id !== id);
    this._persist();
  }

  clear() {
    this._items = [];
    this._persist();
  }

  /**
   * Optionally push the gallery to GitHub via the Contents API.
   * Requires a token with repo write scope.
   * @param {string} token  GitHub personal access token
   * @param {string} repo   "owner/repo" (e.g. "Codesurfing10/JTLW")
   */
  async saveToGitHub(token, repo) {
    if (!token || !repo) throw new Error('GitHub token and repo are required.');

    const apiBase = `https://api.github.com/repos/${repo}/contents/innovations/index.json`;
    const content = JSON.stringify(
      this._items.map((i) => {
        // Omit large HTML blobs from the JSON index to keep it small
        const { html: _html, ...rest } = i;
        return rest;
      }),
      null,
      2
    );
    const encoded = btoa(unescape(encodeURIComponent(content)));

    // Get current SHA (if file exists) to allow update
    let sha;
    try {
      const getRes = await fetch(apiBase, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (getRes.ok) {
        const data = await getRes.json();
        sha = data.sha;
      }
    } catch (_) { /* file may not exist yet */ }

    const body = {
      message: `chore: update innovations gallery [skip ci]`,
      content: encoded,
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(apiBase, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      throw new Error(err.message || `GitHub API error: ${putRes.status}`);
    }
  }
}
