import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mountain, Layers, Box } from "lucide-react";

export default function UploadPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold">Pujar</h1>
      </header>

      <div className="p-4 space-y-4 animate-fade-in">
        <p className="text-muted-foreground">Selecciona el tipus d'ítem que vols crear:</p>

        <Button
          variant="outline"
          className="w-full h-20 text-lg font-serif justify-start gap-4 px-6"
          onClick={() => navigate("/upload/jaciment")}
        >
          <Mountain className="h-6 w-6 text-primary" />
          Jaciment
        </Button>

        <Button
          variant="outline"
          className="w-full h-20 text-lg font-serif justify-start gap-4 px-6"
          onClick={() => navigate("/upload/ue")}
        >
          <Layers className="h-6 w-6 text-primary" />
          Unitat Estratigràfica
        </Button>

        <Button
          variant="outline"
          className="w-full h-20 text-lg font-serif justify-start gap-4 px-6"
          onClick={() => navigate("/upload/objecte")}
        >
          <Box className="h-6 w-6 text-primary" />
          Objecte
        </Button>
      </div>
    </div>
  );
}
