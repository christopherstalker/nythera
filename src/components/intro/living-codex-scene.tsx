"use client";

import { Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

const INTRO_SECONDS = 2.25;
const PAGE_COUNT = 8;
const GLYPH_COUNT = 18;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smoothStep(start: number, end: number, value: number) {
  const progress = clamp01((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
}

function easeOutBack(value: number) {
  const progress = clamp01(value);
  const overshoot = 1.34;
  return 1 + (overshoot + 1) * Math.pow(progress - 1, 3) + overshoot * Math.pow(progress - 1, 2);
}

function LivingCodexWorld() {
  const bookRef = useRef<THREE.Group>(null);
  const leftCoverRef = useRef<THREE.Group>(null);
  const pageRefs = useRef<Array<THREE.Group | null>>([]);
  const haloRef = useRef<THREE.Group>(null);
  const glyphRef = useRef<THREE.Group>(null);
  const fragmentsRef = useRef<THREE.Group>(null);
  const portalRef = useRef<THREE.Group>(null);
  const portalCoreRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock, camera, size }) => {
    const elapsed = Math.min(clock.getElapsedTime(), INTRO_SECONDS);
    const summon = smoothStep(0.02, 0.46, elapsed);
    const open = smoothStep(0.34, 1.08, elapsed);
    const interfaceReveal = smoothStep(0.94, 1.5, elapsed);
    const portal = smoothStep(1.24, 1.72, elapsed);
    const dive = smoothStep(1.68, INTRO_SECONDS, elapsed);
    const aspect = size.width / Math.max(size.height, 1);
    const portraitFactor = clamp01((0.92 - aspect) / 0.5);
    const openScale = THREE.MathUtils.lerp(0.92, 0.64, portraitFactor);
    const cameraStart = THREE.MathUtils.lerp(5.7, 7.25, portraitFactor);

    if (bookRef.current) {
      const scale =
        THREE.MathUtils.lerp(openScale * 0.34, openScale, easeOutBack(summon)) +
        dive * THREE.MathUtils.lerp(0.32, 0.42, portraitFactor);
      bookRef.current.visible = summon > 0.001;
      bookRef.current.scale.setScalar(scale);
      bookRef.current.position.set(
        THREE.MathUtils.lerp(0.32, 0, summon),
        THREE.MathUtils.lerp(-0.42, 0.08, summon) + dive * 0.1,
        dive * 0.92
      );
      bookRef.current.rotation.set(
        THREE.MathUtils.lerp(-0.34, -0.06, open),
        THREE.MathUtils.lerp(0.58, 0.025, open),
        THREE.MathUtils.lerp(-0.18, 0, summon)
      );
    }

    if (leftCoverRef.current) {
      leftCoverRef.current.rotation.y = THREE.MathUtils.lerp(-Math.PI + 0.025, -0.08, open);
    }

    pageRefs.current.forEach((page, index) => {
      if (!page) {
        return;
      }

      const pageTurn = smoothStep(0.5 + index * 0.065, 1.02 + index * 0.065, elapsed);
      page.rotation.y = THREE.MathUtils.lerp(0.012 + index * 0.006, -Math.PI + 0.055, pageTurn);
      page.position.z = 0.065 + index * 0.008 + Math.sin(pageTurn * Math.PI) * 0.14;
      page.rotation.z = Math.sin(pageTurn * Math.PI) * (0.025 + index * 0.002);
    });

    if (haloRef.current) {
      const haloScale = THREE.MathUtils.lerp(0.18, 1, easeOutBack(summon)) + portal * 0.18 + dive * 1.1;
      haloRef.current.visible = summon > 0.001;
      haloRef.current.scale.setScalar(haloScale);
      haloRef.current.rotation.z = elapsed * 0.32 + interfaceReveal * 0.22;
      haloRef.current.rotation.x = THREE.MathUtils.lerp(0.26, 0.02, open);
      haloRef.current.position.z = THREE.MathUtils.lerp(-0.6, 0.02, portal);
    }

    if (glyphRef.current) {
      glyphRef.current.rotation.z = -elapsed * 0.5;
      glyphRef.current.children.forEach((glyph, index) => {
        const glyphReveal = smoothStep(0.04 + index * 0.018, 0.35 + index * 0.018, elapsed);
        glyph.visible = glyphReveal > 0.001;
        glyph.scale.setScalar(THREE.MathUtils.lerp(0.05, 1, easeOutBack(glyphReveal)));
        glyph.position.z = Math.sin(elapsed * 2.4 + index) * 0.06 + portal * 0.12;
      });
    }

    if (fragmentsRef.current) {
      const fragmentScale = THREE.MathUtils.lerp(0.02, 1, easeOutBack(interfaceReveal));
      const responsiveFragmentScale = THREE.MathUtils.lerp(1, 0.58, portraitFactor);
      fragmentsRef.current.visible = interfaceReveal > 0.001;
      fragmentsRef.current.scale.setScalar((fragmentScale + dive * 0.34) * responsiveFragmentScale);
      fragmentsRef.current.position.z = 0.26 + interfaceReveal * 0.26 + dive * 0.82;
      fragmentsRef.current.rotation.z = Math.sin(elapsed * 1.4) * 0.018;
    }

    if (portalRef.current) {
      const portalScale = THREE.MathUtils.lerp(0.04, 1, easeOutBack(portal)) + dive * 1.75;
      portalRef.current.visible = portal > 0.001;
      portalRef.current.scale.setScalar(portalScale);
      portalRef.current.rotation.z = elapsed * -0.72;
      portalRef.current.position.z = 0.3 + dive * 1.3;
    }

    if (portalCoreRef.current) {
      const material = portalCoreRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = THREE.MathUtils.lerp(0, 0.24, portal) + dive * 0.3;
    }

    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    perspectiveCamera.position.x = THREE.MathUtils.lerp(0.5, -0.18, open) * (1 - dive);
    perspectiveCamera.position.y =
      THREE.MathUtils.lerp(0.38, 0.08, open) + Math.sin(open * Math.PI) * 0.16 - dive * 0.03;
    perspectiveCamera.position.z = THREE.MathUtils.lerp(cameraStart, 1.2, dive);
    perspectiveCamera.fov = THREE.MathUtils.lerp(39, 54, dive);
    perspectiveCamera.updateProjectionMatrix();
    perspectiveCamera.lookAt(0, 0.04, 0.28 + dive * 1.2);
  });

  return (
    <>
      <RitualHalo haloRef={haloRef} glyphRef={glyphRef} />

      <group ref={bookRef}>
        <BookCover side="right" />
        <PageSurface side="left" />
        <PageSurface side="right" />

        {Array.from({ length: PAGE_COUNT }).map((_, index) => (
          <TurningPage
            key={index}
            index={index}
            pageRef={(page) => {
              pageRefs.current[index] = page;
            }}
          />
        ))}

        <group ref={leftCoverRef}>
          <BookCover side="left" />
        </group>

        <mesh position={[0, 0, -0.035]}>
          <boxGeometry args={[0.11, 2.34, 0.15]} />
          <meshStandardMaterial color="#9b8053" roughness={0.38} metalness={0.42} emissive="#2e2111" emissiveIntensity={0.8} />
        </mesh>
      </group>

      <InterfaceFragments fragmentsRef={fragmentsRef} />
      <CodexPortal portalRef={portalRef} coreRef={portalCoreRef} />
    </>
  );
}

function RitualHalo({
  haloRef,
  glyphRef
}: {
  haloRef: React.RefObject<THREE.Group>;
  glyphRef: React.RefObject<THREE.Group>;
}) {
  return (
    <group ref={haloRef} position={[0, 0.02, -0.5]}>
      <mesh>
        <torusGeometry args={[2.08, 0.018, 8, 96]} />
        <meshBasicMaterial color="#9a87ed" transparent opacity={0.72} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 7]}>
        <torusGeometry args={[1.78, 0.012, 8, 96]} />
        <meshBasicMaterial color="#8ff0ca" transparent opacity={0.64} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 9]}>
        <ringGeometry args={[2.28, 2.3, 96]} />
        <meshBasicMaterial color="#d6b875" transparent opacity={0.3} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      <group ref={glyphRef}>
        {Array.from({ length: GLYPH_COUNT }).map((_, index) => {
          const angle = (index / GLYPH_COUNT) * Math.PI * 2;
          const radius = index % 2 === 0 ? 2.34 : 1.93;
          return (
            <group
              key={index}
              position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]}
              rotation={[0, 0, angle + Math.PI / 2]}
            >
              <mesh>
                {index % 3 === 0 ? <octahedronGeometry args={[0.07, 0]} /> : <boxGeometry args={[0.14, 0.025, 0.025]} />}
                <meshBasicMaterial
                  color={index % 2 === 0 ? "#a8f3d4" : "#c8a8ff"}
                  transparent
                  opacity={0.82}
                  toneMapped={false}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function BookCover({ side }: { side: "left" | "right" }) {
  const direction = side === "left" ? -1 : 1;

  return (
    <group position={[0, 0, -0.085]}>
      <mesh position={[direction * 0.84, 0, 0]}>
        <boxGeometry args={[1.68, 2.38, 0.14]} />
        <meshPhysicalMaterial
          color="#241c2f"
          roughness={0.3}
          metalness={0.34}
          clearcoat={0.72}
          clearcoatRoughness={0.28}
          emissive="#3f2761"
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh position={[direction * 0.84, 0, 0.075]}>
        <planeGeometry args={[1.5, 2.18]} />
        <meshBasicMaterial color="#c7a867" transparent opacity={0.3} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[direction * 0.84, 0, 0.078]}>
        <ringGeometry args={[0.34, 0.37, 6]} />
        <meshBasicMaterial color="#9deacb" transparent opacity={0.62} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

function PageSurface({ side }: { side: "left" | "right" }) {
  const direction = side === "left" ? -1 : 1;

  return (
    <group>
      {Array.from({ length: 5 }).map((_, index) => (
        <mesh key={index} position={[direction * (0.79 + index * 0.006), 0, -0.01 + index * 0.012]}>
          <boxGeometry args={[1.54, 2.22, 0.018]} />
          <meshStandardMaterial
            color={index === 4 ? "#f1e5c9" : "#c9b997"}
            roughness={0.82}
            emissive={index === 4 ? "#765d38" : "#2d2418"}
            emissiveIntensity={index === 4 ? 0.2 : 0.06}
          />
        </mesh>
      ))}
      <PageInterface side={side} z={0.064} />
    </group>
  );
}

function TurningPage({
  index,
  pageRef
}: {
  index: number;
  pageRef: (page: THREE.Group | null) => void;
}) {
  return (
    <group ref={pageRef} position={[0, 0, 0.065 + index * 0.008]}>
      <mesh position={[0.77, 0, 0]}>
        <boxGeometry args={[1.5, 2.16, 0.012]} />
        <meshStandardMaterial
          color={index % 2 === 0 ? "#eadcbc" : "#d8c8a8"}
          roughness={0.9}
          emissive="#6f5732"
          emissiveIntensity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>
      {index % 2 === 0 ? (
        <group position={[0.78, 0, 0.012]}>
          <mesh position={[0.06, 0.5, 0]}>
            <boxGeometry args={[0.82, 0.014, 0.006]} />
            <meshBasicMaterial color="#8b75d6" toneMapped={false} />
          </mesh>
          <mesh position={[0.14, 0.27, 0]}>
            <boxGeometry args={[0.98, 0.01, 0.006]} />
            <meshBasicMaterial color="#6e6758" />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function PageInterface({ side, z }: { side: "left" | "right"; z: number }) {
  const direction = side === "left" ? -1 : 1;
  const x = direction * 0.79;

  return (
    <group position={[x, 0, z]}>
      <mesh position={[direction * -0.13, 0.72, 0]}>
        <boxGeometry args={[0.88, 0.028, 0.012]} />
        <meshBasicMaterial color="#91edc7" toneMapped={false} />
      </mesh>
      <mesh position={[direction * -0.02, 0.49, 0]}>
        <boxGeometry args={[1.08, 0.018, 0.01]} />
        <meshBasicMaterial color="#917ce6" toneMapped={false} />
      </mesh>
      {Array.from({ length: 5 }).map((_, index) => (
        <mesh key={index} position={[direction * -0.01, 0.2 - index * 0.19, 0]}>
          <boxGeometry args={[1.08 - index * 0.08, 0.012, 0.008]} />
          <meshBasicMaterial color={index % 2 === 0 ? "#756b59" : "#4f493f"} />
        </mesh>
      ))}
      <mesh position={[direction * 0.29, -0.73, 0]}>
        <boxGeometry args={[0.52, 0.13, 0.012]} />
        <meshBasicMaterial color="#8a70c7" transparent opacity={0.72} toneMapped={false} />
      </mesh>
    </group>
  );
}

function InterfaceFragments({ fragmentsRef }: { fragmentsRef: React.RefObject<THREE.Group> }) {
  return (
    <group ref={fragmentsRef} visible={false}>
      <FloatingPanel position={[-2.22, 0.82, 0]} rotation={[0, 0.22, -0.08]} accent="#9cebc9" />
      <FloatingPanel position={[2.16, 0.64, 0.05]} rotation={[0, -0.2, 0.07]} accent="#a58bea" mirrored />
      <FloatingPanel position={[-1.72, -1.18, -0.06]} rotation={[0, 0.14, 0.08]} accent="#c5a96b" compact />
      <FloatingPanel position={[1.82, -1.24, 0.02]} rotation={[0, -0.15, -0.07]} accent="#8edcbc" compact mirrored />
    </group>
  );
}

function FloatingPanel({
  position,
  rotation,
  accent,
  compact = false,
  mirrored = false
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  accent: string;
  compact?: boolean;
  mirrored?: boolean;
}) {
  const width = compact ? 1.12 : 1.42;
  const height = compact ? 0.48 : 0.66;
  const direction = mirrored ? -1 : 1;

  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[width, height, 0.025]} />
        <meshPhysicalMaterial
          color="#241d34"
          transparent
          opacity={0.76}
          roughness={0.28}
          metalness={0.18}
          transmission={0.08}
          emissive="#392451"
          emissiveIntensity={0.35}
        />
      </mesh>
      <mesh position={[direction * -width * 0.16, height * 0.18, 0.025]}>
        <boxGeometry args={[width * 0.48, 0.025, 0.012]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh position={[direction * -width * 0.06, 0, 0.025]}>
        <boxGeometry args={[width * 0.67, 0.012, 0.01]} />
        <meshBasicMaterial color="#d7c9ac" transparent opacity={0.74} />
      </mesh>
      <mesh position={[direction * width * 0.13, -height * 0.18, 0.025]}>
        <boxGeometry args={[width * 0.28, 0.07, 0.01]} />
        <meshBasicMaterial color={accent} transparent opacity={0.48} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CodexPortal({
  portalRef,
  coreRef
}: {
  portalRef: React.RefObject<THREE.Group>;
  coreRef: React.RefObject<THREE.Mesh>;
}) {
  return (
    <group ref={portalRef} visible={false} position={[0, 0.04, 0.3]} renderOrder={50}>
      <mesh renderOrder={50}>
        <torusGeometry args={[0.46, 0.045, 12, 72]} />
        <meshBasicMaterial color="#a8f4d5" transparent opacity={0.9} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]} renderOrder={50}>
        <torusGeometry args={[0.58, 0.012, 8, 72]} />
        <meshBasicMaterial color="#b197ff" transparent opacity={0.76} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh ref={coreRef} renderOrder={49}>
        <circleGeometry args={[0.43, 64]} />
        <meshBasicMaterial
          color="#bff8e3"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 3]} renderOrder={51}>
        <ringGeometry args={[0.29, 0.33, 48, 1, 0, Math.PI * 1.42]} />
        <meshBasicMaterial color="#f0cfff" transparent opacity={0.9} depthTest={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 5]} renderOrder={51}>
        <ringGeometry args={[0.2, 0.225, 48, 1, 0, Math.PI * 1.18]} />
        <meshBasicMaterial color="#d9b66b" transparent opacity={0.8} depthTest={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh rotation={[0.5, 0.35, 0.1]} renderOrder={52}>
        <octahedronGeometry args={[0.14, 0]} />
        <meshBasicMaterial color="#effff8" depthTest={false} toneMapped={false} />
      </mesh>
      <pointLight intensity={14} distance={4.8} color="#aaf8db" />
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle) * 0.72, Math.sin(angle) * 0.72, 0]} renderOrder={50}>
            <octahedronGeometry args={[0.045, 0]} />
            <meshBasicMaterial
              color={index % 2 === 0 ? "#a9f2d4" : "#b899ff"}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function CinematicEnvironment() {
  const { size } = useThree();
  const compact = size.width < 620;

  return (
    <>
      <color attach="background" args={["#120f22"]} />
      <fog attach="fog" args={["#171128", 5.8, 14]} />
      <mesh position={[0, 0, -3.7]}>
        <planeGeometry args={[24, 16]} />
        <meshBasicMaterial color="#1b1433" />
      </mesh>
      <mesh position={[-3.8, 2.1, -3.4]}>
        <circleGeometry args={[3.7, 64]} />
        <meshBasicMaterial color="#39236a" transparent opacity={0.34} />
      </mesh>
      <mesh position={[3.9, -1.7, -3.2]}>
        <circleGeometry args={[3.2, 64]} />
        <meshBasicMaterial color="#174f46" transparent opacity={0.28} />
      </mesh>
      <ambientLight intensity={1.18} color="#f4e6cf" />
      <directionalLight position={[3.8, 4.8, 5.5]} intensity={3.4} color="#ffe7b2" />
      <pointLight position={[-3.4, 1.6, 2.8]} intensity={compact ? 20 : 28} distance={9} color="#9a77ff" />
      <pointLight position={[3.2, -0.6, 2.6]} intensity={compact ? 17 : 24} distance={8} color="#72e8bd" />
      <pointLight position={[0, 0, 2.4]} intensity={compact ? 12 : 18} distance={7} color="#ffd88d" />
      <Sparkles
        count={compact ? 46 : 92}
        scale={compact ? [5, 7.8, 3] : [8, 5, 3.4]}
        size={compact ? 2.2 : 2.8}
        speed={0.48}
        opacity={0.78}
        color="#f0ddbd"
      />
    </>
  );
}

export function LivingCodexScene({ onReady }: { onReady: () => void }) {
  return (
    <Canvas
      data-living-codex-canvas="true"
      camera={{ position: [0.5, 0.38, 5.7], fov: 39 }}
      dpr={[1, 1.55]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      onCreated={onReady}
    >
      <CinematicEnvironment />
      <LivingCodexWorld />
    </Canvas>
  );
}
