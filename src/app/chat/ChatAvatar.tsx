"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import type { Group } from "three";
import type { ChatMood } from "@/lib/chatPersonas";

type AvatarProps = {
  mood: ChatMood;
  speaking: boolean;
};

function moodColors(mood: ChatMood) {
  switch (mood) {
    case "cold":
      return { dress: "#4a5568", lip: "#c9a0a0", blush: 0.08 };
    case "curious":
      return { dress: "#6b4f7a", lip: "#d4a5a5", blush: 0.14 };
    case "warm":
      return { dress: "#8b3a62", lip: "#e8a0a8", blush: 0.22 };
    case "flirty":
      return { dress: "#a83256", lip: "#f0a0b0", blush: 0.32 };
    case "smitten":
      return { dress: "#c41e5a", lip: "#ffb0c0", blush: 0.42 };
    default:
      return { dress: "#5c4a6a", lip: "#d4a5a5", blush: 0.12 };
  }
}

function WomanBust({ mood, speaking }: AvatarProps) {
  const root = useRef<Group>(null);
  const mouth = useRef<Group>(null);
  const colors = moodColors(mood);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (root.current) {
      root.current.position.y = Math.sin(t * 1.1) * 0.04;
      root.current.rotation.y = Math.sin(t * 0.35) * 0.06;
    }
    if (mouth.current) {
      const target = speaking ? 0.11 + Math.sin(t * 18) * 0.03 : 0.025;
      mouth.current.scale.y += (target - mouth.current.scale.y) * 0.25;
    }
  });

  return (
    <group ref={root} position={[0, -0.35, 0]}>
      {/* shoulders / dress */}
      <mesh position={[0, -0.55, 0]} castShadow>
        <sphereGeometry args={[0.72, 32, 32]} />
        <meshStandardMaterial color={colors.dress} roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.95, 0.08]} castShadow>
        <cylinderGeometry args={[0.5, 0.62, 0.55, 32]} />
        <meshStandardMaterial color={colors.dress} roughness={0.5} />
      </mesh>

      {/* neck */}
      <mesh position={[0, 0.05, 0.02]} castShadow>
        <cylinderGeometry args={[0.11, 0.13, 0.18, 16]} />
        <meshStandardMaterial color="#f0c8b0" roughness={0.65} />
      </mesh>

      {/* head */}
      <mesh position={[0, 0.38, 0]} castShadow>
        <sphereGeometry args={[0.34, 32, 32]} />
        <meshStandardMaterial color="#f5d0bc" roughness={0.7} />
      </mesh>

      {/* hair back */}
      <mesh position={[0, 0.42, -0.12]} castShadow>
        <sphereGeometry args={[0.38, 24, 24]} />
        <meshStandardMaterial color="#2a1810" roughness={0.85} />
      </mesh>
      {/* hair sides */}
      <mesh position={[-0.28, 0.2, -0.02]} rotation={[0, 0, 0.25]} castShadow>
        <capsuleGeometry args={[0.09, 0.55, 8, 16]} />
        <meshStandardMaterial color="#2a1810" roughness={0.85} />
      </mesh>
      <mesh position={[0.28, 0.2, -0.02]} rotation={[0, 0, -0.25]} castShadow>
        <capsuleGeometry args={[0.09, 0.55, 8, 16]} />
        <meshStandardMaterial color="#2a1810" roughness={0.85} />
      </mesh>
      {/* bangs */}
      <mesh position={[0, 0.58, 0.18]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.42, 0.12, 0.14]} />
        <meshStandardMaterial color="#2a1810" roughness={0.85} />
      </mesh>

      {/* blush */}
      <mesh position={[-0.14, 0.32, 0.28]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial
          color="#ff8aa0"
          transparent
          opacity={colors.blush}
          roughness={1}
        />
      </mesh>
      <mesh position={[0.14, 0.32, 0.28]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial
          color="#ff8aa0"
          transparent
          opacity={colors.blush}
          roughness={1}
        />
      </mesh>

      {/* eyes */}
      <mesh position={[-0.11, 0.4, 0.28]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color="#2d1f14" roughness={0.3} />
      </mesh>
      <mesh position={[0.11, 0.4, 0.28]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color="#2d1f14" roughness={0.3} />
      </mesh>

      {/* mouth */}
      <group ref={mouth} position={[0, 0.24, 0.3]} scale={[1, 0.025, 1]}>
        <mesh>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color={colors.lip} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

export default function ChatAvatar({ mood, speaking }: AvatarProps) {
  return (
    <div className="chat-avatar-canvas-wrap">
      <Canvas
        shadows
        camera={{ position: [0, 0.15, 2.35], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#0d0b10"]} />
        <ambientLight intensity={0.45} />
        <spotLight
          position={[2.5, 3, 2]}
          angle={0.45}
          penumbra={0.6}
          intensity={2.2}
          castShadow
          color="#ffe8d0"
        />
        <pointLight position={[-2, 1.5, 1]} intensity={0.6} color="#c8a0ff" />
        <WomanBust mood={mood} speaking={speaking} />
        <Environment preset="city" />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 2.2}
          maxPolarAngle={Math.PI / 1.85}
          minAzimuthAngle={-0.35}
          maxAzimuthAngle={0.35}
        />
      </Canvas>
    </div>
  );
}
