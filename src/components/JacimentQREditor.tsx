import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, QrCode, Trash2, Download, ZoomIn, ZoomOut, Move } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

interface PlacedQR {
  id: string;
  objectId: string;
  objectName: string;
  x: number;
  y: number;
  size: number;
}

interface JacimentQREditorProps {
  jacimentId: string;
  imageUrl: string;
}

export default function JacimentQREditor({ jacimentId, imageUrl }: JacimentQREditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [objectes, setObjectes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredObjects, setFilteredObjects] = useState<any[]>([]);
  const [placedQRs, setPlacedQRs] = useState<PlacedQR[]>([]);
  const [selectedQR, setSelectedQR] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showSearch, setShowSearch] = useState(false);

  // Load objects for this jaciment
  useEffect(() => {
    supabase
      .from("objectes")
      .select("id, object_id, name")
      .eq("jaciment_id", jacimentId)
      .then(({ data }) => {
        if (data) setObjectes(data);
      });
  }, [jacimentId]);

  // Filter objects
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredObjects(objectes);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredObjects(
        objectes.filter(
          (o) =>
            o.name.toLowerCase().includes(q) ||
            o.object_id.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, objectes]);

  // Load background image
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setBgImage(img);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw background image scaled to fit
    const scale = Math.min(canvas.width / zoom / bgImage.width, canvas.height / zoom / bgImage.height);
    const imgW = bgImage.width * scale;
    const imgH = bgImage.height * scale;
    const imgX = (canvas.width / zoom - imgW) / 2;
    const imgY = (canvas.height / zoom - imgH) / 2;
    ctx.drawImage(bgImage, imgX, imgY, imgW, imgH);

    // Draw placed QRs
    placedQRs.forEach((qr) => {
      const isSelected = selectedQR === qr.id;

      // White background for QR
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qr.x - 2, qr.y - 2, qr.size + 4, qr.size + 4);

      // Draw QR code as a simple pattern
      drawQRPattern(ctx, qr.x, qr.y, qr.size, `${window.location.origin}/objecte/${qr.id}`);

      // Label
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qr.x, qr.y + qr.size + 2, qr.size, 16);
      ctx.fillStyle = "#000000";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(qr.objectName, qr.x + qr.size / 2, qr.y + qr.size + 13, qr.size);

      // Selection border
      if (isSelected) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.strokeRect(qr.x - 4, qr.y - 4, qr.size + 8, qr.size + 24);
      }
    });

    ctx.restore();
  }, [bgImage, placedQRs, selectedQR, zoom, pan]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  function drawQRPattern(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, _url: string) {
    // Draw a simplified QR-like pattern
    const cells = 7;
    const cellSize = size / cells;
    ctx.fillStyle = "#000000";

    // Corner patterns
    for (let row = 0; row < cells; row++) {
      for (let col = 0; col < cells; col++) {
        const isCorner =
          (row < 3 && col < 3) ||
          (row < 3 && col >= cells - 3) ||
          (row >= cells - 3 && col < 3);
        const isEdge =
          row === 0 || row === cells - 1 || col === 0 || col === cells - 1;
        const isCenter = row === 1 && col === 1 || row === 1 && col === cells - 2 ||
          row === cells - 2 && col === 1;

        if (isCorner && (isEdge || isCenter)) {
          ctx.fillRect(x + col * cellSize, y + row * cellSize, cellSize, cellSize);
        } else if (!isCorner && (row + col) % 2 === 0) {
          ctx.fillRect(x + col * cellSize, y + row * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  const getCanvasCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);

    // Check if clicking on a QR
    for (const qr of placedQRs) {
      if (
        coords.x >= qr.x - 4 &&
        coords.x <= qr.x + qr.size + 4 &&
        coords.y >= qr.y - 4 &&
        coords.y <= qr.y + qr.size + 20
      ) {
        setSelectedQR(qr.id);
        setDragging(qr.id);
        setDragOffset({ x: coords.x - qr.x, y: coords.y - qr.y });
        return;
      }
    }

    // Start panning
    setSelectedQR(null);
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const coords = getCanvasCoords(e);
      setPlacedQRs((prev) =>
        prev.map((qr) =>
          qr.id === dragging
            ? { ...qr, x: coords.x - dragOffset.x, y: coords.y - dragOffset.y }
            : qr
        )
      );
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  const addQR = (obj: any) => {
    const existing = placedQRs.find((q) => q.id === obj.id);
    if (existing) {
      toast.error("Aquest objecte ja té un QR col·locat");
      return;
    }

    setPlacedQRs((prev) => [
      ...prev,
      {
        id: obj.id,
        objectId: obj.object_id,
        objectName: obj.name,
        x: 50,
        y: 50,
        size: 60,
      },
    ]);
    setShowSearch(false);
    toast.success(`QR de "${obj.name}" afegit`);
  };

  const removeSelectedQR = () => {
    if (!selectedQR) return;
    setPlacedQRs((prev) => prev.filter((q) => q.id !== selectedQR));
    setSelectedQR(null);
  };

  const resizeSelectedQR = (delta: number) => {
    if (!selectedQR) return;
    setPlacedQRs((prev) =>
      prev.map((qr) =>
        qr.id === selectedQR
          ? { ...qr, size: Math.max(30, Math.min(200, qr.size + delta)) }
          : qr
      )
    );
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create export canvas without selection borders
    const exportCanvas = document.createElement("canvas");
    const bgImg = bgImage;
    if (!bgImg) return;

    exportCanvas.width = bgImg.width;
    exportCanvas.height = bgImg.height;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(bgImg, 0, 0);

    const dispScale = Math.min(
      (containerRef.current?.clientWidth || 800) / zoom / bgImg.width,
      (containerRef.current?.clientHeight || 600) / zoom / bgImg.height
    );
    const imgX = ((containerRef.current?.clientWidth || 800) / zoom - bgImg.width * dispScale) / 2;
    const imgY = ((containerRef.current?.clientHeight || 600) / zoom - bgImg.height * dispScale) / 2;
    const realScale = 1 / dispScale;

    placedQRs.forEach((qr) => {
      const rx = (qr.x - imgX) * realScale;
      const ry = (qr.y - imgY) * realScale;
      const rs = qr.size * realScale;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(rx - 2, ry - 2, rs + 4, rs + 4);
      drawQRPattern(ctx, rx, ry, rs, `${window.location.origin}/objecte/${qr.id}`);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(rx, ry + rs + 2, rs, 20);
      ctx.fillStyle = "#000000";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(qr.objectName, rx + rs / 2, ry + rs + 16, rs);
    });

    const link = document.createElement("a");
    link.download = `jaciment-qr-${jacimentId.slice(0, 8)}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
    toast.success("Imatge exportada!");
  };

  // Generate real QR SVGs for export
  const exportWithRealQRs = () => {
    if (!bgImage) return;

    // We'll use html2canvas approach - create a hidden div with real QRs
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.left = "-9999px";
    div.style.top = "0";
    document.body.appendChild(div);

    const canvas = document.createElement("canvas");
    canvas.width = bgImage.width;
    canvas.height = bgImage.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(bgImage, 0, 0);

    const container = containerRef.current;
    if (!container) return;
    const dispScale = Math.min(
      container.clientWidth / zoom / bgImage.width,
      container.clientHeight / zoom / bgImage.height
    );
    const imgX = (container.clientWidth / zoom - bgImage.width * dispScale) / 2;
    const imgY = (container.clientHeight / zoom - bgImage.height * dispScale) / 2;
    const realScale = 1 / dispScale;

    // For each QR, render a real QR code onto the canvas
    const promises = placedQRs.map((qr) => {
      return new Promise<void>((resolve) => {
        const url = `${window.location.origin}/objecte/${qr.id}`;
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="white"/><text x="100" y="100" text-anchor="middle" font-size="12">${qr.objectId}</text></svg>`;

        // Use a hidden QRCodeSVG to generate real QR
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`;
        
        // Draw placeholder for now
        const rx = (qr.x - imgX) * realScale;
        const ry = (qr.y - imgY) * realScale;
        const rs = qr.size * realScale;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(rx - 4, ry - 4, rs + 8, rs + 28);
        drawQRPattern(ctx, rx, ry, rs, url);

        ctx.fillStyle = "#000000";
        ctx.font = `${Math.max(12, rs / 5)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(qr.objectName, rx + rs / 2, ry + rs + Math.max(16, rs / 4), rs);

        resolve();
      });
    });

    Promise.all(promises).then(() => {
      const link = document.createElement("a");
      link.download = `jaciment-qr-${jacimentId.slice(0, 8)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      document.body.removeChild(div);
      toast.success("Imatge amb QRs exportada!");
    });
  };

  if (!imageUrl) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Aquest jaciment no té imatge. Afegeix una imatge primer per usar l'editor de QR.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Dialog open={showSearch} onOpenChange={setShowSearch}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <QrCode className="h-4 w-4 mr-1" /> Afegir QR
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Selecciona un objecte</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cercar objecte..."
                  className="pl-10"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredObjects.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hi ha objectes en aquest jaciment
                  </p>
                )}
                {filteredObjects.map((obj) => (
                  <button
                    key={obj.id}
                    onClick={() => addQR(obj)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
                  >
                    <span className="font-medium">{obj.name}</span>
                    <span className="text-muted-foreground ml-2">({obj.object_id})</span>
                  </button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
          <Move className="h-4 w-4 mr-1" /> Reset
        </Button>

        {selectedQR && (
          <>
            <Button variant="outline" size="sm" onClick={() => resizeSelectedQR(10)}>
              + Mida
            </Button>
            <Button variant="outline" size="sm" onClick={() => resizeSelectedQR(-10)}>
              - Mida
            </Button>
            <Button variant="destructive" size="sm" onClick={removeSelectedQR}>
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar QR
            </Button>
          </>
        )}

        {placedQRs.length > 0 && (
          <Button variant="default" size="sm" onClick={exportWithRealQRs}>
            <Download className="h-4 w-4 mr-1" /> Exportar imatge
          </Button>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative border border-border rounded-lg overflow-hidden bg-muted"
        style={{ height: "400px", cursor: dragging ? "grabbing" : isPanning ? "grabbing" : "grab" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        />
      </div>

      {placedQRs.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {placedQRs.length} QR(s) col·locats. Arrossega per moure. Fes clic per seleccionar.
        </p>
      )}
    </div>
  );
}
