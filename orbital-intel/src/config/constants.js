export const CELESTRAK_GROUPS = {
  'active': 'Active Satellites',
  'stations': 'Space Stations',
  'visual': 'Visual Satellites',
  'geo': 'Geostationary',
  'starlink': 'Starlink',
  'oneweb': 'OneWeb',
  'iridium': 'Iridium',
  'iridium-NEXT': 'Iridium NEXT',
  'ses': 'SES',
  'orbcomm': 'Orbcomm',
  'globalstar': 'Globalstar',
  'amateur': 'Amateur Radio',
  'x-comm': 'Experimental Comm',
  'other-comm': 'Other Comm',
  'gps-ops': 'GPS Operational',
  'glo-ops': 'GLONASS Operational',
  'galileo': 'Galileo',
  'beidou': 'Beidou',
  'sbas': 'SBAS',
  'nnss': 'Navy Navigation',
  'musson': 'Russian LEO Nav',
  'science': 'Science',
  'geodetic': 'Geodetic',
  'engineering': 'Engineering',
  'education': 'Education',
  'military': 'Miscellaneous Military',
  'radar': 'Radar Calibration',
  'cubesat': 'CubeSats',
  'other': 'Other',
  '1982-092': 'COSMOS 1408 Debris',
  '1999-025': 'FENGYUN 1C Debris',
  '2009-005': 'IRIDIUM 33 Debris',
  '2009-005': 'COSMOS 2251 Debris'
};

export const GROUND_STATIONS = [
  { name: 'Cape Canaveral', lat: 28.3922, lon: -80.6077, alt: 0.003 },
  { name: 'Baikonur', lat: 45.9650, lon: 63.3050, alt: 0.090 },
  { name: 'Vandenberg', lat: 34.7420, lon: -120.5724, alt: 0.112 },
  { name: 'Kourou', lat: 5.2320, lon: -52.7736, alt: 0.014 },
  { name: 'Tanegashima', lat: 30.3991, lon: 130.9705, alt: 0.017 },
  { name: 'Sriharikota', lat: 13.7199, lon: 80.2304, alt: 0.010 },
  { name: 'Jiuquan', lat: 40.9675, lon: 100.2784, alt: 1.000 },
  { name: 'Xichang', lat: 28.2463, lon: 102.0267, alt: 1.798 },
  { name: 'Plesetsk', lat: 62.9257, lon: 40.5776, alt: 0.140 },
  { name: 'Wallops', lat: 37.8401, lon: -75.4664, alt: 0.003 }
];

export const VISUALIZATION_THEMES = {
  realistic: {
    earth: { color: 0x2233ff, emissive: 0x112244 },
    atmosphere: { color: 0x4488ff, opacity: 0.1 },
    space: { color: 0x000814 },
    orbits: { opacity: 0.3 },
    satellites: { metalness: 0.8, roughness: 0.2 }
  },
  schematic: {
    earth: { color: 0x0066cc, emissive: 0x003366 },
    atmosphere: { color: 0x0099ff, opacity: 0.05 },
    space: { color: 0x000000 },
    orbits: { opacity: 0.8 },
    satellites: { metalness: 0.3, roughness: 0.7 }
  },
  heatmap: {
    earth: { color: 0x333333, emissive: 0x111111 },
    atmosphere: { color: 0xff0000, opacity: 0.02 },
    space: { color: 0x000000 },
    orbits: { opacity: 0.1 },
    satellites: { metalness: 0.0, roughness: 1.0 }
  }
};
