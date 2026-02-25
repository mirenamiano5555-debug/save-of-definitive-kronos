import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ImageUpload from "@/components/ImageUpload";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [entity, setEntity] = useState(profile?.entity || "");
  const [role, setRole] = useState(profile?.role || "tecnic");
  const [location, setLocation] = useState(profile?.location || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName,
      entity,
      role: role as any,
      location,
      avatar_url: avatarUrl,
    }).eq("user_id", user.id);

    // Also update user_roles
    await supabase.from("user_roles").upsert({ user_id: user.id, role: role as any }, { onConflict: "user_id,role" });

    if (error) toast.error(error.message);
    else {
      toast.success("Perfil actualitzat!");
      await refreshProfile();
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    await supabase.from("profiles").delete().eq("user_id", user.id);
    await signOut();
    toast.success("Compte eliminat");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold">El meu perfil</h1>
      </header>

      <div className="p-4 space-y-4 pb-24 animate-fade-in">
        <ImageUpload value={avatarUrl} onChange={setAvatarUrl} label="Foto de perfil" folder="avatars" />

        <div>
          <Label>Correu electrònic</Label>
          <Input value={user?.email || ""} disabled />
        </div>
        <div>
          <Label>Nom complet</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label>Entitat *</Label>
          <Input value={entity} onChange={(e) => setEntity(e.target.value)} required />
        </div>
        <div>
          <Label>Rol</Label>
          <Select value={role} onValueChange={(v) => setRole(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tecnic">Tècnic</SelectItem>
              <SelectItem value="director">Director</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Ubicació</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        <Button onClick={handleSave} className="w-full" disabled={saving}>
          {saving ? "Guardant..." : "Guardar canvis"}
        </Button>

        <div className="pt-4 space-y-2 border-t border-border">
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Tancar sessió
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar compte
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar el teu compte?</AlertDialogTitle>
                <AlertDialogDescription>Totes les teves dades seran eliminades permanentment.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
