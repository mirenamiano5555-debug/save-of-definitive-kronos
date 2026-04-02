import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useT } from "@/contexts/LanguageContext";
import { Globe } from "lucide-react";

export default function AuthPage() {
  const { t, lang, setLang } = useT();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [entity, setEntity] = useState("");
  const [role, setRole] = useState<"tecnic" | "director" | "visitant">("tecnic");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    else toast.success(t("Sessió iniciada correctament!"));
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entity.trim()) {
      toast.error(t("L'entitat és obligatòria"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, entity, role, location },
      },
    });
    if (error) toast.error(error.message);
    else toast.success(t("Registre completat! Comprova el teu correu per verificar el compte."));
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-primary mb-2">Kronos</h1>
          <p className="text-muted-foreground">{t("Arqueologia Digital")}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          {/* Language selector */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={lang} onValueChange={(v) => setLang(v as any)}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ca">{t("Català")}</SelectItem>
                <SelectItem value="es">{t("Castellà")}</SelectItem>
                <SelectItem value="en">{t("Anglès")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 mb-6">
            <Button variant={mode === "login" ? "default" : "outline"} className="flex-1" onClick={() => setMode("login")}>
              {t("Iniciar sessió")}
            </Button>
            <Button variant={mode === "register" ? "default" : "outline"} className="flex-1" onClick={() => setMode("register")}>
              {t("Crear usuari")}
            </Button>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="email">{t("Correu electrònic")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">{t("Contrasenya")}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>

            {mode === "register" && (
              <>
                <div>
                  <Label htmlFor="fullName">{t("Nom complet (opcional)")}</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="entity">{t("Entitat *")}</Label>
                  <Input id="entity" value={entity} onChange={(e) => setEntity(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="role">{t("Rol")}</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as "tecnic" | "director")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tecnic">{t("Tècnic")}</SelectItem>
                      <SelectItem value="director">{t("Director")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location">{t("Ubicació (opcional)")}</Label>
                  <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("Carregant...") : mode === "login" ? t("Iniciar sessió") : t("Registrar-se")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
