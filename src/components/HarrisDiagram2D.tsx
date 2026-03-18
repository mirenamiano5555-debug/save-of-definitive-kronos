import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  level: number;
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
      .select("id, codi_ue, cobreix_a, cobert_per, talla, tallat_per, reomple_a, reomplert_per")
      .eq("jaciment_id", jacimentId);

    if (!ues || ues.length === 0) return;

    const codeMap = new Map<string, string>();
    ues.forEach(ue => {
      const code = ue.codi_ue || ue.id.slice(0, 8);
      codeMap.set(code, ue.id);
    });

    const edgeList: Edge[] = [];
    const adjacency = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    const allCodes = ues.map(ue => ue.codi_ue || ue.id.slice(0, 8));
    allCodes.forEach(c => { adjacency.set(c, new Set()); inDegree.set(c, 0); });

    for (const ue of ues) {
      const code = ue.codi_ue || ue.id.slice(0, 8);
      for (const rel of RELATION_FIELDS) {
        const targets = parseRelations((ue as any)[rel]);
        for (const t of targets) {
          if (allCodes.includes(t)) {
            edgeList.push({ from: code, to: t, type: rel });
            adjacency.get(code)?.add(t);
            inDegree.set(t, (inDegree.get(t) || 0) + 1);
          }
        }
      }
    }

    // Topological sort for levels
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
        if (!levels.has(neighbor) || levels.get(neighbor)! < newLevel) {
          levels.set(neighbor, newLevel);
        }
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
        if ((inDegree.get(neighbor) || 0) <= 0) {
          queue.push(neighbor);
        }
      }
    }

    // Assign positions unvisited nodes too
    allCodes.forEach(c => { if (!levels.has(c)) levels.set(c, 0); });

    // Group by level
    const levelGroups = new Map<number, string[]>();
    for (const [code, level] of levels) {
      if (!levelGroups.has(level)) levelGroups.set(level, []);
      levelGroups.get(level)!.push(code);
    }

    const nodeList: Node[] = [];
    const nodeWidth = 120;
    const levelHeight = 100;

    for (const [level, codes] of levelGroups) {
      const totalWidth = codes.length * nodeWidth;
      const startX = -totalWidth / 2 + nodeWidth / 2;
      codes.forEach((code, i) => {
        nodeList.push({
          id: code,
          label: code,
          x: startX + i * nodeWidth,
          y: level * levelHeight,
          level,
        });
      });
    }

    setNodes(nodeList);
    setEdges(edgeList);
  };

  useEffect(() => {
    draw();
  }, [nodes, edges, pan, zoom]);

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
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 + pan.x, 40 + pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges
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

      // Arrow
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

    // Draw nodes
    for (const node of nodes) {
      ctx.fillStyle = "hsl(var(--card))";
      ctx.strokeStyle = "hsl(var(--border))";
      ctx.lineWidth = 1;
      const bw = 80, bh = 28;
      ctx.beginPath();
      ctx.roundRect(node.x - bw / 2, node.y - bh / 2, bw, bh, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "hsl(var(--foreground))";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, node.x, node.y);
    }

    ctx.restore();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
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
        className="w-full h-[400px] border border-border rounded-lg bg-card cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsPanning(false)}
        onMouseLeave={() => setIsPanning(false)}
        onWheel={handleWheel}
      />
    </div>
  );
}
