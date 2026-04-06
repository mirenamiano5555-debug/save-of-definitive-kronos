import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Shield, Trash2, Ban, Undo2, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserWithRole {
  user_id: string;
  full_name: string | null;
  entity: string;
  role: string;
  approved: boolean;
  requested_role: string | null;
  avatar_url: string | null;
}

interface BannedEmail {
  id: string;
  email: string;
  banned_at: string;
  reason: string | null;
}

const ADMIN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;

export default function UserManagementPage() {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const { t } = useT();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});
  const [bannedEmails, setBannedEmails] = useState<BannedEmail[]>([]);
  const [activeTab, setActiveTab] = useState("users");

  const isAdmin = profile?.role === "admin";
  const isDirector = profile?.role === "director";
  const canManage = isAdmin || isDirector;

  useEffect(() => {
    if (!canManage) { navigate("/"); return; }
    fetchUsers();
    if (isAdmin) { fetchEmails(); fetchBanned(); }
  }, [canManage]);

  const adminCall = async (body: any) => {
    const resp = await fetch(ADMIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body),
    });
    return resp.json();
  };

  const fetchUsers = async () => {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("user_id, full_name, entity, role, approved, requested_role, avatar_url")
      .order("created_at", { ascending: false });
    if (!isAdmin) query = query.eq("entity", profile?.entity || "");
    const { data } = await query;
    if (data) setUsers(data as UserWithRole[]);
    setLoading(false);
  };

  const fetchEmails = async () => {
    const res = await adminCall({ action: "list_users_with_email" });
    if (res.emailMap) setEmailMap(res.emailMap);
  };

  const fetchBanned = async () => {
    const res = await adminCall({ action: "list_banned" });
    if (res.banned) setBannedEmails(res.banned);
  };

  const roleLabel = (r: string) => {
    if (r === "tecnic") return t("Tècnic");
    if (r === "director") return t("Director");
    if (r === "admin") return t("Administrador");
    return t("Visitant");
  };

  const handleApprove = async (userId: string, requestedRole: string) => {
    await supabase.from("profiles").update({
      approved: true, role: requestedRole as any, requested_role: null,
    }).eq("user_id", userId);
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role: requestedRole as any });
    await supabase.from("notifications").insert({
      user_id: userId, title: t("Sol·licitud aprovada"),
      body: t("Has estat aprovat/da com a") + " " + roleLabel(requestedRole),
      type: "approval", link: "/",
    });
    toast.success(t("Usuari aprovat!"));
    fetchUsers();
  };

  const handleReject = async (userId: string, isAlreadyApproved: boolean) => {
    if (isAlreadyApproved) {
      await supabase.from("profiles").update({ requested_role: null }).eq("user_id", userId);
    } else {
      await supabase.from("profiles").update({
        approved: true, role: "visitant" as any, requested_role: null,
      }).eq("user_id", userId);
    }
    await supabase.from("notifications").insert({
      user_id: userId, title: t("Sol·licitud rebutjada"),
      body: t("La teva sol·licitud de rol ha estat rebutjada. Tens accés com a visitant."),
      type: "approval", link: "/",
    });
    toast.success(t("Sol·licitud rebutjada"));
    fetchUsers();
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    if ((newRole === "director" || newRole === "admin") && !isAdmin) {
      toast.error(t("Només els administradors poden assignar aquest rol."));
      return;
    }
    await supabase.from("profiles").update({ role: newRole as any }).eq("user_id", userId);
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
    toast.success(t("Rol actualitzat!"));
    fetchUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    const res = await adminCall({ action: "delete_user", targetUserId: userId });
    if (res.success) {
      toast.success(t("Usuari eliminat"));
      fetchUsers();
    } else {
      toast.error(res.error || "Error");
    }
  };

  const handleBanUser = async (userId: string) => {
    const res = await adminCall({ action: "ban_user", targetUserId: userId });
    if (res.success) {
      toast.success(t("Usuari banejat"));
      fetchUsers();
      fetchBanned();
    } else {
      toast.error(res.error || "Error");
    }
  };

  const handleUnban = async (email: string) => {
    const res = await adminCall({ action: "unban_email", email });
    if (res.success) {
      toast.success(t("Correu desbanejat"));
      fetchBanned();
    } else {
      toast.error(res.error || "Error");
    }
  };

  const pendingUsers = users.filter(u => u.requested_role);
  const approvedUsers = users.filter(u => u.approved && !u.requested_role);

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
        {isAdmin ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="users" className="flex-1">{t("Usuaris")}</TabsTrigger>
              <TabsTrigger value="banned" className="flex-1">{t("Correus banejats")}</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-6 mt-4">
              {renderPending()}
              {renderApproved()}
            </TabsContent>

            <TabsContent value="banned" className="mt-4">
              {bannedEmails.length === 0 ? (
                <p className="text-muted-foreground">{t("Cap correu banejat")}</p>
              ) : (
                <div className="space-y-3">
                  {bannedEmails.map(b => (
                    <Card key={b.id}>
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate flex items-center gap-2">
                            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                            {b.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(b.banned_at).toLocaleDateString()}
                            {b.reason && ` — ${b.reason}`}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleUnban(b.email)}>
                          <Undo2 className="h-4 w-4 mr-1" /> {t("Desbanejat")}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {renderPending()}
            {renderApproved()}
          </>
        )}
      </div>
    </div>
  );

  function renderPending() {
    if (pendingUsers.length === 0) return null;
    return (
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
                  <p className="text-xs text-muted-foreground truncate">{u.entity}</p>
                  {isAdmin && emailMap[u.user_id] && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {emailMap[u.user_id]}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {u.approved && <><Badge variant="secondary" className="mr-1">{roleLabel(u.role)}</Badge> → </>}
                    {t("Vol ser:")} <Badge variant="outline">{roleLabel(u.requested_role || "")}</Badge>
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="default" onClick={() => handleApprove(u.user_id, u.requested_role!)}>
                    <Check className="h-4 w-4 mr-1" /> {t("Acceptar")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReject(u.user_id, u.approved)}>
                    <X className="h-4 w-4 mr-1" /> {t("Rebutjar")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  function renderApproved() {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-3">
          {isAdmin ? t("Tots els usuaris") : t("Usuaris de l'entitat")}
        </h2>
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
                    {isAdmin && <p className="text-xs text-muted-foreground truncate">{u.entity}</p>}
                    {isAdmin && emailMap[u.user_id] && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {emailMap[u.user_id]}
                      </p>
                    )}
                    <Badge variant="secondary" className="mt-1">{roleLabel(u.role)}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.user_id !== profile?.user_id && u.role !== "admin" && (
                      <Select value={u.role} onValueChange={(v) => handleChangeRole(u.user_id, v)}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="visitant">{t("Visitant")}</SelectItem>
                          <SelectItem value="tecnic">{t("Tècnic")}</SelectItem>
                          {isAdmin && <SelectItem value="director">{t("Director")}</SelectItem>}
                          {isAdmin && <SelectItem value="admin">{t("Administrador")}</SelectItem>}
                        </SelectContent>
                      </Select>
                    )}
                    {isAdmin && u.user_id !== profile?.user_id && u.role !== "admin" && (
                      <div className="flex gap-1">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" title={t("Eliminar usuari")}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("Eliminar usuari")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("S'eliminarà el compte però el correu podrà tornar a registrar-se.")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("Cancel·lar")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(u.user_id)}>{t("Eliminar")}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" title={t("Banejar usuari")}>
                              <Ban className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("Banejar usuari")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("S'eliminarà el compte i el correu NO podrà tornar a registrar-se.")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("Cancel·lar")}</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => handleBanUser(u.user_id)}>
                                {t("Banejar")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }
}
