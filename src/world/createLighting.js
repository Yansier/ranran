import * as THREE from 'three';

export function createLighting(scene) {
  const hemisphere = new THREE.HemisphereLight(0xfff8ea, 0x567c62, 2.0);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffe0b0, 3.15);
  sun.position.set(-6, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -7;
  sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7;
  sun.shadow.camera.bottom = -4;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 26;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0xa9d9ff, 1.45);
  rim.position.set(5, 5, -6);
  scene.add(rim);

  const faceFill = new THREE.PointLight(0xffd6dc, 1.25, 8, 2);
  faceFill.position.set(0, 4.2, 4.6);
  scene.add(faceFill);
}
