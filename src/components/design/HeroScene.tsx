"use client";
/**
 * HeroScene (Module 05 U-06, D-09): a slowly rotating wireframe "knowledge graph" — glowing topic nodes on a
 * sphere, edges between neighbours, orbiting code glyphs — brand-coloured and reacting subtly to the pointer.
 * Plain three.js through react-three-fiber (no drei) to stay inside the 250 KB gz 3D budget. Never SSR'd:
 * load through `HeroSceneLazy`, which also handles the WebP/SVG fallback and device gating.
 */
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const BRAND = new THREE.Color("#6366f1");
const BRAND2 = new THREE.Color("#22d3ee");
const GLYPHS = ["{ }", "[ ]", "< >", "λ", "O(n)", "→", "∑", "( )", "//", "≠", "∞", "&&"];

function fibonacciSphere(n: number, radius: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = phi * i;
    pts.push(new THREE.Vector3(Math.cos(t) * r * radius, y * radius, Math.sin(t) * r * radius));
  }
  return pts;
}

function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlyphTexture(text: string, color: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.font = "600 64px 'JetBrains Mono', ui-monospace, Menlo, monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = color; ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function Graph({ count = 42, radius = 2.1 }: { count?: number; radius?: number }) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  const { nodes, edges, glow } = useMemo(() => {
    const nodes = fibonacciSphere(count, radius);
    // jitter radius slightly so it reads as a graph, not a perfect ball
    nodes.forEach((p, i) => p.multiplyScalar(0.9 + ((i * 7919) % 23) / 115));
    const edgePos: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const near = nodes.map((p, j) => ({ j, d: p.distanceTo(nodes[i]) })).filter((x) => x.j !== i).sort((a, b) => a.d - b.d).slice(0, 3);
      for (const n of near) if (n.j > i) edgePos.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[n.j].x, nodes[n.j].y, nodes[n.j].z);
    }
    const edges = new Float32Array(edgePos);
    return { nodes, edges, glow: makeGlowTexture() };
  }, [count, radius]);

  const glyphs = useMemo(() => GLYPHS.map((g, i) => ({ tex: makeGlyphTexture(g, i % 2 ? "#22d3ee" : "#a5b4fc"), r: radius * (1.35 + (i % 3) * 0.18), speed: 0.08 + (i % 4) * 0.02, phase: (i / GLYPHS.length) * Math.PI * 2, tilt: ((i % 5) - 2) * 0.35 })), [radius]);
  const glyphRefs = useRef<THREE.Sprite[]>([]);

  const nodeColors = useMemo(() => nodes.map((_, i) => BRAND.clone().lerp(BRAND2, (i % 7) / 6)), [nodes]);
  const target = useRef({ x: 0, y: 0 });

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      target.current.x += ((pointer.y * -0.25) - target.current.x) * Math.min(1, dt * 2);
      target.current.y += ((pointer.x * 0.35) - target.current.y) * Math.min(1, dt * 2);
      group.current.rotation.x = target.current.x + Math.sin(t * 0.15) * 0.05;
      group.current.rotation.y = t * 0.09 + target.current.y;
    }
    if (inner.current) inner.current.rotation.y = -t * 0.04;
    glyphRefs.current.forEach((s, i) => {
      if (!s) return;
      const g = glyphs[i];
      const a = t * g.speed + g.phase;
      s.position.set(Math.cos(a) * g.r, Math.sin(a * 0.7 + g.tilt) * g.r * 0.45, Math.sin(a) * g.r);
      const m = s.material as THREE.SpriteMaterial;
      m.opacity = 0.55 + Math.sin(a * 2) * 0.25;
    });
  });

  return (
    <group ref={group}>
      <group ref={inner}>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[edges, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={BRAND} transparent opacity={0.28} />
        </lineSegments>
        {nodes.map((p, i) => (
          <group key={i} position={p}>
            <mesh>
              <sphereGeometry args={[0.045 + (i % 4) * 0.012, 12, 12]} />
              <meshBasicMaterial color={nodeColors[i]} />
            </mesh>
            <sprite scale={[0.42, 0.42, 1]}>
              <spriteMaterial map={glow} color={nodeColors[i]} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
            </sprite>
          </group>
        ))}
      </group>
      {glyphs.map((g, i) => (
        <sprite key={i} ref={(el) => { if (el) glyphRefs.current[i] = el; }} scale={[0.9, 0.45, 1]}>
          <spriteMaterial map={g.tex} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
  );
}

function Rig() {
  const { camera } = useThree();
  useMemo(() => { camera.position.set(0, 0.2, 6.2); camera.lookAt(0, 0, 0); }, [camera]);
  return null;
}

export default function HeroScene({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Canvas
      className={className}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 42, near: 0.1, far: 50 }}
      frameloop="always"
      style={{ background: "transparent" }}
    >
      <Rig />
      <ambientLight intensity={0.6} />
      <Graph count={compact ? 30 : 42} radius={compact ? 1.9 : 2.1} />
    </Canvas>
  );
}
