import * as THREE from "three";

const VERTEX_SHADER = `
  varying vec2 vUv;
  varying float vDist;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vDist = length(worldPosition.xz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uDensity;
  uniform float uSpeed;
  uniform float uOpacity;
  uniform float uFadeStart;
  uniform float uFadeEnd;
  uniform vec3 uColor;

  varying vec2 vUv;
  varying float vDist;

  float gridLine(vec2 uv) {
    vec2 grid = abs(fract(uv - 0.5) - 0.5) / fwidth(uv);
    return 1.0 - min(min(grid.x, grid.y), 1.0);
  }

  void main() {
    vec2 scrolledUv = vUv * uDensity;
    scrolledUv.y -= uTime * uSpeed;

    float line = gridLine(scrolledUv);
    float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, vDist);
    float alpha = line * uOpacity * fade;

    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function createCyberGrid({
  size = 420,
  density = 48,
  color = new THREE.Color("#6D28D9"),
  opacity = 0.35,
  speed = 0.045,
  reducedMotion = false,
} = {}) {
  const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDensity: { value: density },
      uSpeed: { value: reducedMotion ? 0 : speed },
      uOpacity: { value: opacity },
      uFadeStart: { value: size * 0.12 },
      uFadeEnd: { value: size * 0.62 },
      uColor: { value: color },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -6;

  function update(time) {
    material.uniforms.uTime.value = time;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { mesh, update, dispose };
}
