import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
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
  const { t } = useT();
  const [item, setItem] = useState<any>(null);
  const [jacimentName, setJacimentName] = useState("");
  const [tab, setTab] = useState("info");

  useEffect(() => {
    if (!id) return;
    supabase.from("ues").select("*, jaciments(name)").eq("id", id).single().then(({ data }) => {
      if (data) { setItem(data); setJacimentName((data as any).jaciments?.name || ""); }
    });
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    const { error } = await supabase.from("ues").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t("UE eliminada")); navigate(-1); }
  };

  if (!item) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">{t("Carregant...")}</div>;
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
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-xl font-serif font-bold">{item.codi_ue || `UE ${item.id.slice(0, 8)}`}</h1>
            <p className="text-sm text-muted-foreground">{jacimentName}</p>
          </div>
        </div>
        {isOwner && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/edit/ue/${id}`)}><Edit className="h-4 w-4" /></Button>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("Eliminar UE?")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("Aquesta acció no es pot desfer.")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("Cancel·lar")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>{t("Eliminar")}</AlertDialogAction>
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
              <TabsTrigger value="info" className="flex-1 gap-1 text-xs"><Info className="h-3 w-3" /> {t("Info")}</TabsTrigger>
              <TabsTrigger value="analisi" className="flex-1 gap-1 text-xs"><GitBranch className="h-3 w-3" /> {t("Anàlisi")}</TabsTrigger>
              <TabsTrigger value="historial" className="flex-1 gap-1 text-xs"><Clock className="h-3 w-3" /> {t("Historial")}</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-2 mt-4">
              <div className="flex justify-end mb-2">
                <ExportButtons title={item.codi_ue || `UE ${item.id.slice(0, 8)}`} variant="fitxa" type="ue" fields={[
                  { label: t("Jaciment"), value: jacimentName }, { label: t("Codi UE"), value: item.codi_ue },
                  { label: t("Campanya"), value: item.campanya }, { label: t("Terme municipal"), value: item.terme_municipal },
                  { label: t("Comarca"), value: item.comarca }, { label: t("Zona"), value: item.zona },
                  { label: t("Sector"), value: item.sector }, { label: t("Àmbit"), value: item.ambit },
                  { label: t("FET"), value: item.fet }, { label: t("Descripció"), value: item.descripcio },
                  { label: t("Color"), value: item.color }, { label: t("Consistència"), value: item.consistencia },
                  { label: t("Igual a"), value: item.igual_a }, { label: t("Tallat per"), value: item.tallat_per },
                  { label: t("Es recolza a"), value: item.es_recolza_a }, { label: t("Se li recolza"), value: item.se_li_recolza },
                  { label: t("Talla"), value: item.talla }, { label: t("Reomplert per"), value: item.reomplert_per },
                  { label: t("Cobert per"), value: item.cobert_per }, { label: t("Reomple a"), value: item.reomple_a },
                  { label: t("Cobreix a"), value: item.cobreix_a }, { label: t("Interpretació"), value: item.interpretacio },
                  { label: t("Cronologia"), value: item.cronologia }, { label: t("Criteri"), value: item.criteri },
                  { label: t("Materials"), value: item.materials }, { label: t("Planta"), value: item.planta },
                  { label: t("Secció"), value: item.seccio }, { label: t("Fotografia"), value: item.fotografia },
                  { label: t("Sediment"), value: item.sediment }, { label: t("Carpologia"), value: item.carpologia },
                  { label: t("Antracologia"), value: item.antracologia }, { label: t("Fauna"), value: item.fauna },
                  { label: t("Metalls"), value: item.metalls }, { label: t("Observacions"), value: item.observacions },
                  { label: t("Cota superior"), value: item.cota_superior?.toString() },
                  { label: t("Cota inferior"), value: item.cota_inferior?.toString() },
                ]} />
              </div>
              <Row label={t("Jaciment")} value={jacimentName} />
              <Row label={t("Codi UE")} value={item.codi_ue} />
              <Row label={t("Cota superior")} value={item.cota_superior?.toString()} />
              <Row label={t("Cota inferior")} value={item.cota_inferior?.toString()} />
              <Row label={t("Campanya")} value={item.campanya} />
              <Row label={t("Terme municipal")} value={item.terme_municipal} />
              <Row label={t("Comarca")} value={item.comarca} />
              <Row label={t("Zona")} value={item.zona} />
              <Row label={t("Sector")} value={item.sector} />
              <Row label={t("Àmbit")} value={item.ambit} />
              <Row label={t("FET")} value={item.fet} />
              <Row label={t("Descripció")} value={item.descripcio} />
              <Row label={t("Color")} value={item.color} />
              <Row label={t("Consistència")} value={item.consistencia} />
              <Row label={t("Igual a")} value={item.igual_a} />
              <Row label={t("Tallat per")} value={item.tallat_per} />
              <Row label={t("Es recolza a")} value={item.es_recolza_a} />
              <Row label={t("Se li recolza")} value={item.se_li_recolza} />
              <Row label={t("Talla")} value={item.talla} />
              <Row label={t("Reomplert per")} value={item.reomplert_per} />
              <Row label={t("Cobert per")} value={item.cobert_per} />
              <Row label={t("Reomple a")} value={item.reomple_a} />
              <Row label={t("Cobreix a")} value={item.cobreix_a} />
              <Row label={t("Interpretació")} value={item.interpretacio} />
              <Row label={t("Cronologia")} value={item.cronologia} />
              <Row label={t("Criteri")} value={item.criteri} />
              <Row label={t("Materials")} value={item.materials} />
              <Row label={t("Planta")} value={item.planta} />
              <Row label={t("Secció")} value={item.seccio} />
              <Row label={t("Fotografia")} value={item.fotografia} />
              <Row label={t("Sediment")} value={item.sediment} />
              <Row label={t("Carpologia")} value={item.carpologia} />
              <Row label={t("Antracologia")} value={item.antracologia} />
              <Row label={t("Fauna")} value={item.fauna} />
              <Row label={t("Metalls")} value={item.metalls} />
              <Row label={t("Observacions")} value={item.observacions} />
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
