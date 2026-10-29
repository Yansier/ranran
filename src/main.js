import * as THREE from 'three';
import './styles.css';
import { createSceneSystem } from './core/sceneSetup.js';
import { createAmbientAudio } from './core/ambientAudio.js';
import { createLighting } from './world/createLighting.js';
import { createSky } from './world/createSky.js';
import { createMeadow } from './world/createMeadow.js';
import { createCharacterManager } from './character/createCharacterManager.js';
import { createFireflies, createMagicButterfly } from './effects/createMagicButterfly.js';

const container = document.querySelector('#scene-container');
const { scene, camera, renderer, controls, resetCamera, prefersReducedMotion } = createSceneSystem(container);
createLighting(scene);
scene.add(createSky());

const meadow = createMeadow();
const characterManager = createCharacterManager();
const butterfly = createMagicButterfly();
const fireflies = createFireflies();
scene.add(meadow, characterManager.root, butterfly, fireflies);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const time = clock.getElapsedTime();
  const motionScale = prefersReducedMotion.matches ? 0.2 : 1;
  characterManager.update(time, motionScale);
  butterfly.userData.update?.(time, motionScale);
  fireflies.userData.update?.(time, motionScale);
  controls.update();
  renderer.render(scene, camera);
});

const resetButton = document.querySelector('#reset-camera');
const rotateButton = document.querySelector('#toggle-rotate');
const musicButton = document.querySelector('#toggle-music');
const localModelButton = document.querySelector('#load-local-model');
const proceduralButton = document.querySelector('#use-procedural-model');
const localModelInput = document.querySelector('#local-model-input');
const modelStatus = document.querySelector('#model-status');
const ambient = createAmbientAudio();

function syncRotateButton() {
  rotateButton.classList.toggle('active', controls.autoRotate);
  rotateButton.setAttribute('aria-pressed', String(controls.autoRotate));
}

function setCameraPreset(name = 'hero') {
  const presets = {
    hero: { position: [6.8, 5.2, 9.0], target: [0, 2.45, 0.1] },
    front: { position: [0, 2.8, 9.4], target: [0, 2.4, 0.05] },
    side: { position: [9.4, 2.8, 0.05], target: [0, 2.4, 0.05] },
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
  const metrics = characterManager.measure();
  if (metrics.mode !== 'procedural') return metrics;
  const face = characterManager.active.getObjectByName('Ranran_FaceVolume');
  const faceSize = new THREE.Box3().setFromObject(face).getSize(new THREE.Vector3());
  return { ...metrics, headHeight: faceSize.y, headRatio: metrics.height / faceSize.y };
}

function showModelStatus(message, state = 'ready') {
  modelStatus.textContent = message;
  modelStatus.dataset.state = state;
  modelStatus.hidden = false;
}

async function loadLocalModel(file) {
  showModelStatus('正在读取本地 GLB…', 'loading');
  localModelButton.disabled = true;
  try {
    const details = await characterManager.loadLocalGLB(file);
    proceduralButton.hidden = false;
    document.querySelector('.character-note small').textContent = '本地模型 · 站立预览';
    showModelStatus(`本地模型已载入 · ${details.meshCount} 个网格`, 'success');
    setCameraPreset('front');
    return details;
  } catch (error) {
    console.error('Local GLB load failed:', error);
    showModelStatus(`载入失败：${error.message}`, 'error');
    throw error;
  } finally {
    localModelButton.disabled = false;
    localModelInput.value = '';
  }
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
localModelButton.addEventListener('click', () => localModelInput.click());
localModelInput.addEventListener('change', () => {
  const [file] = localModelInput.files;
  if (file) loadLocalModel(file).catch(() => {});
});
proceduralButton.addEventListener('click', () => {
  characterManager.useProcedural();
  proceduralButton.hidden = true;
  document.querySelector('.character-note small').textContent = '正在追逐魔法蝴蝶';
  showModelStatus('已切回程序化角色', 'ready');
  setCameraPreset('hero');
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
window.__RANRAN_MEADOW__ = {
  scene,
  camera,
  renderer,
  controls,
  ranran: characterManager.root,
  characterManager,
  butterfly,
  fireflies,
  setCameraPreset,
  measureCharacter,
  loadLocalModel,
  useProceduralCharacter: () => characterManager.useProcedural()
};
