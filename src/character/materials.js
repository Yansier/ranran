import * as THREE from 'three';

function makeGradientMap() {
  const colors = new Uint8Array([92, 92, 92, 165, 165, 165, 225, 225, 225, 255, 255, 255]);
  const map = new THREE.DataTexture(colors, 4, 1, THREE.RedFormat);
  map.needsUpdate = true;
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestFilter;
  map.colorSpace = THREE.NoColorSpace;
  return map;
}

const gradientMap = makeGradientMap();

export function toon(color, options = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap, ...options });
}

export const palette = {
  skin: toon(0xffd9c8),
  skinShade: toon(0xefbba8),
  hair: toon(0xb97e5e),
  hairLight: toon(0xc8916d),
  hairDark: toon(0x7f4f3f),
  pink: toon(0xf38fad),
  pinkLight: toon(0xffbed0),
  pinkDark: toon(0xc95e84),
  lavender: toon(0xbda8df),
  black: toon(0x272632),
  blackSoft: toon(0x3b3544),
  white: toon(0xfffaf1),
  mint: toon(0x8ed7c4),
  burgundy: toon(0x7f3d50),
  eyeBlue: toon(0x48b9ec),
  eyeDark: toon(0x195b87),
  outline: toon(0x533f44),
  gold: toon(0xffd982)
};
