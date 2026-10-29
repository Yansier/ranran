import * as THREE from 'three';
import './styles.css';
import { createSceneSystem } from './core/sceneSetup.js';
import { createAmbientAudio } from './core/ambientAudio.js';
import { createLighting } from './world/createLighting.js';
import { createSky } from './world/createSky.js';
import { createMeadow } from './world/createMeadow.js';
import { createProceduralRanran } from './character/createRanran.js';
import { createFireflies, createMagicButterfly } from './effects/createMagicButterfly.js';

const container = document.querySelector('#scene-container');
const { scene, camera, renderer, controls, resetCamera, prefersReducedMotion } = createSceneSystem(container);
createLighting(scene);
scene.add(createSky());

const meadow = createMeadow();
const ranran = createProceduralRanran();
const butterfly = createMagicButterfly();
const fireflies = createFireflies();
scene.add(meadow, ranran, butterfly, fireflies);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const time = clock.getElapsedTime();
  const motionScale = prefersReducedMotion.matches ? 0.2 : 1;
  ranran.userData.update?.(time, motionScale);
  butterfly.userData.update?.(time, motionScale);
  fireflies.userData.update?.(time, motionScale);
  controls.update();
  renderer.render(scene, camera);
});

const resetButton = document.querySelector('#reset-camera');
const rotateButton = document.querySelector('#toggle-rotate');
const musicButton = document.querySelector('#toggle-music');
const ambient = createAmbientAudio();

function syncRotateButton() {
  rotateButton.classList.toggle('active', controls.autoRotate);
  rotateButton.setAttribute('aria-pressed', String(controls.autoRotate));
}

function setCameraPreset(name = 'hero') {
  const presets = {
    hero: { position: [6.8, 5.2, 9.0], target: [0, 2.45, 0.1] },
    front: { position: [0, 2.8, 9.4], target: [0, 2.4, 0.05] },
    side: { position: [8.9, 2.8, 3.15], target: [0, 2.4, 0.05] },
    back: { position: [0, 2.8, -9.4], target: [0, 2.4, -0.05] },
    face: { position: [0, 4.05, 3.7], target: [-0.04, 4.0, 0.12] },
    mobile: { position: [4.4, 5.25, 10.8], target: [-0.25, 2.45, 0.08] }
  };
  const preset = presets[name] || presets.hero;
  controls.autoRotate = false;
  camera.position.fromArray(preset.position);
  controls.target.fromArray(preset.target);
  controls.update();
  syncRotateButton();
}

function measureCharacter() {
  ranran.updateWorldMatrix(true, true);
  const face = ranran.getObjectByName('Ranran_FaceVolume');
  const characterSize = new THREE.Box3().setFromObject(ranran).getSize(new THREE.Vector3());
  const faceSize = new THREE.Box3().setFromObject(face).getSize(new THREE.Vector3());
  return {
    height: characterSize.y,
    headHeight: faceSize.y,
    headRatio: characterSize.y / faceSize.y
  };
}

resetButton.addEventListener('click', resetCamera);
rotateButton.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  syncRotateButton();
});
musicButton.addEventListener('click', () => {
  const enabled = ambient.toggle();
  musicButton.classList.toggle('active', enabled);
  musicButton.setAttribute('aria-pressed', String(enabled));
});

controls.addEventListener('start', () => { controls.autoRotate = false; syncRotateButton(); });

prefersReducedMotion.addEventListener('change', (event) => {
  if (event.matches) controls.autoRotate = false;
  syncRotateButton();
});
syncRotateButton();

requestAnimationFrame(() => {
  setTimeout(() => document.querySelector('#loading-screen').classList.add('hidden'), 350);
});

// Exposed only for development inspection; no objects are allocated in the render loop.
window.__RANRAN_MEADOW__ = { scene, camera, renderer, controls, ranran, butterfly, fireflies, setCameraPreset, measureCharacter };
