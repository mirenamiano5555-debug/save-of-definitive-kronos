import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  level: number;
  cotaSup: number | null;
  cotaInf: number | null;
}

interface Edge {
  from: string;
  to: string;
  type: string;
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

export default function HarrisDiagram2D({ jacimentId }: { jacimentId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    loadData();
  }, [jacimentId]);

  const loadData = async () => {
    const { data: ues } = await supabase
      .from("ues")
      .select("id, codi_ue, cobreix_a, cobert_per, talla, tallat_per, reomple_a, reomplert_per, cota_superior, cota_inferior")
      .eq("jaciment_id", jacimentId);

    if (!ues || ues.length === 0) return;

    const codeMap = new Map<string, string>();
    ues.forEach(ue => {
      const code = ue.codi_ue || ue.id.slice(0, 8);
      codeMap.set(code, ue.id);
    });

    const edgeList: Edge[] = [];
    const allCodes = ues.map(ue => ue.codi_ue || ue.id.slice(0, 8));

    // Build cota map
    const cotaMap = new Map<string, { sup: number | null; inf: number | null }>();
    ues.forEach(ue => {
      const code = ue.codi_ue || ue.id.slice(0, 8);
      cotaMap.set(code, {
        sup: (ue as any).cota_superior,
        inf: (ue as any).cota_inferior,
      });
    });

    for (const ue of ues) {
      const code = ue.codi_ue || ue.id.slice(0, 8);
      for (const rel of RELATION_FIELDS) {
        const targets = parseRelations((ue as any)[rel]);
        for (const t of targets) {
          if (allCodes.includes(t)) {
            edgeList.push({ from: code, to: t, type: rel });
          }
        }
      }
    }

    // Sort by cota - highest cota_superior at top, lowest cota_inferior at bottom
    // If no cota, fallback to topological sort
    const hasCota = ues.some(ue => (ue as any).cota_superior != null || (ue as any).cota_inferior != null);

    let nodeList: Node[];
    const nodeWidth = 120;

    if (hasCota) {
      // Get global min/max cota
      let globalMaxSup = -Infinity;
      let globalMinInf = Infinity;
      ues.forEach(ue => {
        const sup = (ue as any).cota_superior;
        const inf = (ue as any).cota_inferior;
        if (sup != null && sup > globalMaxSup) globalMaxSup = sup;
        if (inf != null && inf < globalMinInf) globalMinInf = inf;
        if (sup != null && sup < globalMinInf) globalMinInf = sup;
        if (inf != null && inf > globalMaxSup) globalMaxSup = inf;
      });

      if (globalMaxSup === -Infinity) globalMaxSup = 10;
      if (globalMinInf === Infinity) globalMinInf = 0;
      const range = globalMaxSup - globalMinInf || 1;
      const totalHeight = 500;

      // Sort UEs by average cota (descending = top)
      const sorted = [...ues].sort((a, b) => {
        const avgA = ((a as any).cota_superior ?? globalMaxSup) + ((a as any).cota_inferior ?? (a as any).cota_superior ?? globalMinInf);
        const avgB = ((b as any).cota_superior ?? globalMaxSup) + ((b as any).cota_inferior ?? (b as any).cota_superior ?? globalMinInf);
        return avgB - avgA;
      });

      // Group UEs at similar y positions to avoid overlap
      nodeList = sorted.map((ue, i) => {
        const code = ue.codi_ue || ue.id.slice(0, 8);
        const sup = (ue as any).cota_superior ?? globalMaxSup;
        const avgCota = ((sup) + ((ue as any).cota_inferior ?? sup)) / 2;
        const y = ((globalMaxSup - avgCota) / range) * totalHeight;
        const cota = cotaMap.get(code);
        return {
          id: code,
          label: `${code}\n${cota?.sup != null ? `↑${cota.sup}` : ""}${cota?.inf != null ? ` ↓${cota.inf}` : ""}`,
          x: (i % 5) * nodeWidth - (Math.min(sorted.length, 5) * nodeWidth) / 2 + nodeWidth / 2,
          y,
          level: 0,
          cotaSup: cota?.sup ?? null,
          cotaInf: cota?.inf ?? null,
        };
      });
    } else {
      // Fallback: topological sort
      const adjacency = new Map<string, Set<string>>();
      const inDegree = new Map<string, number>();
      allCodes.forEach(c => { adjacency.set(c, new Set()); inDegree.set(c, 0); });

      for (const edge of edgeList) {
        adjacency.get(edge.from)?.add(edge.to);
        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
      }

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

      const levelGroups = new Map<number, string[]>();
      for (const [code, level] of levels) {
        if (!levelGroups.has(level)) levelGroups.set(level, []);
        levelGroups.get(level)!.push(code);
      }

      nodeList = [];
      const levelHeight = 100;
      for (const [level, codes] of levelGroups) {
        const totalWidth = codes.length * nodeWidth;
        const startX = -totalWidth / 2 + nodeWidth / 2;
        codes.forEach((code, i) => {
          const cota = cotaMap.get(code);
          nodeList.push({
            id: code, label: code,
            x: startX + i * nodeWidth, y: level * levelHeight,
            level, cotaSup: cota?.sup ?? null, cotaInf: cota?.inf ?? null,
          });
        });
      }
    }

    setNodes(nodeList);
    setEdges(edgeList);
  };

  useEffect(() => { draw(); }, [nodes, edges, pan, zoom]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    ctx.fillStyle = "#f5f0e8";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 + pan.x, 40 + pan.y);
    ctx.scale(zoom, zoom);

    for (const edge of edges) {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      ctx.beginPath();
      ctx.strokeStyle = COLORS[edge.type] || "#888";
      ctx.lineWidth = 1.5;
      ctx.moveTo(fromNode.x, fromNode.y + 15);
      ctx.lineTo(toNode.x, toNode.y - 15);
      ctx.stroke();

      const angle = Math.atan2(toNode.y - 15 - (fromNode.y + 15), toNode.x - fromNode.x);
      const ax = toNode.x - 8 * Math.cos(angle);
      const ay = toNode.y - 15 - 8 * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(toNode.x, toNode.y - 15);
      ctx.lineTo(ax - 5 * Math.sin(angle), ay + 5 * Math.cos(angle));
      ctx.lineTo(ax + 5 * Math.sin(angle), ay - 5 * Math.cos(angle));
      ctx.fillStyle = COLORS[edge.type] || "#888";
      ctx.fill();
    }

    for (const node of nodes) {
      ctx.fillStyle = "#f5f0e8";
      ctx.strokeStyle = "#8b7355";
      ctx.lineWidth = 1.5;
      const bw = 90, bh = 34;
      ctx.beginPath();
      ctx.roundRect(node.x - bw / 2, node.y - bh / 2, bw, bh, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#3d2e1f";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Split label for cota display
      const lines = node.label.split("\n");
      if (lines.length > 1) {
        ctx.fillText(lines[0], node.x, node.y - 6);
        ctx.font = "8px sans-serif";
        ctx.fillStyle = "#6b5c4a";
        ctx.fillText(lines[1], node.x, node.y + 8);
      } else {
        ctx.fillText(node.label, node.x, node.y);
      }
    }

    ctx.restore();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
  };

  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No hi ha prou UEs amb relacions per generar el diagrama.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Cobreix</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" /> Talla</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" /> Reomple</span>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-[400px] border border-border rounded-lg cursor-grab active:cursor-grabbing"
        style={{ backgroundColor: "#f5f0e8" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsPanning(false)}
        onMouseLeave={() => setIsPanning(false)}
        onWheel={handleWheel}
      />
    </div>
  );
}
