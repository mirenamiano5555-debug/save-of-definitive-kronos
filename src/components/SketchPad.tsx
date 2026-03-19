import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Eraser, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

const COLORS = ["#3d2e1f", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"];
const SIZES = [2, 4, 8];

interface SketchPadProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
}

export default function SketchPad({ value, onChange, folder = "croquis" }: SketchPadProps) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [erasing, setErasing] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    if (value) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
      };
      img.src = value;
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const pos = getPos(e);
    const prev = lastPos.current || pos;

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = erasing ? "#ffffff" : color;
    ctx.lineWidth = erasing ? size * 3 : size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPos.current = pos;
  }, [drawing, color, size, erasing]);

  const stopDraw = () => {
    setDrawing(false);
    lastPos.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
  };

  const saveSketch = async () => {
    if (!user || !canvasRef.current) return;
    setSaving(true);
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) { setSaving(false); return; }
      const path = `${user.id}/${folder}/${Date.now()}.png`;
      const { error } = await supabase.storage.from("images").upload(path, blob, { contentType: "image/png" });
      if (error) { toast.error("Error guardant croquis"); setSaving(false); return; }
      const { data } = supabase.storage.from("images").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Croquis guardat!");
      setSaving(false);
    }, "image/png");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {COLORS.map(c => (
          <button
            key={c}
            type="button"
            className={`w-7 h-7 rounded-full border-2 ${color === c && !erasing ? "border-foreground scale-110" : "border-transparent"}`}
            style={{ backgroundColor: c }}
            onClick={() => { setColor(c); setErasing(false); }}
          />
        ))}
        <Button
          type="button"
          variant={erasing ? "default" : "outline"}
          size="icon"
          className="h-7 w-7"
          onClick={() => setErasing(!erasing)}
        >
          <Eraser className="h-4 w-4" />
        </Button>
        <div className="flex gap-1 ml-2">
          {SIZES.map(s => (
            <button
              key={s}
              type="button"
              className={`rounded-full bg-foreground ${size === s ? "ring-2 ring-primary" : ""}`}
              style={{ width: s * 3 + 4, height: s * 3 + 4 }}
              onClick={() => setSize(s)}
            />
          ))}
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={clearCanvas}>
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={saveSketch} disabled={saving}>
          <Save className="h-3 w-3" /> {saving ? "Guardant..." : "Guardar"}
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-[300px] border border-border rounded-lg bg-white cursor-crosshair touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      {value && (
        <p className="text-xs text-muted-foreground">✓ Croquis guardat</p>
      )}
    </div>
  );
}
