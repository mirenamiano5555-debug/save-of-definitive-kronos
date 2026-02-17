import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mountain, Layers, Box, ChevronDown, ChevronUp } from "lucide-react";

interface CategoryProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  expanded: boolean;
  onToggle: () => void;
}

function CategoryDropdown({ icon, title, description, onClick, expanded, onToggle }: CategoryProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          {icon}
          <span className="text-lg font-serif font-semibold">{title}</span>
        </div>
        {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-5 pb-4 space-y-3 animate-fade-in">
          <p className="text-sm text-muted-foreground">{description}</p>
          <Button className="w-full" onClick={onClick}>
            Crear {title}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (key: string) => setExpanded(expanded === key ? null : key);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold">Pujar</h1>
      </header>

      <div className="p-4 space-y-3 animate-fade-in">
        <p className="text-muted-foreground">Selecciona el tipus d'ítem que vols crear:</p>

        <CategoryDropdown
          icon={<Mountain className="h-6 w-6 text-primary" />}
          title="Jaciment"
          description="Crea un nou jaciment arqueològic amb ubicació, imatge i descripció."
          expanded={expanded === "jaciment"}
          onToggle={() => toggle("jaciment")}
          onClick={() => navigate("/upload/jaciment")}
        />

        <CategoryDropdown
          icon={<Layers className="h-6 w-6 text-primary" />}
          title="Unitat Estratigràfica"
          description="Registra una nova UE associada a un jaciment existent."
          expanded={expanded === "ue"}
          onToggle={() => toggle("ue")}
          onClick={() => navigate("/upload/ue")}
        />

        <CategoryDropdown
          icon={<Box className="h-6 w-6 text-primary" />}
          title="Objecte"
          description="Registra un objecte trobat dins una UE amb imatge i codi QR automàtic."
          expanded={expanded === "objecte"}
          onToggle={() => toggle("objecte")}
          onClick={() => navigate("/upload/objecte")}
        />
      </div>
    </div>
  );
}
