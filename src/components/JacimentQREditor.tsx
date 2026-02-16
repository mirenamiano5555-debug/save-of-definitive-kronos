import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, QrCode, Trash2, Download, ZoomIn, ZoomOut, Move } from "lucide-react";
import { toast } from "sonner";

interface PlacedQR {
  id: string;
  objectId: string;
  objectName: string;
  x: number;
  y: number;
  size: number;
  qrImage: HTMLImageElement;
}

interface JacimentQREditorProps {
  jacimentId: string;
  imageUrl: string;
}

/** Render a QR code to an HTMLImageElement using an offscreen SVG via qrcode lib */
function generateQRImage(url: string, size: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // Use a canvas-based QR generation approach
    const modules = generateQRMatrix(url);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("No canvas context"));

    const cellSize = size / modules.length;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000000";

    for (let row = 0; row < modules.length; row++) {
      for (let col = 0; col < modules[row].length; col++) {
        if (modules[row][col]) {
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = canvas.toDataURL("image/png");
  });
}

// Minimal QR code generator (alphanumeric mode, version auto)
function generateQRMatrix(text: string): boolean[][] {
  // We'll use a hidden SVG from qrcode.react rendered to canvas
  // Instead, let's use a simpler approach: render QRCodeSVG to an SVG string and parse it
  // Actually, the simplest reliable approach is to create a temporary DOM element
  
  // For a truly functional QR, we need to use the actual qrcode.react or a pure JS lib.
  // Let's use a different approach: render to a hidden div and capture.
  
  // FALLBACK: Use a basic QR encoding. For production, we'll render via DOM.
  // This is a placeholder that will be replaced by the DOM rendering approach.
  const size = 25;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  
  // This won't produce a scannable QR. We need the real approach.
  return matrix;
}

/** Use QRCodeSVG from qrcode.react by rendering to DOM and converting to image */
function renderQRToImage(url: string, pixelSize: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    document.body.appendChild(container);

    // Create SVG manually using the qrcode.react approach
    // We'll use dynamic import or direct SVG creation
    // Actually, let's use the canvas from qrcode.react's toDataURL
    
    // Simpler: create a React root and render QRCodeSVG, then grab the SVG
    import("react-dom/client").then((ReactDOM) => {
      import("react").then((React) => {
        import("qrcode.react").then(({ QRCodeSVG }) => {
          const root = ReactDOM.createRoot(container);
          root.render(
            React.createElement(QRCodeSVG, {
              value: url,
              size: pixelSize,
              level: "M",
              includeMargin: true,
            })
          );

          // Wait for render
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const svg = container.querySelector("svg");
              if (!svg) {
                root.unmount();
                document.body.removeChild(container);
                reject(new Error("SVG not found"));
                return;
              }

              const svgData = new XMLSerializer().serializeToString(svg);
              const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
              const svgUrl = URL.createObjectURL(svgBlob);

              const img = new Image();
              img.onload = () => {
                URL.revokeObjectURL(svgUrl);
                root.unmount();
                document.body.removeChild(container);
                resolve(img);
              };
              img.onerror = (e) => {
                URL.revokeObjectURL(svgUrl);
                root.unmount();
                document.body.removeChild(container);
                reject(e);
              };
              img.src = svgUrl;
            });
          });
        });
      });
    });
  });
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

  useEffect(() => {
    supabase
      .from("objectes")
      .select("id, object_id, name")
      .eq("jaciment_id", jacimentId)
      .then(({ data }) => {
        if (data) setObjectes(data);
      });
  }, [jacimentId]);

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

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setBgImage(img);
    img.src = imageUrl;
  }, [imageUrl]);

  const getImageLayout = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !bgImage || !container) return null;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scale = Math.min(cw / zoom / bgImage.width, ch / zoom / bgImage.height);
    const imgW = bgImage.width * scale;
    const imgH = bgImage.height * scale;
    const imgX = (cw / zoom - imgW) / 2;
    const imgY = (ch / zoom - imgH) / 2;
    return { scale, imgW, imgH, imgX, imgY, cw, ch };
  }, [bgImage, zoom]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !bgImage || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const layout = getImageLayout();
    if (!layout) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    ctx.drawImage(bgImage, layout.imgX, layout.imgY, layout.imgW, layout.imgH);

    placedQRs.forEach((qr) => {
      const isSelected = selectedQR === qr.id;

      // Draw the real QR image
      ctx.drawImage(qr.qrImage, qr.x, qr.y, qr.size, qr.size);

      // Label background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qr.x, qr.y + qr.size, qr.size, 16);
      ctx.fillStyle = "#000000";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(qr.objectName, qr.x + qr.size / 2, qr.y + qr.size + 12, qr.size);

      if (isSelected) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(qr.x - 3, qr.y - 3, qr.size + 6, qr.size + 22);
        ctx.setLineDash([]);
      }
    });

    ctx.restore();
  }, [bgImage, placedQRs, selectedQR, zoom, pan, getImageLayout]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

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

    for (const qr of [...placedQRs].reverse()) {
      if (
        coords.x >= qr.x - 3 &&
        coords.x <= qr.x + qr.size + 3 &&
        coords.y >= qr.y - 3 &&
        coords.y <= qr.y + qr.size + 19
      ) {
        setSelectedQR(qr.id);
        setDragging(qr.id);
        setDragOffset({ x: coords.x - qr.x, y: coords.y - qr.y });
        return;
      }
    }

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

  const addQR = async (obj: any) => {
    const existing = placedQRs.find((q) => q.id === obj.id);
    if (existing) {
      toast.error("Aquest objecte ja té un QR col·locat");
      return;
    }

    try {
      const qrUrl = `${window.location.origin}/objecte/${obj.id}`;
      const qrImage = await renderQRToImage(qrUrl, 200);

      setPlacedQRs((prev) => [
        ...prev,
        {
          id: obj.id,
          objectId: obj.object_id,
          objectName: obj.name,
          x: 50,
          y: 50,
          size: 60,
          qrImage,
        },
      ]);
      setShowSearch(false);
      toast.success(`QR funcional de "${obj.name}" afegit`);
    } catch (err) {
      console.error("Error generating QR:", err);
      toast.error("Error generant el QR");
    }
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

  const exportImage = async () => {
    if (!bgImage) return;

    const layout = getImageLayout();
    if (!layout) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = bgImage.width;
    exportCanvas.height = bgImage.height;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(bgImage, 0, 0);

    const realScale = 1 / layout.scale;

    for (const qr of placedQRs) {
      const rx = (qr.x - layout.imgX) * realScale;
      const ry = (qr.y - layout.imgY) * realScale;
      const rs = qr.size * realScale;

      // Generate a high-res QR for the export
      const qrUrl = `${window.location.origin}/objecte/${qr.id}`;
      const hiResQR = await renderQRToImage(qrUrl, Math.max(400, Math.round(rs)));

      ctx.drawImage(hiResQR, rx, ry, rs, rs);

      // Label
      const fontSize = Math.max(14, rs / 5);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(rx, ry + rs, rs, fontSize + 8);
      ctx.fillStyle = "#000000";
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(qr.objectName, rx + rs / 2, ry + rs + fontSize + 2, rs);
    }

    const link = document.createElement("a");
    link.download = `jaciment-qr-${jacimentId.slice(0, 8)}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
    toast.success("Imatge amb QRs funcionals exportada!");
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
            <Button variant="outline" size="sm" onClick={() => resizeSelectedQR(10)}>+ Mida</Button>
            <Button variant="outline" size="sm" onClick={() => resizeSelectedQR(-10)}>- Mida</Button>
            <Button variant="destructive" size="sm" onClick={removeSelectedQR}>
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          </>
        )}

        {placedQRs.length > 0 && (
          <Button variant="default" size="sm" onClick={exportImage}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
        )}
      </div>

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
          {placedQRs.length} QR(s) funcionals col·locats. Arrossega per moure. Fes clic per seleccionar.
        </p>
      )}
      {placedQRs.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Fes clic a "Afegir QR" per col·locar codis QR funcionals d'objectes sobre la imatge del jaciment.
        </p>
      )}
    </div>
  );
}
