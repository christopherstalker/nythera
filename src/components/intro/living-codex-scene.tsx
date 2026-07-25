"use client";

import { Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

const INTRO_SECONDS = 2.2;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smoothStep(start: number, end: number, value: number) {
  const progress = clamp01((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
}

function CodexBook() {
  const bookRef = useRef<THREE.Group>(null);
  const leftCoverRef = useRef<THREE.Group>(null);
  const leftPagesRef = useRef<THREE.Group>(null);
  const rulesRef = useRef<THREE.Group>(null);

  useFrame(({ clock, camera, size }) => {
    const elapsed = Math.min(clock.getElapsedTime(), INTRO_SECONDS);
    const reveal = smoothStep(0.02, 0.38, elapsed);
    const open = smoothStep(0.34, 1.34, elapsed);
    const transform = smoothStep(1.26, 1.9, elapsed);
    const passage = smoothStep(1.78, INTRO_SECONDS, elapsed);
    const aspect = size.width / Math.max(size.height, 1);
    const portraitFactor = clamp01((0.9 - aspect) / 0.45);
    const openScale = THREE.MathUtils.lerp(0.95, 0.62, portraitFactor);
    const cameraStart = THREE.MathUtils.lerp(5.1, 6.8, portraitFactor);
    const cameraEnd = THREE.MathUtils.lerp(3.15, 3.55, portraitFactor);

    if (bookRef.current) {
      const scale =
        THREE.MathUtils.lerp(openScale * 0.56, openScale, reveal) +
        passage * THREE.MathUtils.lerp(0.24, 0.36, portraitFactor);
      bookRef.current.scale.setScalar(scale);
      bookRef.current.position.y = THREE.MathUtils.lerp(-0.22, 0.04, reveal) + passage * 0.08;
      bookRef.current.position.z = passage * 0.68;
      bookRef.current.rotation.x = THREE.MathUtils.lerp(-0.18, -0.08, open);
      bookRef.current.rotation.y = THREE.MathUtils.lerp(0.42, 0.03, open);
      bookRef.current.rotation.z = THREE.MathUtils.lerp(-0.08, 0, open);
    }

    if (leftCoverRef.current) {
      leftCoverRef.current.rotation.y = THREE.MathUtils.lerp(-Math.PI + 0.035, -0.075, open);
    }

    if (leftPagesRef.current) {
      leftPagesRef.current.rotation.y = THREE.MathUtils.lerp(-Math.PI + 0.055, -0.035, smoothStep(0.5, 1.46, elapsed));
    }

    if (rulesRef.current) {
      rulesRef.current.scale.x = THREE.MathUtils.lerp(0.3, 1, transform);
      rulesRef.current.position.z = 0.054 + transform * 0.018;
    }

    camera.position.z = THREE.MathUtils.lerp(cameraStart, cameraEnd, passage);
    camera.position.y = THREE.MathUtils.lerp(0.22, 0.05, passage);
    camera.lookAt(0, 0, passage * 0.4);
  });

  return (
    <group ref={bookRef}>
      <group ref={leftCoverRef}>
        <BookCover x={-0.82} />
      </group>

      <group>
        <BookCover x={0.82} />
      </group>

      <group ref={leftPagesRef}>
        <Page x={-0.785} side="left" />
      </group>

      <Page x={0.785} side="right" rulesRef={rulesRef} />

      <mesh position={[0, 0, -0.035]}>
        <boxGeometry args={[0.095, 2.28, 0.12]} />
        <meshStandardMaterial color="#75684f" roughness={0.58} metalness={0.16} />
      </mesh>
    </group>
  );
}

function BookCover({ x }: { x: number }) {
  return (
    <group position={[0, 0, -0.075]}>
      <mesh position={[x, 0, 0]}>
        <boxGeometry args={[1.64, 2.32, 0.12]} />
        <meshPhysicalMaterial
          color="#17140f"
          roughness={0.36}
          metalness={0.22}
          clearcoat={0.42}
          clearcoatRoughness={0.52}
        />
      </mesh>
      <mesh position={[x, 0, 0.066]}>
        <planeGeometry args={[1.48, 2.14]} />
        <meshBasicMaterial color="#887b60" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Page({
  x,
  side,
  rulesRef
}: {
  x: number;
  side: "left" | "right";
  rulesRef?: React.RefObject<THREE.Group>;
}) {
  const direction = side === "left" ? -1 : 1;

  return (
    <group>
      {Array.from({ length: 5 }).map((_, index) => (
        <mesh key={index} position={[x + direction * index * 0.006, 0, -0.008 + index * 0.009]}>
          <boxGeometry args={[1.52, 2.18, 0.018]} />
          <meshStandardMaterial color={index === 4 ? "#d9ceb6" : "#b9ae95"} roughness={0.9} />
        </mesh>
      ))}

      <group ref={rulesRef} position={[x, 0, 0.054]}>
        <mesh position={[direction * -0.19, 0.7, 0]}>
          <boxGeometry args={[0.78, 0.022, 0.012]} />
          <meshBasicMaterial color="#94d8c0" />
        </mesh>
        <mesh position={[direction * -0.06, 0.5, 0]}>
          <boxGeometry args={[1.04, 0.015, 0.01]} />
          <meshBasicMaterial color="#7669a8" />
        </mesh>
        {Array.from({ length: 5 }).map((_, index) => (
          <mesh key={index} position={[direction * -0.02, 0.22 - index * 0.2, 0]}>
            <boxGeometry args={[1.12 - index * 0.09, 0.012, 0.009]} />
            <meshBasicMaterial color={index % 2 === 0 ? "#7f7766" : "#625b4e"} />
          </mesh>
        ))}
        <mesh position={[direction * 0.29, -0.72, 0]}>
          <boxGeometry args={[0.52, 0.12, 0.012]} />
          <meshBasicMaterial color="#7a6b9f" transparent opacity={0.62} />
        </mesh>
      </group>
    </group>
  );
}

export function LivingCodexScene() {
  return (
    <Canvas
      data-living-codex-canvas="true"
      camera={{ position: [0, 0.22, 5.1], fov: 38 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
    >
      <color attach="background" args={["#080907"]} />
      <fog attach="fog" args={["#080907", 4.4, 8]} />
      <ambientLight intensity={0.72} />
      <directionalLight position={[3.5, 4, 5]} intensity={2.4} color="#efe2c6" />
      <pointLight position={[-2.4, 0.8, 2.8]} intensity={18} distance={7} color="#8b7bdd" />
      <pointLight position={[2.4, -0.6, 2.5]} intensity={13} distance={6} color="#8de1c2" />
      <Sparkles count={44} scale={[5.5, 3.4, 2.8]} size={1.7} speed={0.32} opacity={0.48} color="#d9ceb6" />
      <CodexBook />
    </Canvas>
  );
}
