export class SatelliteHelpers {
  // Format TLE for display
  static formatTLE(tle) {
    return {
      line0: tle.name.padEnd(24),
      line1: tle.line1,
      line2: tle.line2
    };
  }

  // Calculate satellite visibility
  static calculateVisibility(satPosition, sunPosition, observerPosition) {
    // Check if satellite is illuminated
    const satToSun = {
      x: sunPosition.x - satPosition.x,
      y: sunPosition.y - satPosition.y,
      z: sunPosition.z - satPosition.z
    };
    
    // Check if observer can see satellite
    const observerToSat = {
      x: satPosition.x - observerPosition.x,
      y: satPosition.y - observerPosition.y,
      z: satPosition.z - observerPosition.z
    };
    
    // Angle calculations
    const sunAngle = Math.acos(
      (satPosition.x * satToSun.x + satPosition.y * satToSun.y + satPosition.z * satToSun.z) /
      (Math.sqrt(satPosition.x ** 2 + satPosition.y ** 2 + satPosition.z ** 2) *
       Math.sqrt(satToSun.x ** 2 + satToSun.y ** 2 + satToSun.z ** 2))
    );
    
    return {
      isIlluminated: sunAngle < Math.PI / 2,
      magnitude: this.calculateMagnitude(satPosition, sunPosition, observerPosition)
    };
  }

  // Calculate apparent magnitude
  static calculateMagnitude(satPosition, sunPosition, observerPosition) {
    const distance = Math.sqrt(
      (satPosition.x - observerPosition.x) ** 2 +
      (satPosition.y - observerPosition.y) ** 2 +
      (satPosition.z - observerPosition.z) ** 2
    );
    
    // Simplified magnitude calculation
    return -2.5 * Math.log10(1 / (distance * distance)) + 5;
  }

  // Convert ECI to geographic coordinates
  static eciToGeographic(position, gmst) {
    const { x, y, z } = position;
    const r = Math.sqrt(x * x + y * y + z * z);
    
    // Latitude
    const lat = Math.asin(z / r);
    
    // Longitude
    let lon = Math.atan2(y, x) - gmst;
    while (lon < -Math.PI) lon += 2 * Math.PI;
    while (lon > Math.PI) lon -= 2 * Math.PI;
    
    return {
      latitude: lat * 180 / Math.PI,
      longitude: lon * 180 / Math.PI,
      altitude: r - 6378.137 // Earth radius in km
    };
  }

  // Calculate GMST (Greenwich Mean Sidereal Time)
  static calculateGMST(date) {
    const jd = this.dateToJulian(date);
    const T = (jd - 2451545.0) / 36525.0;
    
    let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) +
               T * T * (0.000387933 - T / 38710000.0);
    
    return (gmst % 360) * Math.PI / 180;
  }

  // Convert date to Julian date
  static dateToJulian(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  // Format large numbers with units
  static formatNumber(num, decimals = 2) {
    if (num > 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
    if (num > 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
    if (num > 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  }

  // Calculate orbital lifetime estimate
  static estimateOrbitalLifetime(altitude, ballisticCoefficient) {
    if (altitude > 600) return Infinity;
    
    // Simplified lifetime model
    const density = Math.exp(-altitude / 100) * 1e-12;
    const decayRate = density * ballisticCoefficient;
    
    return altitude / (decayRate * 365.25);
  }

  // Group satellites by orbital regime
  static groupByOrbitalRegime(satellites) {
    const groups = {
      LEO: [],
      MEO: [],
      GEO: [],
      HEO: [],
      OTHER: []
    };
    
    satellites.forEach(sat => {
      const a = Math.pow(398600.4418 / (sat.satrec.no * sat.satrec.no), 1/3);
      const altitude = a - 6378.137;
      const eccentricity = sat.satrec.ecco;
      
      if (altitude < 2000) {
        groups.LEO.push(sat);
      } else if (altitude > 35000 && altitude < 36000 && eccentricity < 0.01) {
        groups.GEO.push(sat);
      } else if (altitude > 2000 && altitude < 35000) {
        groups.MEO.push(sat);
      } else if (eccentricity > 0.25) {
        groups.HEO.push(sat);
      } else {
        groups.OTHER.push(sat);
      }
    });
    
    return groups;
  }
}
