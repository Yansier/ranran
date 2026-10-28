import * as THREE from 'three';

function wingGeometry(sign) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(sign * 0.16, 0.2, sign * 0.46, 0.28, sign * 0.42, 0.02);
  shape.bezierCurveTo(sign * 0.39, -0.18, sign * 0.12, -0.12, 0, 0);
  return new THREE.ShapeGeometry(shape, 12);
}

export function createMagicButterfly() {
  const root = new THREE.Group();
  root.name = 'MagicButterfly';
  root.position.set(-0.67, 3.22, 1.38);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x79eaff, toneMapped: false });
  const wingMat = new THREE.MeshBasicMaterial({ color: 0x83cbff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.1, 4, 8), coreMat);
  body.rotation.x = Math.PI / 2;
  root.add(body);
  const leftPivot = new THREE.Group();
  const rightPivot = new THREE.Group();
  leftPivot.add(new THREE.Mesh(wingGeometry(-1), wingMat));
  rightPivot.add(new THREE.Mesh(wingGeometry(1), wingMat));
  root.add(leftPivot, rightPivot);

  const light = new THREE.PointLight(0x6edcff, 2.8, 2.4, 2);
  root.add(light);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0x7ce5ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(0.75, 0.75, 0.75);
  root.add(glow);

  root.userData.update = (time) => {
    const flap = Math.sin(time * 11) * 0.72;
    leftPivot.rotation.y = flap;
    rightPivot.rotation.y = -flap;
    root.position.y = 3.22 + Math.sin(time * 2.1) * 0.09;
    root.position.x = -0.67 + Math.sin(time * 1.15) * 0.07;
    root.rotation.y = Math.sin(time * 0.65) * 0.22;
  };
  return root;
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.16, 'rgba(128,230,255,.95)');
  gradient.addColorStop(1, 'rgba(80,180,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createFireflies(count = 42) {
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  let seed = 1941;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 1.4 + random() * 6.5;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = 0.35 + random() * 2.2;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    phases[i] = random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xffedb0, size: 0.07, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geometry, material);
  points.userData.update = (time) => {
    const pos = geometry.attributes.position;
    for (let i = 0; i < count; i += 1) pos.array[i * 3 + 1] += Math.sin(time * 1.2 + phases[i]) * 0.0008;
    pos.needsUpdate = true;
    material.opacity = 0.55 + Math.sin(time * 1.7) * 0.18;
  };
  return points;
}
