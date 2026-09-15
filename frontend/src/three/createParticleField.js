import * as THREE from "three";

const PALETTE = ["#FF6A00", "#00C8E8", "#6D28D9"];

export function createParticleField({
  count = 220,
  spread = { x: 70, y: 34, z: 110 },
  reducedMotion = false,
} = {}) {
  const positions = new Float32Array(count * 3);
  const basePositions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  const tmpColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * spread.x * 2;
    const y = Math.random() * spread.y - spread.y * 0.2;
    const z = (Math.random() - 0.5) * spread.z * 2;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    basePositions[i * 3] = x;
    basePositions[i * 3 + 1] = y;
    basePositions[i * 3 + 2] = z;

    tmpColor.set(PALETTE[i % PALETTE.length]);
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;

    sizes[i] = Math.random() * 1.6 + 0.6;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 1,
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);

  const positionAttr = geometry.getAttribute("position");
  const mouseTarget = { x: 0, y: 0 };

  function update(time, mouse = mouseTarget) {
    if (!reducedMotion) {
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const phase = phases[i];
        positionAttr.array[idx] = basePositions[idx] + Math.sin(time * 0.15 + phase) * 1.5;
        positionAttr.array[idx + 1] =
          basePositions[idx + 1] + Math.sin(time * 0.1 + phase * 1.7) * 1.2;
      }
      positionAttr.needsUpdate = true;
    }

    points.rotation.y = mouse.x * 0.04;
    points.position.x = mouse.x * 1.5;
    points.position.y = mouse.y * 0.8;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}
