import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Trash2, QrCode, Info, Layers, Box, Lock, Unlock, GitBranch, FileDown } from "lucide-react";
import { toast } from "sonner";
import ExportButtons from "@/components/ExportButtons";
import ChangeLog from "@/components/ChangeLog";
import StratigraphicAnalysis from "@/components/StratigraphicAnalysis";
import HarrisDiagram2D from "@/components/HarrisDiagram2D";
import HarrisDiagram3D from "@/components/HarrisDiagram3D";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import JacimentQREditor from "@/components/JacimentQREditor";
import MassExport from "@/components/MassExport";
import { Badge } from "@/components/ui/badge";

export default function JacimentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [tab, setTab] = useState("info");
  const [ues, setUes] = useState<any[]>([]);
  const [objectes, setObjectes] = useState<any[]>([]);
  const [harrisView, setHarrisView] = useState<"2d" | "3d">("2d");

  useEffect(() => {
    if (!id) return;
    supabase.from("jaciments").select("*").eq("id", id).single().then(({ data }) => {
      if (data) setItem(data);
    });
    supabase.from("ues").select("*").eq("jaciment_id", id).order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setUes(data);
    });
    supabase.from("objectes").select("*").eq("jaciment_id", id).order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setObjectes(data);
    });
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    const { error } = await supabase.from("jaciments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Jaciment eliminat"); navigate(-1); }
  };

  const toggleClosed = async () => {
    if (!id || !item) return;
    const newClosed = !item.closed;
    const { error } = await supabase.from("jaciments").update({ closed: newClosed } as any).eq("id", id);
    if (error) toast.error(error.message);
    else {
      setItem({ ...item, closed: newClosed });
      toast.success(newClosed ? "Jaciment tancat" : "Jaciment reobert");
      if (newClosed) setTab("harris");
    }
  };

  if (!item) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregant...</div>;

  const isOwner = user?.id === item.created_by;
  const isDirector = profile?.role === "director";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-serif font-bold">{item.name}</h1>
            {item.closed && <Badge variant="secondary" className="text-xs">Tancat</Badge>}
          </div>
        </div>
        <div className="flex gap-1">
          {isDirector && isOwner && (
            <Button variant="ghost" size="icon" onClick={toggleClosed} title={item.closed ? "Reobrir" : "Tancar"}>
              {item.closed ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </Button>
          )}
          {isOwner && !item.closed && (
            <>
              <Button variant="ghost" size="icon" onClick={() => navigate(`/edit/jaciment/${id}`)}>
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar jaciment?</AlertDialogTitle>
                    <AlertDialogDescription>S'eliminaran totes les UEs i objectes associats.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </header>

      <div className="animate-fade-in">
        {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-64 object-cover" />}

        <div className="p-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full flex-wrap h-auto gap-1">
              <TabsTrigger value="info" className="flex-1 gap-1 text-xs">
                <Info className="h-3 w-3" /> Info
              </TabsTrigger>
              <TabsTrigger value="ues" className="flex-1 gap-1 text-xs">
                <Layers className="h-3 w-3" /> UEs ({ues.length})
              </TabsTrigger>
              <TabsTrigger value="objectes" className="flex-1 gap-1 text-xs">
                <Box className="h-3 w-3" /> Obj ({objectes.length})
              </TabsTrigger>
              <TabsTrigger value="harris" className="flex-1 gap-1 text-xs">
                <GitBranch className="h-3 w-3" /> Harris
              </TabsTrigger>
              <TabsTrigger value="qr-editor" className="flex-1 gap-1 text-xs">
                <QrCode className="h-3 w-3" /> QR
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-2 mt-4">
              <div className="flex justify-end mb-2">
                <ExportButtons
                  title={item.name}
                  variant="fitxa"
                  type="jaciment"
                  fields={[
                    { label: "Nom", value: item.name },
                    { label: "Període", value: item.period },
                    { label: "Descripció", value: item.description },
                    { label: "Entitat", value: item.entity },
                    { label: "Coordenades", value: item.latitude && item.longitude ? `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}` : undefined },
                    { label: "Visibilitat", value: item.visibility === "public" ? "Públic" : item.visibility === "entitat" ? "Entitat" : "Esbós" },
                  ]}
                />
              </div>
              {item.period && <DetailRow label="Període" value={item.period} />}
              {item.description && <DetailRow label="Descripció" value={item.description} />}
              {item.entity && <DetailRow label="Entitat" value={item.entity} />}
              {item.latitude && item.longitude && (
                <DetailRow label="Coordenades" value={`${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`} />
              )}
              <DetailRow label="Visibilitat" value={item.visibility === "public" ? "Públic" : item.visibility === "entitat" ? "Entitat" : "Esbós"} />
              <DetailRow label="Estat" value={item.closed ? "Tancat" : "Obert"} />

              <div className="pt-4">
                <h3 className="font-serif font-semibold text-sm mb-2">Historial de canvis</h3>
                <ChangeLog tableName="jaciments" recordId={item.id} />
              </div>
            </TabsContent>

            <TabsContent value="ues" className="space-y-2 mt-4">
              <div className="space-y-3">
                <StratigraphicAnalysis jacimentId={item.id} />
                {ues.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Cap UE registrada</p>}
                {ues.map(ue => (
                  <button
                    key={ue.id}
                    onClick={() => navigate(`/ue/${ue.id}`)}
                    className="w-full rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/50 flex items-center gap-3"
                  >
                    <div className="h-12 w-12 rounded-md bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {ue.image_url ? (
                        <img src={ue.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Layers className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{ue.codi_ue || `UE ${ue.id.slice(0, 8)}`}</p>
                      {ue.cronologia && <p className="text-xs text-muted-foreground">{ue.cronologia}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="objectes" className="space-y-2 mt-4">
              {objectes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Cap objecte registrat</p>}
              {objectes.map(obj => (
                <button
                  key={obj.id}
                  onClick={() => navigate(`/objecte/${obj.id}`)}
                  className="w-full rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/50 flex items-center gap-3"
                >
                  <div className="h-12 w-12 rounded-md bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {obj.image_url ? (
                      <img src={obj.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Box className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{obj.name}</p>
                    <p className="text-xs text-muted-foreground">{obj.object_id}</p>
                  </div>
                </button>
              ))}
            </TabsContent>

            <TabsContent value="exportar" className="mt-4 space-y-3">
              <h3 className="font-serif font-semibold">Exportar tot el jaciment</h3>
              <p className="text-sm text-muted-foreground">Exporta totes les UEs i objectes d'aquest jaciment en un sol PDF.</p>
              <div className="flex gap-2 flex-wrap">
                <MassExport items={ues} type="ues" />
                <MassExport items={objectes} type="objectes" />
              </div>
            </TabsContent>

            <TabsContent value="harris" className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Button size="sm" variant={harrisView === "2d" ? "default" : "outline"} onClick={() => setHarrisView("2d")}>2D</Button>
                <Button size="sm" variant={harrisView === "3d" ? "default" : "outline"} onClick={() => setHarrisView("3d")}>3D</Button>
              </div>
              {harrisView === "2d" ? (
                <HarrisDiagram2D jacimentId={item.id} />
              ) : (
                <HarrisDiagram3D jacimentId={item.id} />
              )}
            </TabsContent>

            <TabsContent value="qr-editor" className="mt-4">
              <JacimentQREditor jacimentId={item.id} imageUrl={item.image_url || ""} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-2 border-b border-border">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
