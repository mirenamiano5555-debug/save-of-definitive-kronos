import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, LogOut, Trash2, Globe } from "lucide-react";
import { toast } from "sonner";
import ImageUpload from "@/components/ImageUpload";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { t, lang, setLang } = useT();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [entity, setEntity] = useState(profile?.entity || "");
  const [role, setRole] = useState(profile?.role || "tecnic");
  const [location, setLocation] = useState(profile?.location || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !profile) return;
    setSaving(true);

    // Check if role changed
    const roleChanged = role !== profile.role;

    // Update basic profile fields (not role)
    const { error } = await supabase.from("profiles").update({
      full_name: fullName,
      entity,
      location,
      avatar_url: avatarUrl,
      ...(roleChanged ? { requested_role: role as any } : {}),
    }).eq("user_id", user.id);

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    if (roleChanged) {
      // Send notification to directors/admins of same entity
      const { data: directors } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("entity", profile.entity)
        .in("role", ["director", "admin"]);

      if (directors && directors.length > 0) {
        const notifications = directors.map((d) => ({
          user_id: d.user_id,
          title: t("Sol·licitud de canvi de rol"),
          body: `${fullName || user.email} ${t("vol canviar el seu rol a")} ${role}`,
          type: "user_approval",
          link: "/admin/users",
        }));
        await supabase.from("notifications").insert(notifications);
      }

      toast.success(t("Sol·licitud de canvi de rol enviada. Un director o administrador l'haurà d'aprovar."));
      setRole(profile.role); // Reset selector to current role
    } else {
      toast.success(t("Perfil actualitzat!"));
    }

    await refreshProfile();
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    await supabase.from("profiles").delete().eq("user_id", user.id);
    await signOut();
    toast.success(t("Compte eliminat"));
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold">{t("El meu perfil")}</h1>
      </header>

      <div className="p-4 space-y-4 pb-24 animate-fade-in">
        <ImageUpload value={avatarUrl} onChange={setAvatarUrl} label={t("Foto de perfil")} folder="avatars" />

        <div>
          <Label>{t("Correu electrònic")}</Label>
          <Input value={user?.email || ""} disabled />
        </div>
        <div>
          <Label>{t("Nom complet")}</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label>{t("Entitat *")}</Label>
          <Input value={entity} onChange={(e) => setEntity(e.target.value)} required />
        </div>
        <div>
          <Label>{t("Rol")}</Label>
          <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted text-sm">
            {t(role === "admin" ? "Administrador" : role === "tecnic" ? "Tècnic" : role === "director" ? "Director" : "Visitant")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{t("Contacta un director per canviar el teu rol.")}</p>
        </div>
        <div>
          <Label>{t("Ubicació")}</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        {/* Language setting */}
        <div>
          <Label className="flex items-center gap-2">
            <Globe className="h-4 w-4" /> {t("Idioma")}
          </Label>
          <Select value={lang} onValueChange={(v) => setLang(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ca">{t("Català")}</SelectItem>
              <SelectItem value="es">{t("Castellà")}</SelectItem>
              <SelectItem value="en">{t("Anglès")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} className="w-full" disabled={saving}>
          {saving ? t("Guardant...") : t("Guardar canvis")}
        </Button>

        <div className="pt-4 space-y-2 border-t border-border">
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> {t("Tancar sessió")}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" /> {t("Eliminar compte")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("Eliminar el teu compte?")}</AlertDialogTitle>
                <AlertDialogDescription>{t("Totes les teves dades seran eliminades permanentment.")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("Cancel·lar")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount}>{t("Eliminar")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
