'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface ConflictZone {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  intensity_level: number;
  conflict_type: string;
  estimated_casualties: number;
  displaced_population: number;
  active_frontlines: number;
}

export default function GlobeClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [conflicts, setConflicts] = useState<ConflictZone[]>([]);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({ conflicts: 0, casualties: 0, displaced: 0 });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

  useEffect(() => {
    fetchConflicts();
  }, []);

  const fetchConflicts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/conflicts`);
      if (!response.ok) throw new Error('Backend not responding');
      let data = await response.json();
      
      // Remove duplicates
      const unique = [];
      const seen = new Set();
      for (const item of data) {
        if (!seen.has(item.name)) {
          seen.add(item.name);
          unique.push(item);
        }
      }
      
      setConflicts(unique);
      setTotalStats({
        conflicts: unique.length,
        casualties: unique.reduce((s, c) => s + (c.estimated_casualties || 0), 0),
        displaced: unique.reduce((s, c) => s + (c.displaced_population || 0), 0)
      });
      
      setLoading(false);
      initGlobe(unique);
    } catch (error) {
      console.log('Using fallback data');
      const fallback = [
        { id: 1, name: 'Ukraine', latitude: 48.38, longitude: 31.17, intensity_level: 94, conflict_type: 'active_war', estimated_casualties: 12400, displaced_population: 3200000, active_frontlines: 7 },
        { id: 2, name: 'Gaza Strip', latitude: 31.35, longitude: 34.31, intensity_level: 98, conflict_type: 'active_war', estimated_casualties: 18700, displaced_population: 1900000, active_frontlines: 3 },
        { id: 3, name: 'Sudan', latitude: 15.50, longitude: 32.56, intensity_level: 85, conflict_type: 'civil_war', estimated_casualties: 9100, displaced_population: 5400000, active_frontlines: 6 },
        { id: 4, name: 'Myanmar', latitude: 21.92, longitude: 95.96, intensity_level: 72, conflict_type: 'civil_war', estimated_casualties: 2200, displaced_population: 1200000, active_frontlines: 5 },
        { id: 5, name: 'Syria', latitude: 34.80, longitude: 39.00, intensity_level: 78, conflict_type: 'proxy_conflict', estimated_casualties: 3800, displaced_population: 1900000, active_frontlines: 4 }
      ];
      setConflicts(fallback);
      setTotalStats({
        conflicts: fallback.length,
        casualties: fallback.reduce((s, c) => s + c.estimated_casualties, 0),
        displaced: fallback.reduce((s, c) => s + c.displaced_population, 0)
      });
      setLoading(false);
      initGlobe(fallback);
    }
  };

  const initGlobe = (data: ConflictZone[]) => {
    if (!containerRef.current) return;

    // Clear container
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }

    // Setup Three.js
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 3.2;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // Earth
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg');
    const earthGeo = new THREE.SphereGeometry(1, 128, 128);
    const earthMat = new THREE.MeshPhongMaterial({ map: earthTexture, shininess: 5 });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Atmosphere
    const atmosGeo = new THREE.SphereGeometry(1.01, 128, 128);
    const atmosMat = new THREE.MeshPhongMaterial({ color: 0x3399ff, transparent: true, opacity: 0.12 });
    const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosphere);

    // Lighting
    const ambient = new THREE.AmbientLight(0x404040);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 1.2);
    directional.position.set(5, 10, 7);
    scene.add(directional);
    const backLight = new THREE.PointLight(0x4466cc, 0.4);
    backLight.position.set(-2, -1, -3);
    scene.add(backLight);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starCount = 3000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i*3] = (Math.random() - 0.5) * 2000;
      starPos[i*3+1] = (Math.random() - 0.5) * 1000;
      starPos[i*3+2] = (Math.random() - 0.5) * 500 - 200;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.25 }));
    scene.add(stars);

    // Markers
    const markers = new THREE.Group();
    
    data.forEach(conflict => {
      const lat = conflict.latitude * Math.PI / 180;
      const lon = conflict.longitude * Math.PI / 180;
      const r = 1.02;
      const x = r * Math.cos(lat) * Math.cos(lon);
      const y = r * Math.sin(lat);
      const z = r * Math.cos(lat) * Math.sin(lon);
      
      const color = conflict.intensity_level >= 80 ? 0xff0000 :
                    conflict.intensity_level >= 60 ? 0xff4444 : 0xff8800;
      
      const size = 0.04 + (conflict.intensity_level / 100) * 0.04;
      const markerGeo = new THREE.SphereGeometry(size, 32, 32);
      const markerMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5 });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(x, y, z);
      marker.userData = conflict;
      markers.add(marker);
      
      // Pulse ring for high intensity
      if (conflict.intensity_level >= 80) {
        const ringGeo = new THREE.SphereGeometry(0.08, 16, 16);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.7 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(x, y, z);
        markers.add(ring);
        
        let s = 1;
        let growing = true;
        const pulse = () => {
          s += growing ? 0.03 : -0.03;
          if (s >= 2) growing = false;
          if (s <= 1) growing = true;
          ring.scale.set(s, s, s);
          if (ringMat) ringMat.opacity = 0.7 * (1 - (s - 1) / 2);
          requestAnimationFrame(pulse);
        };
        pulse();
      }
    });
    
    scene.add(markers);

    // Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    renderer.domElement.addEventListener('mousemove', (e) => {
      mouse.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1;
      mouse.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markers.children);
      
      if (intersects.length > 0 && intersects[0].object.userData) {
        const c = intersects[0].object.userData as ConflictZone;
        const conflictType = c.conflict_type ? c.conflict_type.replace(/_/g, ' ') : 'unknown';
        setTooltip({
          visible: true,
          x: e.clientX + 15,
          y: e.clientY - 15,
          content: `<strong>${c.name || 'Unknown'}</strong><br/>🔥 ${c.intensity_level || 0}%<br/>⚔️ ${conflictType}<br/>💀 ${(c.estimated_casualties || 0).toLocaleString()} casualties`
        });
      } else {
        setTooltip(prev => ({ ...prev, visible: false }));
      }
    });
    
    renderer.domElement.addEventListener('click', (e) => {
      mouse.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1;
      mouse.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markers.children);
      if (intersects.length > 0 && intersects[0].object.userData) {
        const c = intersects[0].object.userData as ConflictZone;
        alert(`${c.name || 'Unknown'}\n\nIntensity: ${c.intensity_level || 0}%\nCasualties: ${(c.estimated_casualties || 0).toLocaleString()}\nDisplaced: ${(c.displaced_population || 0).toLocaleString()}\nFrontlines: ${c.active_frontlines || 0}`);
      }
    });

    // Animation
    let angle = 0;
    const animate = () => {
      angle += 0.0018;
      earth.rotation.y = angle;
      atmosphere.rotation.y = angle;
      markers.rotation.y = angle;
      stars.rotation.y = angle * 0.2;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div style={{ marginTop: 20, color: '#888' }}>Loading Global Intelligence...</div>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }} />
      
      <div className="info-panel">
        <h1>🌍 WAR TIMELINE VISUALIZER</h1>
        <div className="subtitle">Global Conflict Intelligence Dashboard</div>
      </div>
      
      <div className="stats-panel">
        <div className="stat-number">{totalStats.conflicts}</div>
        <div className="stat-label">ACTIVE CONFLICTS</div>
        <div className="stat-number mt-2">{totalStats.casualties.toLocaleString()}</div>
        <div className="stat-label">TOTAL CASUALTIES</div>
        <div className="stat-number mt-2">{(totalStats.displaced / 1000000).toFixed(1)}M</div>
        <div className="stat-label">DISPLACED</div>
      </div>
      
      <div className="legend-box">
        <h4>⚔️ CONFLICT SEVERITY</h4>
        <div className="legend-item"><div className="legend-color extreme"></div><span>Extreme (80-100%)</span></div>
        <div className="legend-item"><div className="legend-color high"></div><span>High (60-79%)</span></div>
        <div className="legend-item"><div className="legend-color medium"></div><span>Medium (40-59%)</span></div>
      </div>
      
      {tooltip.visible && (
        <div className="country-tooltip" style={{ left: tooltip.x, top: tooltip.y, position: 'fixed', zIndex: 2000 }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }} />
      )}
    </>
  );
}
