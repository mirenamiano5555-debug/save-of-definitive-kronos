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
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success(t("Correu de restabliment enviat! Comprova la teva safata d'entrada."));
    setLoading(false);
    setShowForgot(false);
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

            {mode === "login" && (
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => { setShowForgot(true); setForgotEmail(email); }}
              >
                {t("Has oblidat la contrasenya?")}
              </button>
            )}

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
                  <Select value={role} onValueChange={(v) => setRole(v as "tecnic" | "director" | "visitant")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tecnic">{t("Tècnic")}</SelectItem>
                      <SelectItem value="visitant">{t("Visitant")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {role === "visitant" ? t("Accés immediat com a visitant (només lectura).") : t("El teu registre haurà de ser aprovat per un director.")}
                  </p>
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

        {/* Forgot password dialog */}
        {showForgot && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForgot(false)}>
            <div className="bg-card border border-border rounded-lg p-6 shadow-lg w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-serif font-semibold text-lg mb-4">{t("Restablir contrasenya")}</h3>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <Label>{t("Correu electrònic")}</Label>
                  <Input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForgot(false)}>
                    {t("Cancel·lar")}
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? t("Carregant...") : t("Enviar")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}