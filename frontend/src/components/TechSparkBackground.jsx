import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createCyberGrid } from "../three/createCyberGrid.js";
import { createParticleField } from "../three/createParticleField.js";
import HUDRings from "./HUDRings.jsx";

export default function TechSparkBackground({ hidden = false }) {
  const canvasRef = useRef(null);
  const hiddenRef = useRef(hidden);

  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas.parentElement;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#050509", 0.012);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      500
    );
    camera.position.set(0, 4, 22);
    const basePosition = camera.position.clone();

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setClearColor(0x000000, 0);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(container.clientWidth, container.clientHeight);

    const isMobile = window.innerWidth < 768;
    const grid = createCyberGrid({ reducedMotion });
    const particles = createParticleField({
      count: isMobile ? 90 : 240,
      reducedMotion,
    });

    scene.add(grid.mesh);
    scene.add(particles.points);

    const mouse = { x: 0, y: 0 };
    const targetMouse = { x: 0, y: 0 };

    function handlePointerMove(event) {
      targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      targetMouse.y = (event.clientY / window.innerHeight) * 2 - 1;
    }

    function handleResize() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    let paused = document.hidden;
    function handleVisibilityChange() {
      paused = document.hidden;
    }

    if (!reducedMotion) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
    }
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let rafId;
    const clock = new THREE.Clock();

    function renderFrame() {
      const elapsed = clock.getElapsedTime();

      if (!reducedMotion) {
        mouse.x += (targetMouse.x - mouse.x) * 0.04;
        mouse.y += (targetMouse.y - mouse.y) * 0.04;

        camera.position.x = basePosition.x + mouse.x * 1.2;
        camera.position.y = basePosition.y - mouse.y * 0.6;
        camera.lookAt(0, 0, -10);

        grid.update(elapsed);
        particles.update(elapsed, mouse);
      }

      renderer.render(scene, camera);
    }

    function animate() {
      rafId = requestAnimationFrame(animate);
      if (paused || hiddenRef.current) return;
      renderFrame();
    }

    renderFrame();
    if (!reducedMotion) {
      animate();
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      grid.dispose();
      particles.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background transition-opacity duration-500 ${
        hidden ? "opacity-0" : "opacity-100"
      }`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute top-1/4 -right-32 h-[28rem] w-[28rem] rounded-full bg-accent/15 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-violet/20 blur-[130px]" />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[length:100%_3px] mix-blend-overlay" />

      <HUDRings
        size="sm"
        className="absolute left-6 top-24 hidden h-16 w-16 opacity-30 sm:block"
      />
      <HUDRings
        size="sm"
        spin={false}
        className="absolute bottom-24 right-6 hidden h-16 w-16 opacity-20 sm:block"
      />

      <span className="motion-safe:animate-twinkle absolute left-10 top-1/3 h-1 w-1 rounded-full bg-accent/70" />
      <span
        className="motion-safe:animate-twinkle absolute right-16 top-1/2 h-1 w-1 rounded-full bg-primary/70"
        style={{ animationDelay: "1.1s" }}
      />
      <span
        className="motion-safe:animate-twinkle absolute bottom-1/3 left-1/2 h-1 w-1 rounded-full bg-violet/70"
        style={{ animationDelay: "2s" }}
      />
    </div>
  );
}
