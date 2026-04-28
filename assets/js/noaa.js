// JTLW Agent — NOAA Weather, Tides & Sailing Conditions (San Diego)
import { CONFIG } from './config.js';

// Beaufort scale: wind speed (m/s) → sailing label + score modifier
const BEAUFORT = [
  { max: 1.5, label: 'Calm', score: 0 },
  { max: 3.3, label: 'Light Air', score: +10 },
  { max: 5.4, label: 'Light Breeze', score: +20 },
  { max: 7.9, label: 'Gentle Breeze', score: +25 },
  { max: 10.7, label: 'Moderate Breeze', score: +20 },
  { max: 13.8, label: 'Fresh Breeze', score: +10 },
  { max: 17.1, label: 'Strong Breeze', score: -10 },
  { max: 20.7, label: 'Near Gale', score: -30 },
  { max: Infinity, label: 'Gale+', score: -60 },
];

function beaufort(windMps) {
  return BEAUFORT.find((b) => windMps < b.max) || BEAUFORT[BEAUFORT.length - 1];
}

function mphToMps(mph) {
  return mph * 0.44704;
}

function knotsToMps(knots) {
  return knots * 0.514444;
}

/**
 * Fetch NOAA weather forecast for San Diego.
 * Returns a simplified object with current conditions.
 */
export async function fetchWeather() {
  // Step 1: get forecast office URL
  const pointRes = await fetch(CONFIG.NOAA_WEATHER_POINT, {
    headers: { 'User-Agent': 'JTLW-Agent/1.0 (github.com/Codesurfing10/JTLW)' },
  });
  if (!pointRes.ok) throw new Error(`NOAA points API error: ${pointRes.status}`);
  const pointData = await pointRes.json();

  const forecastHourlyUrl = pointData.properties?.forecastHourly;
  if (!forecastHourlyUrl) throw new Error('NOAA did not return forecastHourly URL.');

  // Step 2: get hourly forecast
  const forecastRes = await fetch(forecastHourlyUrl, {
    headers: { 'User-Agent': 'JTLW-Agent/1.0 (github.com/Codesurfing10/JTLW)' },
  });
  if (!forecastRes.ok) throw new Error(`NOAA forecast API error: ${forecastRes.status}`);
  const forecastData = await forecastRes.json();

  const periods = forecastData.properties?.periods;
  if (!periods?.length) throw new Error('No forecast periods in NOAA response.');

  const now = periods[0];
  const windSpeedStr = now.windSpeed || '0 mph';
  const windSpeedMph = parseFloat(windSpeedStr.match(/[\d.]+/)?.[0] || 0);
  const windSpeedMps = mphToMps(windSpeedMph);

  return {
    temperature: now.temperature,
    temperatureUnit: now.temperatureUnit,
    windSpeed: windSpeedMph,
    windSpeedMps,
    windDirection: now.windDirection,
    description: now.shortForecast,
    icon: mapWeatherIcon(now.shortForecast),
    humidity: now.relativeHumidity?.value ?? null,
    isDaytime: now.isDaytime,
    periods: periods.slice(0, 12), // next 12 hours
  };
}

/**
 * Fetch current tide height and next high/low tide for San Diego.
 */
export async function fetchTides() {
  const now = new Date();
  const dateStr = formatNoaaDate(now);
  const endDate = formatNoaaDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  // Current water level (6-min interval, last 2 hours)
  const levelsUrl =
    `${CONFIG.NOAA_TIDES_BASE}?begin_date=${formatNoaaDate(new Date(now.getTime() - 2 * 60 * 60 * 1000))}` +
    `&end_date=${dateStr}&station=${CONFIG.NOAA_STATION}` +
    `&product=water_level&datum=MLLW&time_zone=lst_ldt&units=english&format=json`;

  // Predicted hi/lo tides for next 24 hours
  const hiloUrl =
    `${CONFIG.NOAA_TIDES_BASE}?begin_date=${dateStr}&end_date=${endDate}` +
    `&station=${CONFIG.NOAA_STATION}&product=predictions&datum=MLLW` +
    `&time_zone=lst_ldt&interval=hilo&units=english&format=json`;

  const [levelsRes, hiloRes] = await Promise.all([
    fetch(levelsUrl),
    fetch(hiloUrl),
  ]);

  let currentLevel = null;
  if (levelsRes.ok) {
    const ld = await levelsRes.json();
    const readings = ld.data;
    if (readings?.length) {
      const last = readings[readings.length - 1];
      currentLevel = parseFloat(last.v);
    }
  }

  let tides = [];
  if (hiloRes.ok) {
    const hd = await hiloRes.json();
    tides = (hd.predictions || []).slice(0, 4).map((t) => ({
      time: t.t,
      height: parseFloat(t.v),
      type: t.type === 'H' ? 'High' : 'Low',
    }));
  }

  // Determine tide state (rising / falling)
  let tideState = 'Unknown';
  if (tides.length >= 1) {
    const next = tides[0];
    tideState = next.type === 'High' ? 'Rising' : 'Falling';
  }

  return { currentLevel, tides, tideState };
}

/**
 * Compute a 0–100 sailing score from weather + tide data.
 * Returns { score, label, details }
 */
export function computeSailingScore(weather, tideData) {
  let score = 70; // base score

  // Wind contribution
  const bf = beaufort(weather.windSpeedMps ?? 0);
  score += bf.score;

  // Visibility / precipitation penalty
  const desc = (weather.description || '').toLowerCase();
  if (/thunder|storm|tornado/.test(desc)) score -= 40;
  else if (/rain|shower|drizzle/.test(desc)) score -= 15;
  else if (/fog|mist/.test(desc)) score -= 10;
  else if (/clear|sunny|fair/.test(desc)) score += 10;

  // Tide state bonus (rising tide is generally better for sailing in harbour)
  if (tideData.tideState === 'Rising') score += 5;

  score = Math.max(0, Math.min(100, score));

  let label, cssClass;
  if (score >= 80) { label = 'Excellent'; cssClass = 'excellent'; }
  else if (score >= 60) { label = 'Good'; cssClass = 'good'; }
  else if (score >= 40) { label = 'Fair'; cssClass = 'fair'; }
  else { label = 'Poor'; cssClass = 'poor'; }

  return {
    score,
    label,
    cssClass,
    windLabel: bf.label,
    summary: buildSailingSummary(score, label, weather, tideData, bf),
  };
}

function buildSailingSummary(score, label, w, t, bf) {
  const dir = w.windDirection || 'variable';
  const spd = w.windSpeed?.toFixed(0) || '?';
  const desc = w.description || 'conditions unknown';
  const tide = t.tideState || 'unknown';
  const next = t.tides?.[0];
  const nextStr = next
    ? `Next ${next.type} tide at ${next.time} (${next.height.toFixed(1)} ft)`
    : 'Tide data unavailable';

  return (
    `${label} sailing conditions. ${desc} with ${bf.label.toLowerCase()} winds from ` +
    `${dir} at ${spd} mph. Tide is ${tide.toLowerCase()}. ${nextStr}.`
  );
}

// ---------- helpers ----------

function formatNoaaDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function mapWeatherIcon(desc = '') {
  const d = desc.toLowerCase();
  if (/thunder/.test(d)) return '⛈️';
  if (/snow/.test(d)) return '❄️';
  if (/rain|shower|drizzle/.test(d)) return '🌧️';
  if (/fog|mist/.test(d)) return '🌫️';
  if (/cloud/.test(d)) return '⛅';
  if (/clear|sunny/.test(d)) return '☀️';
  if (/wind/.test(d)) return '💨';
  return '🌤️';
}
