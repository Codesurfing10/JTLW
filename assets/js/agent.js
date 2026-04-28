// JTLW Agent — Main Orchestrator
import { CONFIG } from './config.js';
import { Settings } from './settings.js';
import { GeminiClient } from './gemini.js';
import { VoiceManager } from './voice.js';
import { fetchWeather, fetchTides, computeSailingScore } from './noaa.js';
import { fetchQuotes, getTopFivePicks } from './stocks.js';
import { Gallery } from './gallery.js';

// ─── Initialise core services ────────────────────────────────────────────────
const settings = new Settings();
const gemini = new GeminiClient(settings.get('geminiApiKey'));
const gallery = new Gallery();

// ─── DOM helpers ─────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function show(el) { el?.classList.add('visible'); }
function hide(el) { el?.classList.remove('visible'); }
function toggle(el) { el?.classList.toggle('visible'); }

function toast(msg, type = 'info', duration = 4000) {
  const container = $('#toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// ─── System prompt ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are JTLW — an advanced AI agent for voice-driven innovation. When given a command, respond with a JSON object ONLY in this exact schema:

{
  "intent": "stocks" | "weather_sailing" | "creative" | "general",
  "spoken_response": "Brief 1-3 sentence natural spoken answer",
  "display_response": "Full detailed answer in plain text or simple markdown",
  "save_to_gallery": true | false,
  "gallery_title": "Short descriptive title (max 60 chars)",
  "creative_html": "ONLY for creative intent: complete self-contained HTML document"
}

Rules:
- Always return valid JSON — nothing outside the JSON object.
- For "stocks" intent: analyse the request and return the spoken/display response. Do NOT include stock data in the JSON — it is fetched separately.
- For "weather_sailing" intent: do NOT include weather data in the JSON — it is fetched live from NOAA. Acknowledge the request and say results are being fetched.
- For "creative" intent: generate a COMPLETE self-contained HTML document in "creative_html" that:
  * Uses Three.js r128 from CDN: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
  * Fills the full viewport (100vw × 100vh, overflow hidden, dark background #0a0e1a)
  * Uses OrbitControls via a standalone script tag pointing to: https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
  * Adds ambient + directional + point lights for dramatic effect
  * Has a smooth requestAnimationFrame animation loop
  * Makes the 3D object interactive via OrbitControls
  * Is visually impressive with materials, colors, and geometry
  * Has a small on-screen label with the title in bottom-left (white, sans-serif)
  * set save_to_gallery: true
- For general queries: just answer helpfully.
`.trim();

// ─── Intent dispatch ─────────────────────────────────────────────────────────
async function handleIntent(transcript) {
  setStatus('processing');
  showWaveform(false);

  let parsed;
  try {
    parsed = await gemini.generateJSON(transcript, { systemPrompt: SYSTEM_PROMPT });
  } catch (err) {
    setStatus('ready');
    showError(err.message);
    return;
  }

  // Display spoken response in response card
  renderResponseCard(parsed.spoken_response, parsed.display_response);

  // Speak the response
  if (settings.get('speechSynthesisEnabled')) {
    voice.speak(parsed.spoken_response, { rate: settings.get('speechRate') });
  }

  // Route to specific data handler
  if (parsed.intent === 'stocks') {
    await handleStocksIntent(parsed);
  } else if (parsed.intent === 'weather_sailing') {
    await handleWeatherIntent(parsed);
  } else if (parsed.intent === 'creative' && parsed.creative_html) {
    handleCreativeIntent(transcript, parsed);
  }

  setStatus('ready');
}

async function handleStocksIntent(parsed) {
  showPanel('stocks');
  const grid = $('#stocks-grid');
  grid.innerHTML = '<div class="loading-msg"><span class="spinner"></span> Fetching stock data…</div>';

  try {
    let quotes = [];
    if (settings.hasAlphaVantageKey()) {
      quotes = await fetchQuotes(CONFIG.DEFAULT_WATCHLIST, settings.get('alphaVantageKey'));
    }
    const picks = await getTopFivePicks(gemini, CONFIG.DEFAULT_WATCHLIST, quotes);
    renderStockCards(picks);

    if (parsed.save_to_gallery !== false) {
      const innovation = gallery.add({
        type: 'stocks',
        title: parsed.gallery_title || 'Top 5 Stock Picks',
        description: parsed.display_response,
        data: { picks },
      });
      renderGallery();
      maybeGitHubSave();
      toast('Saved to Innovations Gallery', 'success');
    }
  } catch (err) {
    grid.innerHTML = `<div class="error-msg">❌ ${err.message}</div>`;
    toast(err.message, 'error');
  }
}

async function handleWeatherIntent(parsed) {
  showPanel('weather');
  const container = $('#weather-container');
  container.innerHTML = '<div class="loading-msg"><span class="spinner"></span> Fetching NOAA data…</div>';

  try {
    const [weather, tideData] = await Promise.all([fetchWeather(), fetchTides()]);
    const sailing = computeSailingScore(weather, tideData);

    renderWeatherPanel(weather, tideData, sailing);

    if (parsed.save_to_gallery !== false) {
      gallery.add({
        type: 'weather',
        title: parsed.gallery_title || `San Diego Conditions — ${new Date().toLocaleDateString()}`,
        description: sailing.summary,
        data: { weather, tideData, sailing },
      });
      renderGallery();
      maybeGitHubSave();
      toast('Saved to Innovations Gallery', 'success');
    }
  } catch (err) {
    container.innerHTML = `<div class="error-msg">❌ ${err.message}</div>`;
    toast(err.message, 'error');
  }
}

function handleCreativeIntent(transcript, parsed) {
  const html = parsed.creative_html;
  if (!html) return;

  const innovation = gallery.add({
    type: 'creative',
    title: parsed.gallery_title || transcript.slice(0, 60),
    description: parsed.display_response,
    html,
  });
  renderGallery();
  maybeGitHubSave();
  toast('3D Innovation saved to Gallery!', 'success');

  // Auto-open the viewer
  openViewer(innovation);
}

// ─── UI Rendering ─────────────────────────────────────────────────────────────
function renderResponseCard(spoken, display) {
  const card = $('#response-card');
  const body = $('#response-body');
  if (!card || !body) return;

  body.innerHTML = markdownToHtml(display || spoken || '');
  show(card);
}

function renderStockCards(picks) {
  const grid = $('#stocks-grid');
  if (!grid) return;
  if (!picks?.length) {
    grid.innerHTML = '<div class="error-msg">No stock picks returned.</div>';
    return;
  }

  grid.innerHTML = picks
    .map((p) => {
      const hasPrice = p.price != null;
      const changePct = parseFloat(p.changePercent ?? 0);
      const changeClass = changePct >= 0 ? 'up' : 'down';
      const changeStr = hasPrice
        ? `<span class="stock-change ${changeClass}">${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%</span>`
        : '';
      const priceStr = hasPrice
        ? `<div class="stock-price">${p.price} ${changeStr}</div>`
        : '';

      return `
        <div class="stock-card">
          <div class="rank">#${p.rank}</div>
          <div class="stock-ticker">${p.symbol}</div>
          <div class="stock-name">${p.name}</div>
          ${priceStr}
          ${p.theme ? `<div class="stock-theme">🏷️ ${p.theme}</div>` : ''}
          <div class="stock-reason">${p.reason}</div>
        </div>`;
    })
    .join('');
}

function renderWeatherPanel(weather, tideData, sailing) {
  const container = $('#weather-container');
  if (!container) return;

  const nextTides = tideData.tides
    .slice(0, 4)
    .map(
      (t) =>
        `<div class="tide-item">
          <span class="tide-type ${t.type.toLowerCase()}">${t.type === 'High' ? '▲' : '▼'} ${t.type}</span>
          <span class="tide-time">${t.time.split(' ')[1] || t.time}</span>
          <span class="tide-height">${t.height.toFixed(1)} ft</span>
        </div>`
    )
    .join('');

  const tempF = weather.temperature ?? '—';
  const humidity = weather.humidity != null ? `${weather.humidity}%` : '—';

  container.innerHTML = `
    <div class="weather-grid">
      <div class="weather-main">
        <div class="weather-icon">${weather.icon}</div>
        <div>
          <div class="weather-temp">${tempF}°${weather.temperatureUnit || 'F'}</div>
          <div class="weather-desc">${weather.description}</div>
          <div class="weather-location">📍 San Diego, CA</div>
        </div>
      </div>

      <div class="weather-stat-card">
        <div class="stat-label">💨 Wind</div>
        <div class="stat-value">${weather.windSpeed?.toFixed(0) ?? '—'}<span class="stat-unit"> mph</span></div>
        <div class="stat-unit">${weather.windDirection || ''}</div>
      </div>

      <div class="weather-stat-card">
        <div class="stat-label">💧 Humidity</div>
        <div class="stat-value">${humidity}</div>
      </div>

      <div class="weather-stat-card">
        <div class="stat-label">🌊 Current Tide</div>
        <div class="stat-value">${tideData.currentLevel != null ? tideData.currentLevel.toFixed(1) : '—'}<span class="stat-unit"> ft</span></div>
        <div class="stat-unit">${tideData.tideState}</div>
      </div>

      <div class="weather-stat-card">
        <div class="stat-label">⚓ Next Tides</div>
        <div class="tide-list">${nextTides || '—'}</div>
      </div>

      <div class="sailing-score">
        <div class="score-circle ${sailing.cssClass}">
          ${sailing.score}<div class="score-label">/100</div>
        </div>
        <div class="sailing-details">
          <h3>⛵ Sailing: ${sailing.label}</h3>
          <p>${sailing.summary}</p>
        </div>
      </div>
    </div>`;
}

function renderGallery() {
  const grid = $('#gallery-grid');
  if (!grid) return;

  const items = gallery.getAll();
  if (!items.length) {
    grid.innerHTML = `
      <div class="gallery-empty">
        <div class="empty-icon">🔬</div>
        <p>No innovations yet. Ask JTLW to create something!</p>
      </div>`;
    return;
  }

  const typeIcon = { creative: '🎨', stocks: '📈', weather: '🌊', general: '💡' };
  grid.innerHTML = items
    .map((item) => {
      const icon = typeIcon[item.type] || '💡';
      const date = new Date(item.timestamp).toLocaleString();
      return `
        <div class="gallery-card" data-id="${item.id}">
          <div class="card-preview">
            <span class="card-preview-icon">${icon}</span>
          </div>
          <div class="card-body">
            <span class="card-type-badge badge-${item.type}">${item.type}</span>
            <div class="card-title">${escHtml(item.title)}</div>
            <div class="card-timestamp">${date}</div>
            <div class="card-actions">
              ${item.html ? `<button class="btn btn-primary" onclick="window.jtlw.openViewerById('${item.id}')">🎮 View 3D</button>` : ''}
              <button class="btn btn-secondary" onclick="window.jtlw.deleteInnovation('${item.id}')">🗑️ Delete</button>
            </div>
          </div>
        </div>`;
    })
    .join('');
}

function openViewer(innovation) {
  const modal = $('#viewer-modal');
  const title = $('#viewer-title');
  const iframe = $('#viewer-iframe');
  if (!modal || !iframe) return;

  title.textContent = innovation.title;
  const blob = new Blob([innovation.html], { type: 'text/html' });
  iframe.src = URL.createObjectURL(blob);
  show(modal);
}

// ─── UI State helpers ─────────────────────────────────────────────────────────
function setStatus(state) {
  const badge = $('#status-badge');
  if (!badge) return;
  const states = {
    ready: ['ready', '● Ready'],
    listening: ['listening', '● Listening…'],
    processing: ['processing', '⟳ Processing…'],
  };
  const [cls, text] = states[state] || states.ready;
  badge.className = `status-badge ${cls}`;
  badge.innerHTML = `<span class="dot"></span> ${text}`;
}

function showPanel(name) {
  $$('.data-section').forEach((s) => hide(s));
  const panel = $(`#${name}-section`);
  if (panel) show(panel);
  panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showWaveform(active) {
  const wf = $('#waveform');
  if (active) wf?.classList.add('active');
  else wf?.classList.remove('active');
}

function showError(msg) {
  renderResponseCard('I encountered an error.', `**Error:** ${msg}`);
  toast(msg, 'error');
}

// Simple Markdown → HTML (subset: bold, headers, lists, line breaks)
function markdownToHtml(md) {
  return md
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^#{3}\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^#{2}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{1}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

function escHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ─── GitHub Save ──────────────────────────────────────────────────────────────
async function maybeGitHubSave() {
  if (!settings.hasGitHubConfig()) return;
  try {
    await gallery.saveToGitHub(
      settings.get('githubToken'),
      settings.get('githubRepo')
    );
    toast('Synced to GitHub', 'success');
  } catch (err) {
    toast(`GitHub sync failed: ${err.message}`, 'error');
  }
}

// ─── Settings Modal ───────────────────────────────────────────────────────────
function openSettings() {
  const modal = $('#settings-modal');
  // Populate fields
  $('#input-gemini-key').value = settings.get('geminiApiKey') || '';
  $('#input-av-key').value = settings.get('alphaVantageKey') || '';
  $('#input-github-token').value = settings.get('githubToken') || '';
  $('#input-github-repo').value = settings.get('githubRepo') || '';
  $('#input-speech').checked = settings.get('speechSynthesisEnabled') ?? true;
  show(modal);
}

function saveSettings() {
  settings.update({
    geminiApiKey: $('#input-gemini-key').value.trim(),
    alphaVantageKey: $('#input-av-key').value.trim(),
    githubToken: $('#input-github-token').value.trim(),
    githubRepo: $('#input-github-repo').value.trim(),
    speechSynthesisEnabled: $('#input-speech').checked,
  });
  gemini.setApiKey(settings.get('geminiApiKey'));
  hide($('#settings-modal'));
  toast('Settings saved', 'success');
}

// ─── Voice setup ──────────────────────────────────────────────────────────────
const voice = new VoiceManager({
  onStart() {
    setStatus('listening');
    showWaveform(true);
    $('#mic-btn')?.classList.add('active');
    const box = $('#transcript-box');
    if (box) { box.textContent = 'Listening…'; box.classList.remove('has-text'); }
    hide($('#response-card'));
    $$('.data-section').forEach((s) => hide(s));
  },
  onEnd() {
    setStatus('ready');
    showWaveform(false);
    $('#mic-btn')?.classList.remove('active');
  },
  onInterim(text) {
    const box = $('#transcript-box');
    if (box) {
      box.innerHTML = `<span class="interim-text">${escHtml(text)}</span>`;
      box.classList.add('has-text');
    }
  },
  onFinal(text) {
    const box = $('#transcript-box');
    if (box) {
      box.textContent = text;
      box.classList.add('has-text');
    }
    handleIntent(text);
  },
  onError(msg) {
    setStatus('ready');
    showWaveform(false);
    $('#mic-btn')?.classList.remove('active');
    toast(msg, 'error');
  },
});

// ─── DOM event wiring ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Initial render
  renderGallery();
  setStatus('ready');

  // Mic button
  $('#mic-btn')?.addEventListener('click', () => {
    if (!settings.hasGeminiKey()) {
      toast('Please add your Gemini API key in Settings (⚙️) first.', 'error');
      openSettings();
      return;
    }
    voice.toggle();
  });

  // Settings
  $('#settings-btn')?.addEventListener('click', openSettings);
  $('#settings-save')?.addEventListener('click', saveSettings);
  $('#settings-close')?.addEventListener('click', () => hide($('#settings-modal')));

  // Viewer close
  $('#viewer-close')?.addEventListener('click', () => {
    hide($('#viewer-modal'));
    const iframe = $('#viewer-iframe');
    if (iframe) { URL.revokeObjectURL(iframe.src); iframe.src = ''; }
  });

  // Close modals on overlay click
  $$('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        hide(overlay);
        const iframe = overlay.querySelector('iframe');
        if (iframe) { URL.revokeObjectURL(iframe.src); iframe.src = ''; }
      }
    });
  });

  // Suggestion chips
  $$('.suggestion-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const cmd = chip.dataset.cmd;
      if (!cmd) return;
      if (!settings.hasGeminiKey()) {
        toast('Add your Gemini API key in Settings first.', 'error');
        openSettings();
        return;
      }
      const box = $('#transcript-box');
      if (box) { box.textContent = cmd; box.classList.add('has-text'); }
      handleIntent(cmd);
    });
  });

  // Keyboard shortcut: Space bar to toggle mic (when not in an input)
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
      e.preventDefault();
      $('#mic-btn')?.click();
    }
  });
});

// ─── Public API (for gallery card buttons & inline scripts) ──────────────────
window.jtlw = {
  openViewerById(id) {
    const item = gallery.getById(id);
    if (item) openViewer(item);
  },
  deleteInnovation(id) {
    gallery.remove(id);
    renderGallery();
    toast('Innovation deleted', 'info');
  },
  clearGallery() {
    gallery.clear();
    renderGallery();
    toast('Gallery cleared', 'info');
  },
};
