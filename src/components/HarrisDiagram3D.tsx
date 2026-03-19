import { useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import { supabase } from "@/integrations/supabase/client";
import * as THREE from "three";

interface Node3D {
  id: string;
  label: string;
  position: [number, number, number];
}

interface Edge3D {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
}

const RELATION_FIELDS = ["cobreix_a", "talla", "reomple_a"];
const COLORS: Record<string, string> = {
  cobreix_a: "#3b82f6",
  talla: "#ef4444",
  reomple_a: "#22c55e",
};

function parseRelations(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

function UEBox({ position, label }: { position: [number, number, number]; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={position}>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[1.2, 0.4, 0.8]} />
        <meshStandardMaterial color={hovered ? "#f59e0b" : "#8b7355"} />
      </mesh>
      <Text
        position={[0, 0.35, 0]}
        fontSize={0.2}
        color="#3d2e1f"
        anchorX="center"
        anchorY="bottom"
      >
        {label}
      </Text>
    </group>
  );
}

function ConnectionLine({ start, end, color }: { start: [number, number, number]; end: [number, number, number]; color: string }) {
  return (
    <Line
      points={[start, end]}
      color={color}
      lineWidth={2}
    />
  );
}

export default function HarrisDiagram3D({ jacimentId }: { jacimentId: string }) {
  const [nodes, setNodes] = useState<Node3D[]>([]);
  const [edges, setEdges] = useState<Edge3D[]>([]);

  useEffect(() => {
    loadData();
  }, [jacimentId]);

  const loadData = async () => {
    const { data: ues } = await supabase
      .from("ues")
      .select("id, codi_ue, cobreix_a, cobert_per, talla, tallat_per, reomple_a, reomplert_per")
      .eq("jaciment_id", jacimentId);

    if (!ues || ues.length === 0) return;

    const allCodes = ues.map(ue => ue.codi_ue || ue.id.slice(0, 8));
    const adjacency = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    allCodes.forEach(c => { adjacency.set(c, new Set()); inDegree.set(c, 0); });

    const edgeData: { from: string; to: string; type: string }[] = [];

    for (const ue of ues) {
      const code = ue.codi_ue || ue.id.slice(0, 8);
      for (const rel of RELATION_FIELDS) {
        const targets = parseRelations((ue as any)[rel]);
        for (const t of targets) {
          if (allCodes.includes(t)) {
            edgeData.push({ from: code, to: t, type: rel });
            adjacency.get(code)?.add(t);
            inDegree.set(t, (inDegree.get(t) || 0) + 1);
          }
        }
      }
    }

    // Topological sort
    const levels = new Map<string, number>();
    const queue = allCodes.filter(c => (inDegree.get(c) || 0) === 0);
    queue.forEach(c => levels.set(c, 0));
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const currentLevel = levels.get(current) || 0;
      for (const neighbor of adjacency.get(current) || []) {
        const newLevel = currentLevel + 1;
        if (!levels.has(neighbor) || levels.get(neighbor)! < newLevel) levels.set(neighbor, newLevel);
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
        if ((inDegree.get(neighbor) || 0) <= 0) queue.push(neighbor);
      }
    }

    allCodes.forEach(c => { if (!levels.has(c)) levels.set(c, 0); });

    // Position nodes
    const levelGroups = new Map<number, string[]>();
    for (const [code, level] of levels) {
      if (!levelGroups.has(level)) levelGroups.set(level, []);
      levelGroups.get(level)!.push(code);
    }

    const nodeList: Node3D[] = [];
    const posMap = new Map<string, [number, number, number]>();

    for (const [level, codes] of levelGroups) {
      codes.forEach((code, i) => {
        const x = (i - (codes.length - 1) / 2) * 2;
        const y = -level * 1.5;
        const z = 0;
        const pos: [number, number, number] = [x, y, z];
        nodeList.push({ id: code, label: code, position: pos });
        posMap.set(code, pos);
      });
    }

    const edgeList: Edge3D[] = [];
    for (const e of edgeData) {
      const fromPos = posMap.get(e.from);
      const toPos = posMap.get(e.to);
      if (fromPos && toPos) {
        edgeList.push({ from: fromPos, to: toPos, color: COLORS[e.type] || "#888" });
      }
    }

    setNodes(nodeList);
    setEdges(edgeList);
  };

  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No hi ha prou UEs amb relacions per generar el diagrama 3D.</p>;
  }

  return (
    <div className="w-full h-[500px] border border-border rounded-lg overflow-hidden bg-card">
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <OrbitControls enableDamping />
        {nodes.map(node => (
          <UEBox key={node.id} position={node.position} label={node.label} />
        ))}
        {edges.map((edge, i) => (
          <ConnectionLine key={i} start={edge.from} end={edge.to} color={edge.color} />
        ))}
      </Canvas>
    </div>
  );
}
