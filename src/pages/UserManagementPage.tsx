import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Shield } from "lucide-react";
import { toast } from "sonner";

interface UserWithRole {
  user_id: string;
  full_name: string | null;
  entity: string;
  role: string;
  approved: boolean;
  requested_role: string | null;
  avatar_url: string | null;
}

export default function UserManagementPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useT();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const isDirector = profile?.role === "director";

  useEffect(() => {
    if (!isDirector) {
      navigate("/");
      return;
    }
    fetchUsers();
  }, [isDirector]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, entity, role, approved, requested_role, avatar_url")
      .eq("entity", profile?.entity || "")
      .order("created_at", { ascending: false });
    if (data) setUsers(data as UserWithRole[]);
    setLoading(false);
  };

  const handleApprove = async (userId: string, requestedRole: string) => {
    await supabase.from("profiles").update({
      approved: true,
      role: requestedRole as any,
      requested_role: null,
    }).eq("user_id", userId);

    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role: requestedRole as any });

    await supabase.from("notifications").insert({
      user_id: userId,
      title: t("Sol·licitud aprovada"),
      body: t("Has estat aprovat/da com a") + " " + t(requestedRole === "tecnic" ? "Tècnic" : requestedRole === "director" ? "Director" : "Visitant"),
      type: "approval",
      link: "/",
    });

    toast.success(t("Usuari aprovat!"));
    fetchUsers();
  };

  const handleReject = async (userId: string) => {
    await supabase.from("profiles").update({
      approved: true,
      role: "visitant" as any,
      requested_role: null,
    }).eq("user_id", userId);

    await supabase.from("notifications").insert({
      user_id: userId,
      title: t("Sol·licitud rebutjada"),
      body: t("La teva sol·licitud de rol ha estat rebutjada. Tens accés com a visitant."),
      type: "approval",
      link: "/",
    });

    toast.success(t("Sol·licitud rebutjada"));
    fetchUsers();
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    await supabase.from("profiles").update({ role: newRole as any }).eq("user_id", userId);
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });

    toast.success(t("Rol actualitzat!"));
    fetchUsers();
  };

  const pendingUsers = users.filter(u => !u.approved && u.requested_role);
  const approvedUsers = users.filter(u => u.approved);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-serif font-bold">{t("Administrar usuaris")}</h1>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-6 animate-fade-in">
        {pendingUsers.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Badge variant="destructive">{pendingUsers.length}</Badge>
              {t("Sol·licituds pendents")}
            </h2>
            <div className="space-y-3">
              {pendingUsers.map(u => (
                <Card key={u.user_id} className="border-orange-300 dark:border-orange-700">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{u.full_name || t("usuari")}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("Vol ser:")} <Badge variant="outline">{t(u.requested_role === "tecnic" ? "Tècnic" : u.requested_role === "director" ? "Director" : "Visitant")}</Badge>
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="default" onClick={() => handleApprove(u.user_id, u.requested_role!)}>
                        <Check className="h-4 w-4 mr-1" /> {t("Acceptar")}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(u.user_id)}>
                        <X className="h-4 w-4 mr-1" /> {t("Rebutjar")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold mb-3">{t("Usuaris de l'entitat")}</h2>
          {loading ? (
            <p className="text-muted-foreground">{t("Carregant...")}</p>
          ) : approvedUsers.length === 0 ? (
            <p className="text-muted-foreground">{t("Cap usuari trobat")}</p>
          ) : (
            <div className="space-y-3">
              {approvedUsers.map(u => (
                <Card key={u.user_id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{u.full_name || t("usuari")}</p>
                      <Badge variant="secondary" className="mt-1">
                        {t(u.role === "tecnic" ? "Tècnic" : u.role === "director" ? "Director" : "Visitant")}
                      </Badge>
                    </div>
                    {u.user_id !== profile?.user_id && (
                      <Select value={u.role} onValueChange={(v) => handleChangeRole(u.user_id, v)}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tecnic">{t("Tècnic")}</SelectItem>
                          <SelectItem value="director">{t("Director")}</SelectItem>
                          <SelectItem value="visitant">{t("Visitant")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
