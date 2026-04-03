import { useState, useEffect, useRef, useCallback } from "react";
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

const RELATION_LATER = ["cobreix_a", "talla", "reomple_a"];
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

  useEffect(() => { loadData(); }, [jacimentId]);

  const loadData = async () => {
    const { data: ues } = await supabase
      .from("ues")
      .select("id, codi_ue, cobreix_a, cobert_per, talla, tallat_per, reomple_a, reomplert_per, cota_superior, cota_inferior")
      .eq("jaciment_id", jacimentId);

    if (!ues || ues.length === 0) return;

    const allCodes = ues.map(ue => ue.codi_ue || ue.id.slice(0, 8));
    const codeSet = new Set(allCodes);

    // Build edges: "from" is LATER (above), "to" is EARLIER (below)
    const edgeList: Edge[] = [];
    for (const ue of ues) {
      const code = ue.codi_ue || ue.id.slice(0, 8);
      for (const rel of RELATION_LATER) {
        const targets = parseRelations((ue as any)[rel]);
        for (const t of targets) {
          if (codeSet.has(t)) {
            edgeList.push({ from: code, to: t, type: rel });
          }
        }
      }
    }

    // Build adjacency for topological sort
    // from (later/above) -> to (earlier/below)
    // We need levels where level 0 = oldest (bottom), higher = more modern (top)
    // nivel(UE) = 1 + max(nivel of all children "to")
    const children = new Map<string, Set<string>>(); // code -> codes it sits ON TOP OF
    const parents = new Map<string, Set<string>>();
    allCodes.forEach(c => { children.set(c, new Set()); parents.set(c, new Set()); });

    for (const edge of edgeList) {
      children.get(edge.from)?.add(edge.to);
      parents.get(edge.to)?.add(edge.from);
    }

    // Calculate levels: level(n) = 1 + max(level of children), leaf = 0
    const levels = new Map<string, number>();
    const calcLevel = (code: string, visited: Set<string>): number => {
      if (levels.has(code)) return levels.get(code)!;
      if (visited.has(code)) return 0; // cycle protection
      visited.add(code);
      const kids = children.get(code) || new Set();
      let maxChild = -1;
      for (const kid of kids) {
        maxChild = Math.max(maxChild, calcLevel(kid, visited));
      }
      const lv = maxChild + 1;
      levels.set(code, lv);
      return lv;
    };

    for (const code of allCodes) {
      calcLevel(code, new Set());
    }

    // Group by level
    const levelGroups = new Map<number, string[]>();
    for (const [code, lv] of levels) {
      if (!levelGroups.has(lv)) levelGroups.set(lv, []);
      levelGroups.get(lv)!.push(code);
    }

    // Sort levels descending (highest level = most modern = top of screen)
    const sortedLevels = [...levelGroups.keys()].sort((a, b) => b - a);
    const maxLevel = sortedLevels.length > 0 ? sortedLevels[0] : 0;

    // Reduce crossings: order nodes within each level based on median position of connected nodes
    // Start from top, work down (Sugiyama-style barycenter heuristic)
    const positionInLevel = new Map<string, number>();

    // Initial ordering: just use the array order
    for (const lv of sortedLevels) {
      const codes = levelGroups.get(lv)!;
      codes.forEach((c, i) => positionInLevel.set(c, i));
    }

    // Barycenter passes (2 passes down, 2 up)
    for (let pass = 0; pass < 4; pass++) {
      const order = pass % 2 === 0 ? sortedLevels : [...sortedLevels].reverse();
      for (const lv of order) {
        const codes = levelGroups.get(lv)!;
        const barycenters = codes.map(code => {
          const connected = pass % 2 === 0
            ? [...(children.get(code) || [])]
            : [...(parents.get(code) || [])];
          if (connected.length === 0) return { code, bc: positionInLevel.get(code) || 0 };
          const avg = connected.reduce((s, c) => s + (positionInLevel.get(c) || 0), 0) / connected.length;
          return { code, bc: avg };
        });
        barycenters.sort((a, b) => a.bc - b.bc);
        const sorted = barycenters.map(b => b.code);
        levelGroups.set(lv, sorted);
        sorted.forEach((c, i) => positionInLevel.set(c, i));
      }
    }

    // Layout constants
    const nodeW = 100;
    const nodeH = 36;
    const levelSpacingY = 90;
    const nodeSpacingX = 130;

    const nodeList: Node[] = [];
    const levelY = new Map<number, number>();

    for (let i = 0; i < sortedLevels.length; i++) {
      const lv = sortedLevels[i];
      const y = i * levelSpacingY;
      levelY.set(lv, y);
      const codes = levelGroups.get(lv)!;
      const totalW = codes.length * nodeSpacingX;
      const startX = -totalW / 2 + nodeSpacingX / 2;
      codes.forEach((code, j) => {
        nodeList.push({
          id: code,
          label: code,
          x: startX + j * nodeSpacingX,
          y,
          level: lv,
        });
      });
    }

    setNodes(nodeList);
    setEdges(edgeList);
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    ctx.fillStyle = "#f5f0e8";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 + pan.x, 60 + pan.y);
    ctx.scale(zoom, zoom);

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const nodeH = 36;

    // Draw edges: strictly vertical or L-shaped (vertical + horizontal + vertical)
    for (const edge of edges) {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      if (!fromNode || !toNode) continue;

      const color = COLORS[edge.type] || "#888";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();

      const x1 = fromNode.x;
      const y1 = fromNode.y + nodeH / 2; // bottom of "from" node
      const x2 = toNode.x;
      const y2 = toNode.y - nodeH / 2; // top of "to" node

      if (Math.abs(x1 - x2) < 2) {
        // Perfectly vertical
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      } else {
        // L-shaped: go down halfway, then horizontal, then down
        const midY = (y1 + y2) / 2;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1, midY);
        ctx.lineTo(x2, midY);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      // Arrowhead pointing down at toNode
      const arrowSize = 6;
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - arrowSize, y2 - arrowSize * 1.5);
      ctx.lineTo(x2 + arrowSize, y2 - arrowSize * 1.5);
      ctx.closePath();
      ctx.fill();
    }

    // Draw nodes
    const nodeW = 90;
    for (const node of nodes) {
      // Box
      ctx.fillStyle = "#fffbf0";
      ctx.strokeStyle = "#8b7355";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(node.x - nodeW / 2, node.y - nodeH / 2, nodeW, nodeH, 5);
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = "#3d2e1f";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, node.x, node.y);
    }

    ctx.restore();
  }, [nodes, edges, pan, zoom]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.2, Math.min(4, z - e.deltaY * 0.001)));
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
        className="w-full h-[500px] border border-border rounded-lg cursor-grab active:cursor-grabbing"
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
