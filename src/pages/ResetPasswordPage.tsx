import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useT } from "@/contexts/LanguageContext";

export default function ResetPasswordPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t("La contrasenya ha de tenir almenys 6 caràcters"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("Contrasenya restablerta correctament!"));
      navigate("/");
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-2xl font-serif font-bold text-primary mb-4">Kronos</h1>
          <p className="text-muted-foreground">{t("Carregant...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-primary mb-2">Kronos</h1>
          <p className="text-muted-foreground">{t("Restablir contrasenya")}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <Label htmlFor="new-password">{t("Nova contrasenya")}</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder={t("Mínim 6 caràcters")}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("Carregant...") : t("Restablir contrasenya")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
