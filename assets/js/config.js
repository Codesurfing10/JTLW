// JTLW Agent — Configuration
export const CONFIG = {
  // Gemini 1.5 Flash (Gemma Light)
  GEMINI_MODEL: 'gemini-1.5-flash-latest',
  GEMINI_API_BASE: 'https://generativelanguage.googleapis.com/v1beta',

  // NOAA — San Diego / La Jolla Station 9410170
  NOAA_STATION: '9410170',
  NOAA_TIDES_BASE: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
  NOAA_WEATHER_POINT: 'https://api.weather.gov/points/32.7157,-117.1611',

  // Alpha Vantage (stock data)
  ALPHA_VANTAGE_BASE: 'https://www.alphavantage.co/query',

  // Default watchlist used when no scanner data is available
  DEFAULT_WATCHLIST: ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL', 'AMD', 'PLTR', 'SMCI'],

  // localStorage keys
  STORAGE_INNOVATIONS: 'jtlw_innovations',
  STORAGE_SETTINGS: 'jtlw_settings',

  // Three.js CDN (global namespace build)
  THREEJS_CDN: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
};
