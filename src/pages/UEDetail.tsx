import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Trash2, Info, GitBranch, Clock } from "lucide-react";
import { toast } from "sonner";
import ExportButtons from "@/components/ExportButtons";
import StratigraphicAnalysis from "@/components/StratigraphicAnalysis";
import ChangeLog from "@/components/ChangeLog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function UEDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [jacimentName, setJacimentName] = useState("");
  const [tab, setTab] = useState("info");

  useEffect(() => {
    if (!id) return;
    supabase.from("ues").select("*, jaciments(name)").eq("id", id).single().then(({ data }) => {
      if (data) {
        setItem(data);
        setJacimentName((data as any).jaciments?.name || "");
      }
    });
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    const { error } = await supabase.from("ues").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("UE eliminada"); navigate(-1); }
  };

  if (!item) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregant...</div>;
  const isOwner = user?.id === item.created_by;

  const Row = ({ label, value }: { label: string; value: string | null | undefined }) => {
    if (!value) return null;
    return (
      <div className="flex justify-between py-2 border-b border-border">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="text-sm font-medium text-right max-w-[60%]">{value}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-serif font-bold">{item.codi_ue || `UE ${item.id.slice(0, 8)}`}</h1>
            <p className="text-sm text-muted-foreground">{jacimentName}</p>
          </div>
        </div>
        {isOwner && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/edit/ue/${id}`)}>
              <Edit className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar UE?</AlertDialogTitle>
                  <AlertDialogDescription>Aquesta acció no es pot desfer.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </header>

      <div className="animate-fade-in">
        {item.image_url && <img src={item.image_url} alt="" className="w-full h-64 object-cover" />}
        <div className="p-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1 gap-1 text-xs"><Info className="h-3 w-3" /> Info</TabsTrigger>
              <TabsTrigger value="analisi" className="flex-1 gap-1 text-xs"><GitBranch className="h-3 w-3" /> Anàlisi</TabsTrigger>
              <TabsTrigger value="historial" className="flex-1 gap-1 text-xs"><Clock className="h-3 w-3" /> Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-2 mt-4">
              <div className="flex justify-end mb-2">
                <ExportButtons
                  title={item.codi_ue || `UE ${item.id.slice(0, 8)}`}
                  variant="fitxa"
                  type="ue"
                  fields={[
                    { label: "Jaciment", value: jacimentName },
                    { label: "Codi UE", value: item.codi_ue },
                    { label: "Campanya", value: item.campanya },
                    { label: "Terme municipal", value: item.terme_municipal },
                    { label: "Comarca", value: item.comarca },
                    { label: "Zona", value: item.zona },
                    { label: "Sector", value: item.sector },
                    { label: "Àmbit", value: item.ambit },
                    { label: "FET", value: item.fet },
                    { label: "Descripció", value: item.descripcio },
                    { label: "Color", value: item.color },
                    { label: "Consistència", value: item.consistencia },
                    { label: "Igual a", value: item.igual_a },
                    { label: "Tallat per", value: item.tallat_per },
                    { label: "Es recolza a", value: item.es_recolza_a },
                    { label: "Se li recolza", value: item.se_li_recolza },
                    { label: "Talla", value: item.talla },
                    { label: "Reomplert per", value: item.reomplert_per },
                    { label: "Cobert per", value: item.cobert_per },
                    { label: "Reomple a", value: item.reomple_a },
                    { label: "Cobreix a", value: item.cobreix_a },
                    { label: "Interpretació", value: item.interpretacio },
                    { label: "Cronologia", value: item.cronologia },
                    { label: "Criteri", value: item.criteri },
                    { label: "Materials", value: item.materials },
                    { label: "Planta", value: item.planta },
                    { label: "Secció", value: item.seccio },
                    { label: "Fotografia", value: item.fotografia },
                    { label: "Sediment", value: item.sediment },
                    { label: "Carpologia", value: item.carpologia },
                    { label: "Antracologia", value: item.antracologia },
                    { label: "Fauna", value: item.fauna },
                    { label: "Metalls", value: item.metalls },
                    { label: "Observacions", value: item.observacions },
                  ]}
                />
              </div>
              <Row label="Jaciment" value={jacimentName} />
              <Row label="Codi UE" value={item.codi_ue} />
              <Row label="Campanya" value={item.campanya} />
              <Row label="Terme municipal" value={item.terme_municipal} />
              <Row label="Comarca" value={item.comarca} />
              <Row label="Zona" value={item.zona} />
              <Row label="Sector" value={item.sector} />
              <Row label="Àmbit" value={item.ambit} />
              <Row label="FET" value={item.fet} />
              <Row label="Descripció" value={item.descripcio} />
              <Row label="Color" value={item.color} />
              <Row label="Consistència" value={item.consistencia} />
              <Row label="Igual a" value={item.igual_a} />
              <Row label="Tallat per" value={item.tallat_per} />
              <Row label="Es recolza a" value={item.es_recolza_a} />
              <Row label="Se li recolza" value={item.se_li_recolza} />
              <Row label="Talla" value={item.talla} />
              <Row label="Reomplert per" value={item.reomplert_per} />
              <Row label="Cobert per" value={item.cobert_per} />
              <Row label="Reomple a" value={item.reomple_a} />
              <Row label="Cobreix a" value={item.cobreix_a} />
              <Row label="Interpretació" value={item.interpretacio} />
              <Row label="Cronologia" value={item.cronologia} />
              <Row label="Criteri" value={item.criteri} />
              <Row label="Materials" value={item.materials} />
              <Row label="Planta" value={item.planta} />
              <Row label="Secció" value={item.seccio} />
              <Row label="Fotografia" value={item.fotografia} />
              <Row label="Sediment" value={item.sediment} />
              <Row label="Carpologia" value={item.carpologia} />
              <Row label="Antracologia" value={item.antracologia} />
              <Row label="Fauna" value={item.fauna} />
              <Row label="Metalls" value={item.metalls} />
              <Row label="Observacions" value={item.observacions} />
            </TabsContent>

            <TabsContent value="analisi" className="mt-4">
              <StratigraphicAnalysis jacimentId={item.jaciment_id} />
            </TabsContent>

            <TabsContent value="historial" className="mt-4">
              <ChangeLog tableName="ues" recordId={item.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
