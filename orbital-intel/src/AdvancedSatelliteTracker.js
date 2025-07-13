
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { 
  AlertCircle, Activity, Download, Settings, HelpCircle, Play, Pause, 
  RotateCcw, Zap, Globe, Clock, ChevronRight, X, Search, 
  Database, RefreshCw, TrendingUp, MapPin, Satellite, Info,
  Sun, Moon, Star, Layers, Eye, EyeOff, Filter, Calendar,
  Radio, Orbit, Navigation2, Timer, Gauge, Shield, AlertTriangle,
  Smartphone, Monitor, Move3d
} from 'lucide-react';

// Constants
const Constants = {
  MU_EARTH: 398600.4418,
  R_EARTH: 6378.137,
  R_SUN: 696000,
  R_MOON: 1737.4,
  AU: 149597870.7,
  J2: 1.08262668e-3,
  OMEGA_EARTH: 7.2921159e-5,
  EARTH_TILT: 23.439281 * Math.PI / 180
};

// Satellite categories with distinct colors
const SATELLITE_CATEGORIES = {
  station: { color: 0x00ff00, size: 100, label: 'Space Station', icon: '🛸' },
  starlink: { color: 0x00aaff, size: 30, label: 'Starlink', icon: '📡' },
  oneweb: { color: 0xff6600, size: 30, label: 'OneWeb', icon: '📡' },
  gps: { color: 0xffff00, size: 50, label: 'GPS', icon: '🛰️' },
  glonass: { color: 0xff0000, size: 50, label: 'GLONASS', icon: '🛰️' },
  galileo: { color: 0x0066ff, size: 50, label: 'Galileo', icon: '🛰️' },
  beidou: { color: 0xff00ff, size: 50, label: 'Beidou', icon: '🛰️' },
  geo: { color: 0xffffff, size: 60, label: 'Geostationary', icon: '📡' },
  science: { color: 0x00ffff, size: 70, label: 'Science', icon: '🔬' },
  debris: { color: 0x666666, size: 20, label: 'Debris', icon: '💥' },
  other: { color: 0xaaaaaa, size: 40, label: 'Other', icon: '🛰️' }
};

// Constellation data
const CONSTELLATIONS = [
  { name: "Orion", stars: [[88.793, 7.407], [87.291, -1.201], [81.283, -8.202], [83.858, -5.910], [85.190, -2.397], [88.793, 7.407], [87.291, -1.201], [78.634, -0.299]] },
  { name: "Ursa Major", stars: [[165.932, 61.751], [165.460, 56.382], [178.458, 53.695], [183.857, 57.033], [193.507, 55.960], [200.981, 54.926], [206.885, 49.313]] },
  { name: "Cassiopeia", stars: [[2.294, 59.150], [10.127, 56.537], [14.177, 60.717], [21.454, 60.235], [40.916, 56.874]] },
  { name: "Leo", stars: [[152.093, 11.967], [146.463, 14.572], [147.741, 19.842], [154.993, 15.429], [169.840, 15.797], [177.265, 14.572]] }
];

// Enhanced Orbital Mechanics
class OrbitalMechanics {
  static parseTLE(line1, line2) {
    try {
      const epochYear = parseInt(line1.substring(18, 20));
      const epochDay = parseFloat(line1.substring(20, 32));
      const year = epochYear < 57 ? 2000 + epochYear : 1900 + epochYear;
      
      const epoch = new Date(year, 0, 1);
      epoch.setDate(epoch.getDate() + epochDay - 1);

      return {
        satnum: parseInt(line1.substring(2, 7)),
        classification: line1[7],
        intldesg: line1.substring(9, 17).trim(),
        inclination: parseFloat(line2.substring(8, 16)) * Math.PI / 180,
        raan: parseFloat(line2.substring(17, 25)) * Math.PI / 180,
        eccentricity: parseFloat('0.' + line2.substring(26, 33)),
        argPerigee: parseFloat(line2.substring(34, 42)) * Math.PI / 180,
        meanAnomaly: parseFloat(line2.substring(43, 51)) * Math.PI / 180,
        meanMotion: parseFloat(line2.substring(52, 63)) * 2 * Math.PI / 86400,
        revnum: parseInt(line2.substring(63, 68)),
        epoch: epoch,
        bstar: parseFloat(line1.substring(53, 59) + 'e' + line1.substring(59, 61))
      };
    } catch (error) {
      console.error('TLE Parse Error:', error);
      return null;
    }
  }

  static orbitalToCartesian(elements, time) {
    if (!elements) return { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    
    try {
      const dt = (time - elements.epoch) / 1000;
      const M = (elements.meanAnomaly + elements.meanMotion * dt) % (2 * Math.PI);
      const E = this.solveKepler(M, elements.eccentricity);
      
      const a = Math.pow(Constants.MU_EARTH / (elements.meanMotion * elements.meanMotion), 1/3);
      const r = a * (1 - elements.eccentricity * Math.cos(E));
      
      const nu = 2 * Math.atan2(
        Math.sqrt(1 + elements.eccentricity) * Math.sin(E / 2),
        Math.sqrt(1 - elements.eccentricity) * Math.cos(E / 2)
      );
      
      // J2 perturbation
      const J2_factor = -1.5 * Constants.J2 * Math.pow(Constants.R_EARTH / a, 2);
      const nodeDot = J2_factor * elements.meanMotion * Math.cos(elements.inclination) / Math.pow(1 - elements.eccentricity * elements.eccentricity, 2);
      const argpDot = J2_factor * elements.meanMotion * (2 - 2.5 * Math.sin(elements.inclination) * Math.sin(elements.inclination)) / Math.pow(1 - elements.eccentricity * elements.eccentricity, 2);
      
      const raan = elements.raan + nodeDot * dt;
      const argPerigee = elements.argPerigee + argpDot * dt;
      
      const x_orb = r * Math.cos(nu);
      const y_orb = r * Math.sin(nu);
      
      const cos_i = Math.cos(elements.inclination);
      const sin_i = Math.sin(elements.inclination);
      const cos_o = Math.cos(raan);
      const sin_o = Math.sin(raan);
      const cos_w = Math.cos(argPerigee);
      const sin_w = Math.sin(argPerigee);
      
      const x = (cos_o * cos_w - sin_o * sin_w * cos_i) * x_orb +
                (-cos_o * sin_w - sin_o * cos_w * cos_i) * y_orb;
      const y = (sin_o * cos_w + cos_o * sin_w * cos_i) * x_orb +
                (-sin_o * sin_w + cos_o * cos_w * cos_i) * y_orb;
      const z = (sin_w * sin_i) * x_orb + (cos_w * sin_i) * y_orb;
      
      // Velocity
      const n = elements.meanMotion;
      const vx_orb = -n * a * Math.sin(E) / (1 - elements.eccentricity * Math.cos(E));
      const vy_orb = n * a * Math.sqrt(1 - elements.eccentricity * elements.eccentricity) * Math.cos(E) / (1 - elements.eccentricity * Math.cos(E));
      
      const vx = (cos_o * cos_w - sin_o * sin_w * cos_i) * vx_orb +
                 (-cos_o * sin_w - sin_o * cos_w * cos_i) * vy_orb;
      const vy = (sin_o * cos_w + cos_o * sin_w * cos_i) * vx_orb +
                 (-sin_o * sin_w + cos_o * cos_w * cos_i) * vy_orb;
      const vz = (sin_w * sin_i) * vx_orb + (cos_w * sin_i) * vy_orb;
      
      return { position: { x, y, z }, velocity: { x: vx, y: vy, z: vz } };
    } catch (error) {
      console.error('Orbital calculation error:', error);
      return { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    }
  }

  static solveKepler(M, e, tolerance = 1e-10) {
    let E = M + e * Math.sin(M);
    let delta = 1;
    let iterations = 0;
    
    while (Math.abs(delta) > tolerance && iterations < 50) {
      delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= delta;
      iterations++;
    }
    
    return E;
  }

  static calculateOrbitalElements(position, velocity) {
    const r = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
    const v = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    
    // Semi-major axis
    const a = 1 / (2 / r - v * v / Constants.MU_EARTH);
    
    // Eccentricity vector
    const e_vec = {
      x: (velocity.y * (position.y * velocity.z - position.z * velocity.y) - velocity.z * (position.x * velocity.y - position.y * velocity.x)) / Constants.MU_EARTH - position.x / r,
      y: (velocity.z * (position.z * velocity.x - position.x * velocity.z) - velocity.x * (position.y * velocity.z - position.z * velocity.y)) / Constants.MU_EARTH - position.y / r,
      z: (velocity.x * (position.x * velocity.y - position.y * velocity.x) - velocity.y * (position.z * velocity.x - position.x * velocity.z)) / Constants.MU_EARTH - position.z / r
    };
    const e = Math.sqrt(e_vec.x ** 2 + e_vec.y ** 2 + e_vec.z ** 2);
    
    // Orbital period
    const period = 2 * Math.PI * Math.sqrt(a * a * a / Constants.MU_EARTH) / 60; // minutes
    
    return { a, e, period, apogee: a * (1 + e) - Constants.R_EARTH, perigee: a * (1 - e) - Constants.R_EARTH };
  }

  static getSunPosition(jd) {
    const T = (jd - 2451545.0) / 36525.0;
    const L = (280.460 + 36000.771 * T) % 360;
    const g = ((357.528 + 35999.050 * T) % 360) * Math.PI / 180;
    const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
    
    return {
      x: Constants.AU * Math.cos(lambda),
      y: Constants.AU * Math.sin(lambda) * Math.cos(Constants.EARTH_TILT),
      z: Constants.AU * Math.sin(lambda) * Math.sin(Constants.EARTH_TILT)
    };
  }

  static getMoonPosition(jd) {
    const T = (jd - 2451545.0) / 36525.0;
    const L = ((218.316 + 481267.881 * T) % 360) * Math.PI / 180;
    const M = ((134.963 + 477198.867 * T) % 360) * Math.PI / 180;
    const F = ((93.272 + 483202.018 * T) % 360) * Math.PI / 180;
    
    const lon = L + 6.289 * Math.PI / 180 * Math.sin(M);
    const lat = 5.128 * Math.PI / 180 * Math.sin(F);
    const dist = 385001 - 20905 * Math.cos(M);
    
    return {
      x: dist * Math.cos(lat) * Math.cos(lon),
      y: dist * Math.cos(lat) * Math.sin(lon),
      z: dist * Math.sin(lat)
    };
  }
}

// Data Manager
class SatelliteDataManager {
  static cache = new Map();
  static lastUpdate = new Map();

  static async fetchRealTimeData(category = 'active') {
    const cacheKey = `tle_${category}`;
    const now = Date.now();
    
    // Check cache (5 minute expiry)
    if (this.cache.has(cacheKey) && now - this.lastUpdate.get(cacheKey) < 300000) {
      return this.cache.get(cacheKey);
    }

    try {
      // Try direct fetch first (may work without CORS in some environments)
      let response;
      try {
        response = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${category}&FORMAT=tle`);
      } catch (e) {
        // If direct fetch fails, return sample data
        return this.getEnhancedSampleData();
      }
      
      if (!response || !response.ok) {
        return this.getEnhancedSampleData();
      }
      
      const text = await response.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      const satellites = [];
      for (let i = 0; i < lines.length && satellites.length < 100; i += 3) {
        if (i + 2 < lines.length) {
          const elements = OrbitalMechanics.parseTLE(lines[i+1], lines[i+2]);
          if (elements) {
            satellites.push({
              id: `${category}_${elements.satnum}`,
              name: lines[i].trim(),
              noradId: elements.satnum,
              elements: elements,
              category: this.categorizeSatellite(lines[i], elements),
              lastUpdated: now
            });
          }
        }
      }
      
      this.cache.set(cacheKey, satellites);
      this.lastUpdate.set(cacheKey, now);
      
      return satellites;
    } catch (error) {
      console.error('Error fetching real-time data:', error);
      return this.getEnhancedSampleData();
    }
  }

  static categorizeSatellite(name, elements) {
    const upperName = name.toUpperCase();
    
    if (upperName.includes('ISS') || upperName.includes('TIANGONG')) return 'station';
    if (upperName.includes('STARLINK')) return 'starlink';
    if (upperName.includes('ONEWEB')) return 'oneweb';
    if (upperName.includes('GPS')) return 'gps';
    if (upperName.includes('GLONASS')) return 'glonass';
    if (upperName.includes('GALILEO')) return 'galileo';
    if (upperName.includes('BEIDOU')) return 'beidou';
    if (upperName.includes('COSMOS') || upperName.includes('DEB')) return 'debris';
    if (upperName.includes('HUBBLE') || upperName.includes('JWST')) return 'science';
    
    const a = Math.pow(Constants.MU_EARTH / (elements.meanMotion * elements.meanMotion), 1/3);
    const altitude = a - Constants.R_EARTH;
    
    if (altitude > 35000 && altitude < 36000 && elements.eccentricity < 0.01) return 'geo';
    
    return 'other';
  }

  static getEnhancedSampleData() {
    const now = Date.now();
    return [
      {
        id: 'sample_25544',
        name: "ISS (ZARYA)",
        noradId: 25544,
        elements: OrbitalMechanics.parseTLE(
          "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9005",
          "2 25544  51.6400 208.5200 0003456  88.2543 271.9095 15.49561572443122"
        ),
        category: 'station',
        lastUpdated: now
      },
      {
        id: 'sample_44713',
        name: "STARLINK-1007",
        noradId: 44713,
        elements: OrbitalMechanics.parseTLE(
          "1 44713U 19074A   24001.50000000  .00000538  00000-0  54231-4 0  9992",
          "2 44713  53.0533 295.5983 0001336  88.7036 271.4117 15.06391477265779"
        ),
        category: 'starlink',
        lastUpdated: now
      },
      {
        id: 'sample_20580',
        name: "HUBBLE SPACE TELESCOPE",
        noradId: 20580,
        elements: OrbitalMechanics.parseTLE(
          "1 20580U 90037B   24001.50000000  .00000946  00000-0  45862-4 0  9993",
          "2 20580  28.4699 288.8102 0002853 118.9862  64.7380 15.09299865828567"
        ),
        category: 'science',
        lastUpdated: now
      },
      {
        id: 'sample_41917',
        name: "GPS IIF-12",
        noradId: 41917,
        elements: OrbitalMechanics.parseTLE(
          "1 41917U 17005A   24001.50000000 -.00000045  00000-0  00000-0 0  9990",
          "2 41917  55.1695 301.2858 0018738 308.9346  50.9456  2.00564926 52677"
        ),
        category: 'gps',
        lastUpdated: now
      },
      {
        id: 'sample_40294',
        name: "GALILEO-7",
        noradId: 40294,
        elements: OrbitalMechanics.parseTLE(
          "1 40294U 14081A   24001.50000000 -.00000089  00000-0  00000-0 0  9991",
          "2 40294  55.6907 158.2334 0001701 314.5974  45.4685  1.70475396 55432"
        ),
        category: 'galileo',
        lastUpdated: now
      }
    ];
  }
}

// Main Enhanced Component
const AdvancedSatelliteTracker = () => {
  // Refs
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const frameRef = useRef(null);
  const satelliteObjectsRef = useRef({});
  const orbitLinesRef = useRef({});
  const labelSpritesRef = useRef({});
  const celestialBodiesRef = useRef({});
  
  // State
  const [satellites, setSatellites] = useState([]);
  const [selectedSatellite, setSelectedSatellite] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeScale, setTimeScale] = useState(1);
  const [simulationTime, setSimulationTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHelp, setShowHelp] = useState({});
  const [trajectoryData, setTrajectoryData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dataSource, setDataSource] = useState('active');
  const [isMobile, setIsMobile] = useState(false);
  const [statistics, setStatistics] = useState({
    total: 0,
    byCategory: {},
    averageAltitude: 0,
    collisionRisks: 0
  });
  
  // Settings
  const [settings, setSettings] = useState({
    showOrbits: true,
    showLabels: true,
    showCelestialBodies: true,
    showGroundTracks: false,
    showDebris: false,
    showConstellations: true,
    showMilkyWay: true,
    realisticMode: true,
    collisionThreshold: 50,
    predictionHours: 24,
    labelDistance: 50000,
    quality: 'high',
    mouseSensitivity: 0.0002, // Reduced sensitivity
    zoomSpeed: 0.1
  });

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize enhanced Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    try {
      // Scene setup
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Camera setup
      const camera = new THREE.PerspectiveCamera(
        45,
        mountRef.current.clientWidth / mountRef.current.clientHeight,
        100,
        2000000
      );
      camera.position.set(25000, 15000, 25000);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({ 
        antialias: settings.quality === 'high',
        alpha: true,
        logarithmicDepthBuffer: true,
        powerPreference: settings.quality === 'high' ? 'high-performance' : 'default'
      });
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = settings.quality !== 'low';
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Create -realistic space environment
      if (settings.realisticMode) {
        // Deep space background
        scene.background = new THREE.Color(0x000005);
        
        // Milky Way galaxy
        if (settings.showMilkyWay) {
          const milkyWayGeometry = new THREE.BufferGeometry();
          const milkyWayMaterial = new THREE.PointsMaterial({
            size: 80,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            map: new THREE.TextureLoader().load('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAWElEQVQoU2NkYGD4z8DAwMgAA0wMDAwMTEiCjAwMDP9BbEYGBoZfDAwMc0BsRgYGhlYGBob/YAWMDAwMn0FskAIWBgaG/yAFIAVgE8AKQCaAFYBMACsAmQAAM3sKgWqSEHUAAAAASUVORK5CYII=')
          });

          const milkyWayVertices = [];
          const milkyWayColors = [];
          const milkyWaySizes = [];

          // Create dense galactic plane
          for (let i = 0; i < 100000; i++) {
            let theta, phi, r;
            
            // 80% in galactic plane for Milky Way effect
            if (Math.random() < 0.8) {
              theta = Math.random() * 2 * Math.PI;
              // Concentrated around galactic plane with some spread
              phi = Math.PI / 2 + (Math.random() - 0.5) * 0.2;
              // Varying distance for depth
              r = 200000 + Math.random() * 800000;
              
              // Add spiral arm structure
              const armOffset = Math.sin(theta * 2) * 0.1;
              phi += armOffset;
            } else {
              // Random distribution for background stars
              theta = Math.random() * 2 * Math.PI;
              phi = Math.acos(2 * Math.random() - 1);
              r = 300000 + Math.random() * 700000;
            }
            
            milkyWayVertices.push(
              r * Math.sin(phi) * Math.cos(theta),
              r * Math.sin(phi) * Math.sin(theta),
              r * Math.cos(phi)
            );
            
            // Realistic star colors
            const starType = Math.random();
            if (starType < 0.1) {
              // Blue giants
              milkyWayColors.push(0.7, 0.8, 1);
              milkyWaySizes.push(Math.random() * 3 + 2);
            } else if (starType < 0.2) {
              // Red giants
              milkyWayColors.push(1, 0.6, 0.4);
              milkyWaySizes.push(Math.random() * 3 + 2);
            } else if (starType < 0.5) {
              // Yellow stars like our Sun
              milkyWayColors.push(1, 0.95, 0.8);
              milkyWaySizes.push(Math.random() * 2 + 1);
            } else {
              // White/blue main sequence
              milkyWayColors.push(0.95, 0.95, 1);
              milkyWaySizes.push(Math.random() * 1.5 + 0.5);
            }
          }

          milkyWayGeometry.setAttribute('position', new THREE.Float32BufferAttribute(milkyWayVertices, 3));
          milkyWayGeometry.setAttribute('color', new THREE.Float32BufferAttribute(milkyWayColors, 3));
          milkyWayGeometry.setAttribute('size', new THREE.Float32BufferAttribute(milkyWaySizes, 1));
          
          const milkyWay = new THREE.Points(milkyWayGeometry, milkyWayMaterial);
          scene.add(milkyWay);
        }

        // Create constellations
        if (settings.showConstellations) {
          CONSTELLATIONS.forEach(constellation => {
            const points = [];
            constellation.stars.forEach(star => {
              const ra = star[0] * Math.PI / 180;
              const dec = star[1] * Math.PI / 180;
              const r = 500000;
              
              points.push(new THREE.Vector3(
                r * Math.cos(dec) * Math.cos(ra),
                r * Math.sin(dec),
                r * Math.cos(dec) * Math.sin(ra)
              ));
            });
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ 
              color: 0x445566, 
              transparent: true, 
              opacity: 0.3 
            });
            const line = new THREE.Line(geometry, material);
            scene.add(line);
          });
        }

        // Add nebula clouds
        for (let i = 0; i < 5; i++) {
          const cloudGeometry = new THREE.SphereGeometry(50000 + Math.random() * 50000, 16, 16);
          const cloudMaterial = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: {
              time: { value: 0 },
              color: { value: new THREE.Color(Math.random() > 0.5 ? 0x4488ff : 0xff4488) }
            },
            vertexShader: `
              varying vec3 vPosition;
              void main() {
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform vec3 color;
              varying vec3 vPosition;
              void main() {
                float intensity = 1.0 - length(vPosition) / 100000.0;
                intensity = pow(intensity, 3.0);
                gl_FragColor = vec4(color, intensity * 0.05);
              }
            `,
            blending: THREE.AdditiveBlending
          });
          const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
          cloud.position.set(
            (Math.random() - 0.5) * 1000000,
            (Math.random() - 0.5) * 500000,
            (Math.random() - 0.5) * 1000000
          );
          scene.add(cloud);
        }
      } else {
        scene.background = new THREE.Color(0x000814);
      }

      // Enhanced Earth with -realistic appearance
      const earthGroup = new THREE.Group();
      
      // Earth sphere with realistic textures
      const earthGeometry = new THREE.SphereGeometry(Constants.R_EARTH, 128, 128);
      const textureLoader = new THREE.TextureLoader();
      
      // Earth material - using standard material for PBR
      const earthMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2266ee,
        roughness: 0.8,
        metalness: 0.2,
        emissive: 0x112244,
        emissiveIntensity: 0.02
      });
      
      // Try to load realistic Earth texture
      if (settings.realisticMode && settings.quality !== 'low') {
        textureLoader.load(
          'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
          (texture) => {
            earthMaterial.map = texture;
            earthMaterial.needsUpdate = true;
          },
          undefined,
          () => {
            // Fallback: create procedural Earth-like appearance
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            // Ocean
            ctx.fillStyle = '#1e3a5f';
            ctx.fillRect(0, 0, 512, 256);
            
            // Continents
            ctx.fillStyle = '#2d5016';
            // Simplified continent shapes
            ctx.fillRect(100, 80, 80, 60); // Africa
            ctx.fillRect(200, 60, 120, 80); // Asia
            ctx.fillRect(340, 100, 60, 40); // Australia
            ctx.fillRect(420, 90, 70, 100); // Americas
            
            const texture = new THREE.CanvasTexture(canvas);
            earthMaterial.map = texture;
            earthMaterial.needsUpdate = true;
          }
        );
      }
      
      const earth = new THREE.Mesh(earthGeometry, earthMaterial);
      earth.receiveShadow = true;
      earth.castShadow = true;
      earthGroup.add(earth);

      // Realistic atmosphere with gradient
      const atmosphereGeometry = new THREE.SphereGeometry(Constants.R_EARTH * 1.03, 64, 64);
      const atmosphereMaterial = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;
          uniform vec3 sunDirection;
          
          void main() {
            vec3 viewDirection = normalize(cameraPosition - vPosition);
            float rim = 1.0 - max(0.0, dot(viewDirection, vNormal));
            float intensity = pow(rim, 2.0);
            
            // Atmosphere color with day/night variation
            vec3 dayColor = vec3(0.3, 0.6, 1.0);
            vec3 sunsetColor = vec3(1.0, 0.6, 0.3);
            
            float sunDot = dot(normalize(vPosition), sunDirection);
            float sunset = smoothstep(-0.3, 0.3, sunDot);
            
            vec3 atmosphereColor = mix(dayColor, sunsetColor, sunset * 0.5);
            atmosphereColor *= intensity;
            
            gl_FragColor = vec4(atmosphereColor, intensity * 0.6);
          }
        `,
        uniforms: {
          sunDirection: { value: new THREE.Vector3(1, 0, 0) }
        },
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true
      });
      const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
      earthGroup.add(atmosphere);

      // Cloud layer
      const cloudGeometry = new THREE.SphereGeometry(Constants.R_EARTH * 1.01, 64, 64);
      const cloudMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
      });
      const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
      earthGroup.add(clouds);

      // Add Earth axis tilt
      earthGroup.rotation.z = Constants.EARTH_TILT;
      scene.add(earthGroup);

      // Celestial bodies with realistic appearance
      if (settings.showCelestialBodies) {
        // Realistic Sun
        const sunGroup = new THREE.Group();
        const sunGeometry = new THREE.SphereGeometry(2000, 32, 32);
        const sunMaterial = new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0 }
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float time;
            varying vec2 vUv;
            
            void main() {
              vec2 center = vec2(0.5, 0.5);
              float dist = distance(vUv, center);
              
              // Sun color gradient
              vec3 coreColor = vec3(1.0, 1.0, 0.9);
              vec3 surfaceColor = vec3(1.0, 0.9, 0.6);
              vec3 coronaColor = vec3(1.0, 0.6, 0.2);
              
              vec3 color = mix(coreColor, surfaceColor, dist * 2.0);
              color = mix(color, coronaColor, smoothstep(0.4, 0.5, dist));
              
              // Add some animation
              float flicker = sin(time * 10.0 + dist * 20.0) * 0.05 + 0.95;
              color *= flicker;
              
              float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
              gl_FragColor = vec4(color, alpha);
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending
        });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        sunGroup.add(sun);
        
        // Sun corona
        const coronaGeometry = new THREE.SphereGeometry(3000, 32, 32);
        const coronaMaterial = new THREE.MeshBasicMaterial({
          color: 0xffaa00,
          transparent: true,
          opacity: 0.3,
          blending: THREE.AdditiveBlending
        });
        const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
        sunGroup.add(corona);
        
        // Sun light
        const sunLight = new THREE.PointLight(0xffffff, 2, 1000000);
        sunGroup.add(sunLight);
        
        sunGroup.position.set(150000, 0, 0);
        scene.add(sunGroup);
        celestialBodiesRef.current.sun = sunGroup;

        // Realistic Moon
        const moonGeometry = new THREE.SphereGeometry(Constants.R_MOON, 32, 32);
        const moonMaterial = new THREE.MeshStandardMaterial({ 
          color: 0xcccccc,
          roughness: 0.9,
          metalness: 0.1,
          emissive: 0x222222,
          emissiveIntensity: 0.1
        });
        
        // Create moon texture
        const moonCanvas = document.createElement('canvas');
        moonCanvas.width = 256;
        moonCanvas.height = 256;
        const moonCtx = moonCanvas.getContext('2d');
        
        // Moon surface
        moonCtx.fillStyle = '#cccccc';
        moonCtx.fillRect(0, 0, 256, 256);
        
        // Craters
        for (let i = 0; i < 30; i++) {
          moonCtx.beginPath();
          moonCtx.arc(
            Math.random() * 256,
            Math.random() * 256,
            Math.random() * 20 + 5,
            0,
            2 * Math.PI
          );
          moonCtx.fillStyle = `rgba(150, 150, 150, ${Math.random() * 0.5 + 0.5})`;
          moonCtx.fill();
        }
        
        const moonTexture = new THREE.CanvasTexture(moonCanvas);
        moonMaterial.map = moonTexture;
        
        const moon = new THREE.Mesh(moonGeometry, moonMaterial);
        moon.castShadow = true;
        moon.receiveShadow = true;
        moon.position.set(30000, 0, 0);
        scene.add(moon);
        celestialBodiesRef.current.moon = moon;
      }

      // Lighting setup
      const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(100000, 50000, 100000);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 1;
      directionalLight.shadow.camera.far = 500000;
      directionalLight.shadow.camera.left = -50000;
      directionalLight.shadow.camera.right = 50000;
      directionalLight.shadow.camera.top = 50000;
      directionalLight.shadow.camera.bottom = -50000;
      scene.add(directionalLight);

      // Enhanced controls with reduced sensitivity
      let mouseX = 0, mouseY = 0;
      let targetRotationX = 0, targetRotationY = 0;
      let isMouseDown = false;
      let momentum = { x: 0, y: 0 };
      let touchStartDistance = 0;
      let touchStartX = 0;
      let touchStartY = 0;

      const handleMouseMove = (event) => {
        if (!isMouseDown) return;
        const deltaX = event.clientX - window.innerWidth / 2;
        const deltaY = event.clientY - window.innerHeight / 2;
        mouseX = deltaX * settings.mouseSensitivity;
        mouseY = deltaY * settings.mouseSensitivity;
        momentum.x = mouseX;
        momentum.y = mouseY;
      };

      const handleMouseDown = (event) => { 
        isMouseDown = true;
        document.body.style.cursor = 'grabbing';
      };
      
      const handleMouseUp = () => { 
        isMouseDown = false;
        document.body.style.cursor = 'grab';
      };
      
      const handleWheel = (event) => {
        event.preventDefault();
        const scale = event.deltaY > 0 ? (1 + settings.zoomSpeed) : (1 - settings.zoomSpeed);
        const newDistance = camera.position.length() * scale;
        if (newDistance > Constants.R_EARTH * 2 && newDistance < 300000) {
          camera.position.multiplyScalar(scale);
        }
      };

      // Touch controls for mobile
      const handleTouchStart = (event) => {
        if (event.touches.length === 1) {
          isMouseDown = true;
          touchStartX = event.touches[0].clientX;
          touchStartY = event.touches[0].clientY;
        } else if (event.touches.length === 2) {
          const dx = event.touches[0].clientX - event.touches[1].clientX;
          const dy = event.touches[0].clientY - event.touches[1].clientY;
          touchStartDistance = Math.sqrt(dx * dx + dy * dy);
        }
      };

      const handleTouchMove = (event) => {
        event.preventDefault();
        
        if (event.touches.length === 1 && isMouseDown) {
          const deltaX = event.touches[0].clientX - touchStartX;
          const deltaY = event.touches[0].clientY - touchStartY;
          mouseX = deltaX * settings.mouseSensitivity * 0.5; // Reduced for mobile
          mouseY = deltaY * settings.mouseSensitivity * 0.5;
          touchStartX = event.touches[0].clientX;
          touchStartY = event.touches[0].clientY;
        } else if (event.touches.length === 2 && touchStartDistance > 0) {
          const dx = event.touches[0].clientX - event.touches[1].clientX;
          const dy = event.touches[0].clientY - event.touches[1].clientY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const scale = distance / touchStartDistance;
          
          const newDistance = camera.position.length() / scale;
          if (newDistance > Constants.R_EARTH * 2 && newDistance < 300000) {
            camera.position.multiplyScalar(1 / scale);
          }
          
          touchStartDistance = distance;
        }
      };

      const handleTouchEnd = () => {
        isMouseDown = false;
        touchStartDistance = 0;
      };

      // Add event listeners
      renderer.domElement.addEventListener('mousemove', handleMouseMove);
      renderer.domElement.addEventListener('mousedown', handleMouseDown);
      renderer.domElement.addEventListener('mouseup', handleMouseUp);
      renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
      renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
      renderer.domElement.addEventListener('touchend', handleTouchEnd);
      renderer.domElement.style.cursor = 'grab';

      // Animation loop
      let lastTime = performance.now();
      const animate = () => {
        frameRef.current = requestAnimationFrame(animate);

        const currentTime = performance.now();
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        // Apply momentum
        if (!isMouseDown) {
          momentum.x *= 0.95;
          momentum.y *= 0.95;
          mouseX = momentum.x;
          mouseY = momentum.y;
        }

        // Smooth camera rotation
        targetRotationX += mouseX;
        targetRotationY += mouseY;
        targetRotationY = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, targetRotationY));
        mouseX *= 0.95;
        mouseY *= 0.95;

        const radius = camera.position.length();
        camera.position.x = radius * Math.sin(targetRotationX) * Math.cos(targetRotationY);
        camera.position.y = radius * Math.sin(targetRotationY);
        camera.position.z = radius * Math.cos(targetRotationX) * Math.cos(targetRotationY);
        camera.lookAt(0, 0, 0);

        // Rotate Earth and clouds
        const rotationSpeed = Constants.OMEGA_EARTH * timeScale;
        earth.rotation.y += rotationSpeed * deltaTime;
        clouds.rotation.y += rotationSpeed * deltaTime * 1.1; // Clouds move slightly faster

        // Update sun position
        if (celestialBodiesRef.current.sun) {
          const jd = simulationTime.getTime() / 86400000 + 2440587.5;
          const sunPos = OrbitalMechanics.getSunPosition(jd);
          celestialBodiesRef.current.sun.position.set(
            sunPos.x / 1000, // Scale down for visualization
            sunPos.y / 1000,
            sunPos.z / 1000
          );
          atmosphereMaterial.uniforms.sunDirection.value = celestialBodiesRef.current.sun.position.clone().normalize();
          
          // Update sun animation
          if (celestialBodiesRef.current.sun.children[0]) {
            celestialBodiesRef.current.sun.children[0].material.uniforms.time.value = currentTime * 0.001;
          }
        }

        // Update moon position
        if (celestialBodiesRef.current.moon) {
          const jd = simulationTime.getTime() / 86400000 + 2440587.5;
          const moonPos = OrbitalMechanics.getMoonPosition(jd);
          celestialBodiesRef.current.moon.position.set(moonPos.x, moonPos.y, moonPos.z);
          
          // Moon rotation
          celestialBodiesRef.current.moon.rotation.y += 0.0001 * deltaTime;
        }

        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        if (!mountRef.current) return;
        camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      };
      window.addEventListener('resize', handleResize);

      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        window.removeEventListener('resize', handleResize);
        renderer.domElement.removeEventListener('mousemove', handleMouseMove);
        renderer.domElement.removeEventListener('mousedown', handleMouseDown);
        renderer.domElement.removeEventListener('mouseup', handleMouseUp);
        renderer.domElement.removeEventListener('wheel', handleWheel);
        renderer.domElement.removeEventListener('touchstart', handleTouchStart);
        renderer.domElement.removeEventListener('touchmove', handleTouchMove);
        renderer.domElement.removeEventListener('touchend', handleTouchEnd);
        if (mountRef.current && renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
        renderer.dispose();
      };
    } catch (err) {
      console.error('Three.js initialization error:', err);
      setError('Failed to initialize 3D view');
    }
  }, [settings.quality, settings.realisticMode, settings.showCelestialBodies, settings.showConstellations, settings.showMilkyWay, settings.mouseSensitivity, settings.zoomSpeed, timeScale]);

  // Load satellite data
  const loadSatelliteData = async (source = 'active') => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await SatelliteDataManager.fetchRealTimeData(source);
      setSatellites(data);
      
      // Calculate statistics
      const stats = {
        total: data.length,
        byCategory: {},
        averageAltitude: 0,
        collisionRisks: 0
      };
      
      let totalAltitude = 0;
      data.forEach(sat => {
        stats.byCategory[sat.category] = (stats.byCategory[sat.category] || 0) + 1;
        const orb = OrbitalMechanics.calculateOrbitalElements(
          OrbitalMechanics.orbitalToCartesian(sat.elements, simulationTime.getTime()).position,
          OrbitalMechanics.orbitalToCartesian(sat.elements, simulationTime.getTime()).velocity
        );
        totalAltitude += (orb.apogee + orb.perigee) / 2;
      });
      
      stats.averageAltitude = totalAltitude / data.length;
      setStatistics(stats);
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load satellite data - using sample data');
    } finally {
      setLoading(false);
    }
  };

  // Update satellite positions with orbits and labels
  const updateSatellitePositions = useCallback(() => {
    if (!sceneRef.current) return;

    const visibleSatellites = satellites.filter(sat => {
      if (!settings.showDebris && sat.category === 'debris') return false;
      if (selectedCategory !== 'all' && sat.category !== selectedCategory) return false;
      if (searchQuery && !sat.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    visibleSatellites.forEach(sat => {
      if (!sat.elements) return;

      try {
        const state = OrbitalMechanics.orbitalToCartesian(sat.elements, simulationTime.getTime());
        const catInfo = SATELLITE_CATEGORIES[sat.category] || SATELLITE_CATEGORIES.other;
        
        // Create or update satellite object
        if (!satelliteObjectsRef.current[sat.id]) {
          const satGroup = new THREE.Group();
          
          // Main satellite sphere
          const satGeometry = new THREE.IcosahedronGeometry(catInfo.size, 1);
          const satMaterial = new THREE.MeshStandardMaterial({
            color: catInfo.color,
            emissive: catInfo.color,
            emissiveIntensity: 0.3,
            metalness: 0.8,
            roughness: 0.2
          });
          const satMesh = new THREE.Mesh(satGeometry, satMaterial);
          satMesh.castShadow = true;
          satMesh.receiveShadow = true;
          satGroup.add(satMesh);

          // Add solar panels for some satellites
          if (sat.category === 'station' || sat.category === 'science') {
            const panelGeometry = new THREE.BoxGeometry(catInfo.size * 3, catInfo.size * 0.1, catInfo.size * 1.5);
            const panelMaterial = new THREE.MeshStandardMaterial({
              color: 0x000088,
              emissive: 0x000044,
              emissiveIntensity: 0.1,
              metalness: 0.9,
              roughness: 0.1
            });
            
            const panel1 = new THREE.Mesh(panelGeometry, panelMaterial);
            panel1.position.x = catInfo.size * 2;
            satGroup.add(panel1);
            
            const panel2 = new THREE.Mesh(panelGeometry, panelMaterial);
            panel2.position.x = -catInfo.size * 2;
            satGroup.add(panel2);
          }

          sceneRef.current.add(satGroup);
          satelliteObjectsRef.current[sat.id] = satGroup;

          // Create orbit line
          if (settings.showOrbits) {
            const orbitPoints = [];
            const period = 2 * Math.PI / sat.elements.meanMotion;
            const steps = Math.min(200, Math.max(50, period / 300));
            
            for (let t = 0; t < period; t += period / steps) {
              const orbitState = OrbitalMechanics.orbitalToCartesian(sat.elements, simulationTime.getTime() + t * 1000);
              orbitPoints.push(new THREE.Vector3(
                orbitState.position.x,
                orbitState.position.y,
                orbitState.position.z
              ));
            }
            orbitPoints.push(orbitPoints[0]);
            
            const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
            const orbitMaterial = new THREE.LineBasicMaterial({
              color: catInfo.color,
              transparent: true,
              opacity: 0.3,
              linewidth: 1
            });
            const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
            sceneRef.current.add(orbitLine);
            orbitLinesRef.current[sat.id] = orbitLine;
          }

          // Create label
          if (settings.showLabels) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 512;
            canvas.height = 128;
            
            // Background with gradient
            const gradient = context.createLinearGradient(0, 0, 512, 0);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
            context.fillStyle = gradient;
            context.roundRect(0, 0, 512, 128, 10);
            context.fill();
            
            // Border
            context.strokeStyle = `#${catInfo.color.toString(16).padStart(6, '0')}`;
            context.lineWidth = 3;
            context.roundRect(0, 0, 512, 128, 10);
            context.stroke();
            
            // Icon and text
            context.font = 'bold 32px Arial';
            context.fillStyle = 'white';
            context.fillText(catInfo.icon, 20, 50);
            context.font = 'bold 28px Arial';
            context.fillText(sat.name.substring(0, 20), 80, 50);
            
            // Info
            context.font = '20px Arial';
            context.fillStyle = '#aaaaaa';
            context.fillText(`NORAD: ${sat.noradId}`, 80, 80);
            context.fillText(catInfo.label, 80, 105);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ 
              map: texture,
              sizeAttenuation: true
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(2000, 500, 1);
            sprite.position.y = catInfo.size * 2;
            
            labelSpritesRef.current[sat.id] = sprite;
            satGroup.add(sprite);
          }
        }

        // Update position
        const satObject = satelliteObjectsRef.current[sat.id];
        if (satObject) {
          satObject.position.set(state.position.x, state.position.y, state.position.z);
          
          // Point solar panels at sun
          if (celestialBodiesRef.current.sun && satObject.children.length > 1) {
            const sunDir = celestialBodiesRef.current.sun.position.clone().normalize();
            satObject.lookAt(satObject.position.clone().add(sunDir));
          }
          
          // Update visibility based on distance
          const distance = cameraRef.current.position.distanceTo(satObject.position);
          satObject.visible = distance < 200000;
          
          // Show/hide label based on distance
          if (labelSpritesRef.current[sat.id]) {
            labelSpritesRef.current[sat.id].visible = 
              settings.showLabels && distance < settings.labelDistance;
          }
        }

        // Update orbit visibility
        if (orbitLinesRef.current[sat.id]) {
          orbitLinesRef.current[sat.id].visible = settings.showOrbits;
        }
      } catch (err) {
        console.error(`Error updating satellite ${sat.name}:`, err);
      }
    });

    // Remove old satellites
    Object.keys(satelliteObjectsRef.current).forEach(id => {
      if (!visibleSatellites.find(sat => sat.id === id)) {
        sceneRef.current.remove(satelliteObjectsRef.current[id]);
        delete satelliteObjectsRef.current[id];
        
        if (orbitLinesRef.current[id]) {
          sceneRef.current.remove(orbitLinesRef.current[id]);
          delete orbitLinesRef.current[id];
        }
      }
    });
  }, [satellites, simulationTime, settings, selectedCategory, searchQuery]);

  // Generate enhanced trajectory
  const generateTrajectory = useCallback((satellite) => {
    if (!satellite?.elements) return [];
    
    const trajectory = [];
    const dt = 60000; // 1 minute
    const steps = settings.predictionHours * 60;
    
    for (let i = 0; i < steps; i++) {
      const t = simulationTime.getTime() + i * dt;
      const state = OrbitalMechanics.orbitalToCartesian(satellite.elements, t);
      const orbitalElements = OrbitalMechanics.calculateOrbitalElements(state.position, state.velocity);
      
      trajectory.push({
        time: i,
        altitude: (orbitalElements.apogee + orbitalElements.perigee) / 2,
        apogee: orbitalElements.apogee,
        perigee: orbitalElements.perigee,
        velocity: Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2),
        period: orbitalElements.period,
        eccentricity: orbitalElements.eccentricity
      });
    }
    
    return trajectory;
  }, [simulationTime, settings.predictionHours]);

  // Effects
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSimulationTime(prev => new Date(prev.getTime() + timeScale * 1000));
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying, timeScale]);

  useEffect(() => {
    updateSatellitePositions();
  }, [simulationTime, updateSatellitePositions]);

  useEffect(() => {
    if (selectedSatellite) {
      const data = generateTrajectory(selectedSatellite);
      setTrajectoryData(data);
    }
  }, [selectedSatellite, generateTrajectory]);

  // Auto-refresh data
  useEffect(() => {
    const interval = setInterval(() => {
      loadSatelliteData(dataSource);
    }, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, [dataSource]);

  // Export functions
  const exportData = (type) => {
    let data, filename;
    
    if (type === 'trajectory' && trajectoryData.length > 0) {
      const headers = ['Time (min)', 'Altitude (km)', 'Apogee (km)', 'Perigee (km)', 'Velocity (km/s)', 'Period (min)', 'Eccentricity'];
      const rows = trajectoryData.map(point => [
        point.time,
        point.altitude.toFixed(2),
        point.apogee.toFixed(2),
        point.perigee.toFixed(2),
        point.velocity.toFixed(3),
        point.period.toFixed(2),
        point.eccentricity.toFixed(6)
      ]);
      data = [headers, ...rows].map(row => row.join(',')).join('\n');
      filename = `trajectory_${selectedSatellite?.name.replace(/\s+/g, '_')}_${new Date().toISOString()}.csv`;
    } else if (type === 'satellites') {
      data = satellites.map(sat => 
        `${sat.name}\n1 ${sat.elements.satnum}U ${sat.elements.intldesg}\n2 ${sat.elements.satnum}`
      ).join('\n\n');
      filename = `satellites_${new Date().toISOString()}.txt`;
    }
    
    if (data) {
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Help component
  const HelpTooltip = ({ id, text }) => (
    <div className="relative inline-block ml-1">
      <button
        onClick={() => setShowHelp(prev => ({ ...prev, [id]: !prev[id] }))}
        className="text-gray-400 hover:text-gray-200 transition-colors"
      >
        <HelpCircle size={14} />
      </button>
      {showHelp[id] && (
        <div className="absolute z-50 bg-gray-900 text-white p-3 rounded-lg shadow-xl text-sm w-64 -right-2 top-6 border border-gray-700">
          <button
            onClick={() => setShowHelp(prev => ({ ...prev, [id]: false }))}
            className="absolute top-1 right-1 text-gray-400 hover:text-white"
          >
            <X size={14} />
          </button>
          <p className="pr-4">{text}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Enhanced Header */}
      <header className="bg-gray-900 shadow-2xl border-b border-gray-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Orbit className="text-blue-400 animate-pulse" size={isMobile ? 28 : 36} />
                <div className="absolute inset-0 bg-blue-400 blur-xl opacity-30"></div>
              </div>
              <div>
                <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent`}>
                  Satellite Tracker
                </h1>
                <p className="text-xs text-gray-400">Space Visualization</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {!isMobile && (
                <div className="flex items-center space-x-2">
                  <Sun size={16} className="text-yellow-400" />
                  <Moon size={16} className="text-gray-300" />
                  <Star size={16} className="text-white" />
                </div>
              )}
              <div className="flex items-center">
                <Clock size={16} className="mr-2 text-gray-400" />
                <span className="font-mono text-sm">{simulationTime.toISOString().slice(0, 19)}Z</span>
              </div>
              <div className="text-xs text-gray-400">
                {isMobile ? <Smartphone size={16} /> : <Monitor size={16} />}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className={`flex ${isMobile ? 'flex-col' : ''} h-[calc(100vh-64px)]`}>
        {/* Enhanced Control Panel */}
        <div className={`${isMobile ? 'w-full h-auto' : 'w-96'} bg-gray-900 overflow-y-auto border-r border-gray-800`}>
          <div className="p-4 space-y-4">
            {/* Control hint for mobile */}
            {isMobile && (
              <div className="bg-blue-900 bg-opacity-30 rounded-lg p-3 border border-blue-700">
                <div className="flex items-center text-sm">
                  <Move3d size={16} className="mr-2 text-blue-400" />
                  <span>Touch & drag to rotate, pinch to zoom</span>
                </div>
              </div>
            )}

            {/* Data Source Selection */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold mb-3 flex items-center">
                <Database size={18} className="mr-2 text-green-400" />
                Data Source
                <HelpTooltip id="source" text="Select satellite category to load. Real-time data when available." />
              </h3>
              <select
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                className="w-full bg-gray-700 rounded px-3 py-2 text-sm mb-2"
              >
                <option value="active">All Active Satellites</option>
                <option value="stations">Space Stations</option>
                <option value="starlink">Starlink Constellation</option>
                <option value="oneweb">OneWeb Constellation</option>
                <option value="gps-ops">GPS Operational</option>
                <option value="galileo">Galileo</option>
                <option value="science">Science Satellites</option>
                <option value="geo">Geostationary</option>
              </select>
              <button
                onClick={() => loadSatelliteData(dataSource)}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-all duration-200 flex items-center justify-center"
              >
                {loading ? (
                  <RefreshCw className="animate-spin mr-2" size={16} />
                ) : (
                  <Download size={16} className="mr-2" />
                )}
                Load Data
              </button>
              {error && (
                <div className="mt-2 text-yellow-400 text-sm flex items-center">
                  <AlertCircle size={14} className="mr-1" />
                  Using sample data
                </div>
              )}
            </div>

            {/* Statistics Dashboard */}
            {satellites.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="font-semibold mb-3 flex items-center">
                  <TrendingUp size={18} className="mr-2 text-purple-400" />
                  Live Statistics
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-700 rounded p-2">
                    <div className="text-gray-400 text-xs">Total Satellites</div>
                    <div className="text-xl font-bold">{statistics.total}</div>
                  </div>
                  <div className="bg-gray-700 rounded p-2">
                    <div className="text-gray-400 text-xs">Avg Altitude</div>
                    <div className="text-xl font-bold">{statistics.averageAltitude.toFixed(0)} km</div>
                  </div>
                </div>
              </div>
            )}

            {/* Search and Filter */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold mb-3 flex items-center">
                <Search size={18} className="mr-2 text-blue-400" />
                Search & Filter
              </h3>
              <input
                type="text"
                placeholder="Search satellites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-700 rounded px-3 py-2 text-sm mb-2"
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
              >
                <option value="all">All Categories</option>
                {Object.entries(SATELLITE_CATEGORIES).map(([key, cat]) => (
                  <option key={key} value={key}>{cat.icon} {cat.label}</option>
                ))}
              </select>
            </div>

            {/* Satellite List */}
            {satellites.length > 0 && !isMobile && (
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="font-semibold mb-3 flex items-center">
                  <Satellite size={18} className="mr-2 text-blue-400" />
                  Satellites ({satellites.filter(sat => 
                    (selectedCategory === 'all' || sat.category === selectedCategory) &&
                    (!searchQuery || sat.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  ).length})
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {satellites
                    .filter(sat => 
                      (selectedCategory === 'all' || sat.category === selectedCategory) &&
                      (!searchQuery || sat.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    )
                    .slice(0, 50)
                    .map(sat => {
                      const catInfo = SATELLITE_CATEGORIES[sat.category] || SATELLITE_CATEGORIES.other;
                      return (
                        <button
                          key={sat.id}
                          onClick={() => setSelectedSatellite(sat)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
                            selectedSatellite?.id === sat.id
                              ? 'bg-blue-600 shadow-lg'
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <span className="mr-2">{catInfo.icon}</span>
                              <span className="truncate">{sat.name}</span>
                            </div>
                            <ChevronRight size={16} />
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Time Controls */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold mb-3 flex items-center">
                <Timer size={18} className="mr-2 text-purple-400" />
                Time Controls
              </h3>
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
                  >
                    {isPlaying ? <Pause size={18} className="mr-2" /> : <Play size={18} className="mr-2" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button
                    onClick={() => setSimulationTime(new Date())}
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Time Scale: {timeScale}x</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="3"
                    step="0.1"
                    value={Math.log10(timeScale)}
                    onChange={(e) => setTimeScale(Math.pow(10, parseFloat(e.target.value)))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Visualization Settings */}
            {!isMobile && (
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="font-semibold mb-3 flex items-center">
                  <Settings size={18} className="mr-2 text-gray-400" />
                  Visualization
                </h3>
                <div className="space-y-2">
                  <label className="flex items-center justify-between">
                    <span className="text-sm flex items-center">
                      <Orbit size={14} className="mr-1" /> Show Orbits
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.showOrbits}
                      onChange={(e) => setSettings({ ...settings, showOrbits: e.target.checked })}
                      className="rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm flex items-center">
                      <Info size={14} className="mr-1" /> Show Labels
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.showLabels}
                      onChange={(e) => setSettings({ ...settings, showLabels: e.target.checked })}
                      className="rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm flex items-center">
                      <Star size={14} className="mr-1" /> Constellations
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.showConstellations}
                      onChange={(e) => setSettings({ ...settings, showConstellations: e.target.checked })}
                      className="rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm flex items-center">
                      <Layers size={14} className="mr-1" /> Milky Way
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.showMilkyWay}
                      onChange={(e) => setSettings({ ...settings, showMilkyWay: e.target.checked })}
                      className="rounded"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main View */}
        <div className="flex-1 flex flex-col">
          {/* 3D View */}
          <div className="flex-1 relative">
            <div ref={mountRef} className="w-full h-full" />
            
            {/* View Controls Overlay */}
            <div className="absolute top-4 left-4 space-y-2">
              <div className="bg-gray-900 bg-opacity-90 rounded-lg p-3 backdrop-blur-sm border border-gray-800">
                <div className="flex items-center space-x-2 text-sm">
                  <Zap className="text-yellow-400" size={16} />
                  <span>3D View</span>
                </div>
              </div>
              
              {selectedSatellite && (
                <div className="bg-gray-900 bg-opacity-90 rounded-lg p-3 backdrop-blur-sm border border-gray-800">
                  <div className="text-sm space-y-1">
                    <div className="font-semibold text-blue-400 flex items-center">
                      {SATELLITE_CATEGORIES[selectedSatellite.category]?.icon} {selectedSatellite.name}
                    </div>
                    <div className="text-xs text-gray-400">NORAD: {selectedSatellite.noradId}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Legend */}
            {!isMobile && (
              <div className="absolute bottom-4 right-4 bg-gray-900 bg-opacity-90 rounded-lg p-3 backdrop-blur-sm border border-gray-800">
                <h4 className="text-xs font-semibold mb-2">Categories</h4>
                <div className="space-y-1">
                  {Object.entries(SATELLITE_CATEGORIES).slice(0, 5).map(([key, cat]) => (
                    <div key={key} className="flex items-center text-xs">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: `#${cat.color.toString(16).padStart(6, '0')}` }}
                      ></div>
                      <span>{cat.icon} {cat.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Analysis Panel */}
          {selectedSatellite && trajectoryData.length > 0 && !isMobile && (
            <div className="h-64 bg-gray-900 border-t border-gray-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center">
                  <Activity size={18} className="mr-2 text-green-400" />
                  Orbital Analysis: {selectedSatellite.name}
                </h3>
                <button
                  onClick={() => exportData('trajectory')}
                  className="bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded text-sm transition-colors"
                >
                  Export CSV
                </button>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trajectoryData}>
                  <defs>
                    <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="time" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                  <Area type="monotone" dataKey="altitude" stroke="#10B981" fillOpacity={1} fill="url(#colorAlt)" />
                  <Line type="monotone" dataKey="apogee" stroke="#F59E0B" strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="perigee" stroke="#EF4444" strokeDasharray="5 5" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedSatelliteTracker;