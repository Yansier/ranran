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
const { scene, camera, renderer, controls, resetCamera } = createSceneSystem(container);
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
  ranran.userData.update?.(time);
  butterfly.userData.update?.(time);
  fireflies.userData.update?.(time);
  controls.update();
  renderer.render(scene, camera);
});

const resetButton = document.querySelector('#reset-camera');
const rotateButton = document.querySelector('#toggle-rotate');
const musicButton = document.querySelector('#toggle-music');
const ambient = createAmbientAudio();

resetButton.addEventListener('click', resetCamera);
rotateButton.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  rotateButton.classList.toggle('active', controls.autoRotate);
  rotateButton.setAttribute('aria-pressed', String(controls.autoRotate));
});
musicButton.addEventListener('click', () => {
  const enabled = ambient.toggle();
  musicButton.classList.toggle('active', enabled);
  musicButton.setAttribute('aria-pressed', String(enabled));
});

controls.addEventListener('start', () => { controls.autoRotate = false; rotateButton.classList.remove('active'); rotateButton.setAttribute('aria-pressed', 'false'); });

requestAnimationFrame(() => {
  setTimeout(() => document.querySelector('#loading-screen').classList.add('hidden'), 350);
});

// Exposed only for development inspection; no objects are allocated in the render loop.
window.__RANRAN_MEADOW__ = { scene, camera, renderer, controls, ranran };
