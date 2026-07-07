"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";

function ParallaxStars() {
  const groupRef = useRef<THREE.Group>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const scrollY = useRef(0);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      mouse.current.x = (event.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    const handleScroll = () => {
      scrollY.current = window.scrollY;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    const targetX = mouse.current.x * 0.15;
    const targetY = -mouse.current.y * 0.1 + scrollY.current * 0.0003;
    groupRef.current.rotation.y += (targetX - groupRef.current.rotation.y) * delta * 2;
    groupRef.current.rotation.x += (targetY - groupRef.current.rotation.x) * delta * 2;
  });

  return (
    <group ref={groupRef}>
      <Stars radius={100} depth={50} count={2200} factor={4} saturation={0} fade speed={0.5} />
    </group>
  );
}

export function SpaceBackgroundWebGL() {
  return (
    <div
      aria-hidden="true"
      data-nythera-space-webgl="true"
      className="nythera-cosmic-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{ background: "var(--gradient-aurora-ambient)", filter: "blur(60px)" }}
      />
      <Canvas
        data-nythera-r3f-canvas="true"
        className="absolute inset-0"
        camera={{ position: [0, 0, 1], fov: 75 }}
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: "low-power" }}
      >
        <Suspense fallback={null}>
          <ParallaxStars />
        </Suspense>
      </Canvas>
      <div className="nythera-cosmic-veil absolute inset-0" />
    </div>
  );
}
