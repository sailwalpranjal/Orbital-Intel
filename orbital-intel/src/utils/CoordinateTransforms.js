export class CoordinateTransforms {
  // ECI to ECEF transformation
  static eciToECEF(eciCoords, gmst) {
    const cosGMST = Math.cos(gmst);
    const sinGMST = Math.sin(gmst);
    
    return {
      x: eciCoords.x * cosGMST + eciCoords.y * sinGMST,
      y: -eciCoords.x * sinGMST + eciCoords.y * cosGMST,
      z: eciCoords.z
    };
  }

  // ECEF to geodetic (lat/lon/alt)
  static ecefToGeodetic(ecefCoords) {
    const { x, y, z } = ecefCoords;
    const a = 6378.137; // WGS84 semi-major axis
    const e2 = 0.00669437999014; // WGS84 eccentricity squared
    
    const p = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(z * a, p * 6356.7523);
    
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    
    const lat = Math.atan2(
      z + e2 * 6356.7523 * sinTheta * sinTheta * sinTheta,
      p - e2 * a * cosTheta * cosTheta * cosTheta
    );
    
    const lon = Math.atan2(y, x);
    const N = a / Math.sqrt(1 - e2 * Math.sin(lat) * Math.sin(lat));
    const alt = p / Math.cos(lat) - N;
    
    return {
      latitude: lat * 180 / Math.PI,
      longitude: lon * 180 / Math.PI,
      altitude: alt
    };
  }

  // Topocentric coordinates (Az/El/Range)
  static ecefToTopocentric(satECEF, obsECEF, obsLat, obsLon) {
    const dx = satECEF.x - obsECEF.x;
    const dy = satECEF.y - obsECEF.y;
    const dz = satECEF.z - obsECEF.z;
    
    const sinLat = Math.sin(obsLat);
    const cosLat = Math.cos(obsLat);
    const sinLon = Math.sin(obsLon);
    const cosLon = Math.cos(obsLon);
    
    const south = -dx * sinLon + dy * cosLon;
    const east = -dx * cosLon * sinLat - dy * sinLon * sinLat + dz * cosLat;
    const up = dx * cosLon * cosLat + dy * sinLon * cosLat + dz * sinLat;
    
    const range = Math.sqrt(south * south + east * east + up * up);
    const elevation = Math.asin(up / range);
    const azimuth = Math.atan2(-east, south);
    
    return {
      azimuth: (azimuth * 180 / Math.PI + 360) % 360,
      elevation: elevation * 180 / Math.PI,
      range: range
    };
  }
}