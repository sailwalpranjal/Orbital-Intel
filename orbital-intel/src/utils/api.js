const API_CONFIG = {
  CORS_PROXY: process.env.REACT_APP_CORS_PROXY || 'https://api.allorigins.win/raw?url=',
  CELESTRAK_BASE: 'https://celestrak.org/NORAD/elements/gp.php',
  CACHE_DURATION: 3600000, // 1 hour
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

export class SatelliteAPI {
  static cache = new Map();

  static async fetchWithRetry(url, attempts = API_CONFIG.RETRY_ATTEMPTS) {
    for (let i = 0; i < attempts; i++) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
      } catch (error) {
        console.warn(`Attempt ${i + 1} failed:`, error);
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY * (i + 1)));
        } else {
          throw error;
        }
      }
    }
  }

  static async fetchTLEData(group = 'active') {
    const cacheKey = `tle_${group}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < API_CONFIG.CACHE_DURATION) {
      console.log('Using cached data for', group);
      return cached.data;
    }

    try {
      const url = `${API_CONFIG.CORS_PROXY}${encodeURIComponent(
        `${API_CONFIG.CELESTRAK_BASE}?GROUP=${group}&FORMAT=tle`
      )}`;
      
      const response = await this.fetchWithRetry(url);
      const text = await response.text();
      
      // Validate response
      if (!text || text.length < 100) {
        throw new Error('Invalid TLE data received');
      }
      
      this.cache.set(cacheKey, {
        data: text,
        timestamp: Date.now()
      });
      
      return text;
    } catch (error) {
      console.error('Failed to fetch TLE data:', error);
      
      // Return cached data if available, even if expired
      if (cached) {
        console.log('Using expired cache due to fetch failure');
        return cached.data;
      }
      
      // Return sample data as fallback
      return this.getSampleTLEData();
    }
  }

  static getSampleTLEData() {
    return `ISS (ZARYA)
1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9005
2 25544  51.6400 208.5200 0003456  88.2543 271.9095 15.49561572443122
STARLINK-1007
1 44713U 19074A   24001.50000000  .00000538  00000-0  54231-4 0  9992
2 44713  53.0533 295.5983 0001336  88.7036 271.4117 15.06391477265779
COSMOS 2251 DEB
1 34454U 93036SX  24001.50000000  .00000319  00000-0  11867-3 0  9993
2 34454  74.0355 289.8763 0033633 329.5912  30.3191 14.35844924564423`;
  }
}
