# 🌊 JTLW Agent

> **Voice-activated AI agent** powered by **Google Gemini 1.5 Flash** — stock picks, San Diego sailing conditions via NOAA, and interactive 3D innovations.

[![Deploy to GitHub Pages](https://github.com/Codesurfing10/JTLW/actions/workflows/deploy.yml/badge.svg)](https://github.com/Codesurfing10/JTLW/actions/workflows/deploy.yml)

**Live site:** `https://codesurfing10.github.io/JTLW/`

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎤 **Voice Recognition** | Web Speech API — speak your command, JTLW responds |
| 🔊 **Speech Synthesis** | JTLW speaks responses back to you |
| 📈 **Top 5 Stock Picks** | Gemini AI analysis + optional live data via Alpha Vantage |
| 🌊 **San Diego Conditions** | Real-time weather, tides & sailing score from NOAA (no key needed) |
| 🎨 **Interactive 3D** | Ask JTLW to build anything — generates Three.js scenes in seconds |
| 🔬 **Innovations Gallery** | Every result saved to a browsable gallery with one-click 3D viewer |
| ☁️ **GitHub Sync** | Optionally commit your gallery to this repo via GitHub API |

---

## 🚀 Quick Start

### 1. Enable GitHub Pages

In your repo: **Settings → Pages → Source → GitHub Actions**

The included workflow (`.github/workflows/deploy.yml`) will automatically deploy on every push to `main`.

### 2. Open the Live Site

```
https://codesurfing10.github.io/JTLW/
```

### 3. Configure API Keys (in-browser)

Click **⚙️ Settings** on the site and enter:

| Key | Required | Where to get it |
|---|---|---|
| **Gemini API Key** | ✅ Yes | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — free |
| **Alpha Vantage Key** | Optional | [alphavantage.co](https://www.alphavantage.co/support/#api-key) — free (25 req/day) |
| **GitHub Token** | Optional | [github.com/settings/tokens](https://github.com/settings/tokens) — needs `contents: write` |
| **GitHub Repo** | Optional | `Codesurfing10/JTLW` (enables gallery cloud sync) |

> **Security note:** All API keys are stored only in your browser's `localStorage` — they are never sent anywhere except directly to the respective API from your own browser.

---

## 💬 Example Commands

Speak (or click a suggestion chip):

```
"JTLW, give me the top 5 stock picks from today's scanner"
"JTLW, what are the sailing conditions in San Diego right now?"
"JTLW, what are the weather and tide conditions?"
"JTLW, build me an F1 race car with interactive 3D components"
"JTLW, create an interactive 3D solar system model"
"JTLW, build me a rotating 3D Earth with atmosphere"
```

---

## 🗂️ Repository Structure

```
JTLW/
├── index.html                ← Single-page app (GitHub Pages root)
├── assets/
│   ├── css/style.css         ← Dark ocean theme, responsive
│   └── js/
│       ├── agent.js          ← Main orchestrator (entry point)
│       ├── config.js         ← API endpoints & constants
│       ├── settings.js       ← localStorage settings manager
│       ├── gemini.js         ← Gemini 1.5 Flash REST wrapper
│       ├── voice.js          ← Web Speech API (recognition + synthesis)
│       ├── noaa.js           ← NOAA tides + weather + sailing score
│       ├── stocks.js         ← Alpha Vantage + Gemini stock picks
│       └── gallery.js        ← Innovations gallery (localStorage + GitHub API)
├── innovations/
│   └── index.json            ← Gallery index (auto-updated)
├── .github/
│   └── workflows/
│       └── deploy.yml        ← GitHub Actions → GitHub Pages
└── README.md
```

---

## 🛠️ Architecture

```
[Voice Input / Chip Click]
         ↓
  [Web Speech API]
         ↓
  [Gemini 1.5 Flash]  ← System prompt defines JTLW persona & JSON schema
         ↓
   [Intent Router]
    ↙    ↓    ↘
[Stocks] [NOAA] [Creative 3D]
    ↘    ↓    ↙
  [Innovations Gallery]
  (localStorage + optional GitHub commit)
         ↓
  [GitHub Pages site]
```

**Intent types:**
- `stocks` → fetches watchlist quotes (Alpha Vantage) + Gemini picks top 5
- `weather_sailing` → NOAA weather + tides + sailing score for San Diego
- `creative` → Gemini generates complete Three.js HTML, saved + viewable in-browser
- `general` → conversational Gemini response

---

## 🌊 NOAA Data

Weather and tides are fetched live from **NOAA's public APIs** — no API key required:

- **Tides**: Station `9410170` (La Jolla / San Diego)
- **Weather**: `api.weather.gov` — San Diego coordinates (32.7157, -117.1611)
- **Sailing Score**: 0–100 composite of wind speed (Beaufort), precipitation, and tidal state

---

## 🏎️ 3D Innovation Example

Say: *"JTLW, build me an F1 race car with interactive 3D components"*

Gemini generates a complete, self-contained HTML document using **Three.js r128** with:
- Detailed 3D geometry (body, wheels, spoiler, cockpit)
- Orbit controls (drag to rotate, scroll to zoom)
- Ambient + directional lighting with shadow casting
- Smooth animation loop

The result is saved to the Innovations Gallery and viewable any time by clicking **🎮 View 3D**.

---

## 📄 License

MIT — build and share freely.