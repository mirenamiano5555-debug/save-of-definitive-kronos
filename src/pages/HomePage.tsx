import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Search, Edit, User, MessageSquare, LogOut, Plus, PenLine } from "lucide-react";

export default function HomePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const actions = [
    {
      icon: Plus,
      title: "Pujar Objecte Nou",
      description: "Documenta una nova troballa amb tots els camps requerits i genera el codi QR corresponent.",
      onClick: () => navigate("/upload"),
    },
    {
      icon: Search,
      title: "Cercar",
      description: "Busca objectes i jaciments per nom, data, lloc o escaneja un codi QR per accedir directament.",
      onClick: () => navigate("/search"),
    },
    {
      icon: PenLine,
      title: "Els Meus Objectes",
      description: "Modifica o elimina els objectes que has registrat. Només pots editar les teves pròpies troballes.",
      onClick: () => navigate("/my-items"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-serif font-bold text-primary">Kronos</h1>
          <span className="text-sm text-muted-foreground">
            Benvingut/da, <span className="font-medium text-foreground">{profile?.full_name || profile?.entity || "usuari"}</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate("/upload")}>
            <Upload className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate("/messages")}>
            <MessageSquare className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
            <User className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <div className="animate-fade-in">
        <div className="text-center py-10 px-4">
          <h2 className="text-3xl font-serif font-bold text-foreground mb-3">
            Sistema de Documentació Arqueològica
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Documenta, cerca i gestiona les troballes arqueològiques de manera professional i eficient.
          </p>
        </div>

        {/* Action Cards */}
        <div className="px-4 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {actions.map((action) => (
            <Card
              key={action.title}
              className="cursor-pointer hover:shadow-lg transition-shadow border-border"
              onClick={action.onClick}
            >
              <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <action.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-serif font-semibold text-lg">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tips */}
        <div className="px-4 max-w-4xl mx-auto mt-8 mb-20">
          <Card className="border-border">
            <CardContent className="p-5">
              <h3 className="font-serif font-semibold mb-3">Consells ràpids</h3>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>Els codis QR generats es poden escanejar per accedir directament a la fitxa de l'objecte.</li>
                <li>Pots exportar les fitxes en format PDF o DOC des de la vista de detall.</li>
                <li>Utilitza l'editor QR dels jaciments per col·locar codis sobre la imatge del jaciment.</li>
                <li>Les troballes amb visibilitat "Entitat" només són visibles pels membres de la teva entitat.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
