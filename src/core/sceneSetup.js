import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createSceneSystem(container) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xc9dfd7, 0.033);

  const camera = new THREE.PerspectiveCamera(34, container.clientWidth / container.clientHeight, 0.1, 80);
  const homePosition = new THREE.Vector3(6.2, 4.4, 8.1);
  const homeTarget = new THREE.Vector3(0, 1.95, 0.15);
  camera.position.copy(homePosition);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(homeTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 4.4;
  controls.maxDistance = 15.5;
  controls.minPolarAngle = 0.36;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.autoRotate = !prefersReducedMotion.matches;
  controls.autoRotateSpeed = 0.42;
  controls.update();

  function resetCamera() {
    camera.position.copy(homePosition);
    controls.target.copy(homeTarget);
    controls.update();
  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  }

  window.addEventListener('resize', resize, { passive: true });
  return { scene, camera, renderer, controls, resetCamera, prefersReducedMotion };
}
