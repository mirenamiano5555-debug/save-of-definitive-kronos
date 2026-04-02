import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mountain, Layers, Box, ChevronDown, ChevronUp } from "lucide-react";

interface CategoryProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  expanded: boolean;
  onToggle: () => void;
  createLabel: string;
}

function CategoryDropdown({ icon, title, description, onClick, expanded, onToggle, createLabel }: CategoryProps) {
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
            {createLabel} {title}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  const navigate = useNavigate();
  const { t } = useT();
  const { profile } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (profile?.role === "visitant") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">{t("No tens permisos per pujar contingut.")}</p>
          <p className="text-sm text-muted-foreground">{t("Rol visitant: només lectura")}</p>
          <Button variant="outline" onClick={() => navigate(-1)}>{t("Tornar")}</Button>
        </div>
      </div>
    );
  }

  const toggle = (key: string) => setExpanded(expanded === key ? null : key);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold">{t("Pujar")}</h1>
      </header>

      <div className="p-4 space-y-3 animate-fade-in">
        <p className="text-muted-foreground">{t("Selecciona el tipus d'ítem que vols crear:")}</p>

        <CategoryDropdown
          icon={<Mountain className="h-6 w-6 text-primary" />}
          title={t("Jaciment")}
          description={t("Crea un nou jaciment arqueològic amb ubicació, imatge i descripció.")}
          expanded={expanded === "jaciment"}
          onToggle={() => toggle("jaciment")}
          onClick={() => navigate("/upload/jaciment")}
          createLabel={t("Crear")}
        />

        <CategoryDropdown
          icon={<Layers className="h-6 w-6 text-primary" />}
          title={t("Unitat Estratigràfica")}
          description={t("Registra una nova UE associada a un jaciment existent.")}
          expanded={expanded === "ue"}
          onToggle={() => toggle("ue")}
          onClick={() => navigate("/upload/ue")}
          createLabel={t("Crear")}
        />

        <CategoryDropdown
          icon={<Box className="h-6 w-6 text-primary" />}
          title={t("Objecte")}
          description={t("Registra un objecte trobat dins una UE amb imatge i codi QR automàtic.")}
          expanded={expanded === "objecte"}
          onToggle={() => toggle("objecte")}
          onClick={() => navigate("/upload/objecte")}
          createLabel={t("Crear")}
        />
      </div>
    </div>
  );
}
