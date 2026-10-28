import * as THREE from 'three';

export function createSky() {
  const geometry = new THREE.SphereGeometry(40, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x94cbd2) },
      middleColor: { value: new THREE.Color(0xf6ddd1) },
      bottomColor: { value: new THREE.Color(0xffe8cd) },
      offset: { value: 4.0 }
    },
    vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 worldPosition = modelMatrix * vec4(position, 1.0); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 middleColor; uniform vec3 bottomColor; uniform float offset; varying vec3 vWorldPosition; void main(){ float h = normalize(vWorldPosition + vec3(0., offset, 0.)).y; vec3 col = mix(bottomColor, middleColor, smoothstep(-.22,.18,h)); col = mix(col, topColor, smoothstep(.1,.82,h)); gl_FragColor = vec4(col,1.); }`
  });
  return new THREE.Mesh(geometry, material);
}
