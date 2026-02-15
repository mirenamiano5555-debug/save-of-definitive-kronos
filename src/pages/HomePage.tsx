import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Upload, Search, Edit, User, MessageSquare } from "lucide-react";

export default function HomePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold text-primary">Kronos</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/messages")}>
            <MessageSquare className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
            <User className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Welcome */}
      <div className="p-4 animate-fade-in">
        <p className="text-muted-foreground mb-6">
          Hola, <span className="font-medium text-foreground">{profile?.full_name || profile?.entity || "usuari"}</span>
        </p>

        {/* Main Actions */}
        <div className="grid gap-4">
          <Button
            className="h-20 text-lg font-serif justify-start gap-4 px-6"
            onClick={() => navigate("/upload")}
          >
            <Upload className="h-6 w-6" />
            Pujar
          </Button>

          <Button
            variant="outline"
            className="h-20 text-lg font-serif justify-start gap-4 px-6"
            onClick={() => navigate("/search")}
          >
            <Search className="h-6 w-6" />
            Buscar
          </Button>

          <Button
            variant="outline"
            className="h-20 text-lg font-serif justify-start gap-4 px-6"
            onClick={() => navigate("/my-items")}
          >
            <Edit className="h-6 w-6" />
            Editar els meus ítems
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border">
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
          Tancar sessió
        </Button>
      </div>
    </div>
  );
}
