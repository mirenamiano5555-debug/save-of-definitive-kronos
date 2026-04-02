import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import ImageUpload from "@/components/ImageUpload";
import TemplateManager from "@/components/TemplateManager";

interface Jaciment { id: string; name: string; }
interface UE { id: string; codi_ue: string | null; jaciment_id: string; }

export default function ObjecteForm({ editId }: { editId?: string }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useT();

  if (profile?.role === "visitant") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">{t("No tens permisos per pujar contingut.")}</p>
          <Button variant="outline" onClick={() => navigate(-1)}>{t("Tornar")}</Button>
        </div>
      </div>
    );
  }
  const [loading, setLoading] = useState(false);
  const [jaciments, setJaciments] = useState<Jaciment[]>([]);
  const [ues, setUes] = useState<UE[]>([]);
  const [filteredUes, setFilteredUes] = useState<UE[]>([]);

  const [objectId, setObjectId] = useState("");
  const [name, setName] = useState("");
  const [jacimentId, setJacimentId] = useState("");
  const [ueId, setUeId] = useState("");
  const [dataDescobriment, setDataDescobriment] = useState("");
  const [dataOrigen, setDataOrigen] = useState("");
  const [estacioGps, setEstacioGps] = useState("");
  const [codiNivell, setCodiNivell] = useState("");
  const [subunitat, setSubunitat] = useState("");
  const [tipus, setTipus] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [personaRegistra, setPersonaRegistra] = useState("");
  const [midaX, setMidaX] = useState("");
  const [midaY, setMidaY] = useState("");
  const [altresNums, setAltresNums] = useState("");
  const [estatConservacio, setEstatConservacio] = useState("3");
  const [visibility, setVisibility] = useState<string>("public");

  useEffect(() => {
    supabase.from("jaciments").select("id, name").then(({ data }) => { if (data) setJaciments(data); });
    supabase.from("ues").select("id, codi_ue, jaciment_id").then(({ data }) => { if (data) setUes(data); });
  }, []);

  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    setFilteredUes(ues.filter((u) => u.jaciment_id === jacimentId));
    if (initialLoaded) setUeId("");
  }, [jacimentId, ues]);

  useEffect(() => {
    if (editId) {
      supabase.from("objectes").select("*").eq("id", editId).single().then(({ data }) => {
        if (data) {
          const rawId = data.object_id || "";
          setObjectId(rawId.startsWith("MMP") ? rawId.replace(/^MMP/, "") : rawId);
          setName(data.name); setJacimentId(data.jaciment_id);
          setTimeout(() => { setUeId(data.ue_id || ""); setInitialLoaded(true); }, 200);
          setDataDescobriment(data.data_descobriment || ""); setDataOrigen(data.data_origen || "");
          setEstacioGps(data.estacio_gps || ""); setCodiNivell(data.codi_nivell || "");
          setSubunitat(data.subunitat || ""); setTipus(data.tipus || ""); setImageUrl(data.image_url || "");
          setPersonaRegistra(data.persona_registra || ""); setMidaX(data.mida_x?.toString() || "");
          setMidaY(data.mida_y?.toString() || ""); setAltresNums(data.altres_nums || "");
          setEstatConservacio(data.estat_conservacio?.toString() || "3"); setVisibility(data.visibility);
        }
      });
    } else { setInitialLoaded(true); }
  }, [editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const fullObjectId = "MMP" + objectId;
    if (!jacimentId || !ueId || !objectId || !name || !imageUrl) {
      toast.error(t("Omple tots els camps obligatoris")); return;
    }

    if (!editId) {
      const { data: existing } = await supabase.from("objectes").select("id").eq("object_id", fullObjectId).maybeSingle();
      if (existing) { toast.error(t("Aquest ID ja existeix. Tria'n un altre.")); return; }
    }

    setLoading(true);
    const payload = {
      object_id: fullObjectId, name, jaciment_id: jacimentId, ue_id: ueId,
      data_descobriment: dataDescobriment || null, data_origen: dataOrigen, estacio_gps: estacioGps,
      codi_nivell: codiNivell, subunitat, tipus, image_url: imageUrl, persona_registra: personaRegistra,
      mida_x: midaX ? parseFloat(midaX) : null, mida_y: midaY ? parseFloat(midaY) : null,
      altres_nums: altresNums, estat_conservacio: parseInt(estatConservacio),
      visibility: visibility as any, created_by: user.id,
    };

    let error;
    if (editId) { ({ error } = await supabase.from("objectes").update(payload).eq("id", editId)); }
    else { ({ error } = await supabase.from("objectes").insert(payload)); }

    if (error) toast.error(error.message);
    else { toast.success(editId ? t("Objecte actualitzat!") : t("Objecte creat!")); navigate(-1); }
    setLoading(false);
  };

  const conservacioLabels = [t("Molt dolent"), t("Dolent"), t("Regular"), t("Bo"), t("Molt bo")];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-serif font-bold">{editId ? t("Editar") : t("Nou")} {t("Objecte")}</h1>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-4 pb-24 animate-fade-in">
        <TemplateManager
          type="objecte"
          getCurrentData={() => ({ objectId, name, jacimentId, ueId, dataDescobriment, dataOrigen, estacioGps, codiNivell, subunitat, tipus, imageUrl, personaRegistra, midaX, midaY, altresNums, estatConservacio, visibility })}
          applyData={(d) => {
            if (d.name) setName(d.name); if (d.jacimentId) setJacimentId(d.jacimentId);
            if (d.ueId) setUeId(d.ueId); if (d.dataOrigen) setDataOrigen(d.dataOrigen);
            if (d.estacioGps) setEstacioGps(d.estacioGps); if (d.codiNivell) setCodiNivell(d.codiNivell);
            if (d.subunitat) setSubunitat(d.subunitat); if (d.tipus) setTipus(d.tipus);
            if (d.personaRegistra) setPersonaRegistra(d.personaRegistra);
            if (d.estatConservacio) setEstatConservacio(d.estatConservacio); if (d.visibility) setVisibility(d.visibility);
          }}
        />

        <Accordion type="multiple" defaultValue={["identificacio", "imatge", "dades", "mesures", "config"]} className="space-y-2">
          <AccordionItem value="identificacio">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">{t("Identificació")}</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div>
                <Label>{t("ID únic * (MMP + número)")}</Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-muted-foreground px-2 py-2 bg-muted rounded-l-md border border-r-0 border-input h-10 flex items-center">MMP</span>
                  <Input className="rounded-l-none" value={objectId} onChange={(e) => setObjectId(e.target.value.replace(/\D/g, "").slice(0, 5))} required disabled={!!editId} placeholder="00001" inputMode="numeric" />
                </div>
              </div>
              <div><Label>{t("Nom de l'objecte *")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div>
                <Label>{t("Jaciment *")}</Label>
                <Select value={jacimentId} onValueChange={setJacimentId}>
                  <SelectTrigger><SelectValue placeholder={t("Selecciona un jaciment")} /></SelectTrigger>
                  <SelectContent>{jaciments.map((j) => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Unitat Estratigràfica *")}</Label>
                <Select value={ueId} onValueChange={setUeId}>
                  <SelectTrigger><SelectValue placeholder={t("Selecciona una UE")} /></SelectTrigger>
                  <SelectContent>{filteredUes.map((u) => <SelectItem key={u.id} value={u.id}>{u.codi_ue || u.id.slice(0, 8)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="imatge">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">{t("Imatge")}</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <ImageUpload value={imageUrl} onChange={setImageUrl} label={t("Imatge *")} folder="objectes" />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dades">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">{t("Dades de camp")}</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div><Label>{t("Data descobriment")}</Label><Input type="date" value={dataDescobriment} onChange={(e) => setDataDescobriment(e.target.value)} /></div>
              <div><Label>{t("Data d'origen")}</Label><Input value={dataOrigen} onChange={(e) => setDataOrigen(e.target.value)} /></div>
              <div><Label>{t("Estació o codi GPS")}</Label><Input value={estacioGps} onChange={(e) => setEstacioGps(e.target.value)} /></div>
              <div><Label>{t("Codi nivell o UE")}</Label><Input value={codiNivell} onChange={(e) => setCodiNivell(e.target.value)} /></div>
              <div><Label>{t("Subunitat / tall")}</Label><Input value={subunitat} onChange={(e) => setSubunitat(e.target.value)} /></div>
              <div><Label>{t("Tipus d'objecte")}</Label><Input value={tipus} onChange={(e) => setTipus(e.target.value)} /></div>
              <div><Label>{t("Persona que registra")}</Label><Input value={personaRegistra} onChange={(e) => setPersonaRegistra(e.target.value)} /></div>
              <div><Label>{t("Altres números")}</Label><Input value={altresNums} onChange={(e) => setAltresNums(e.target.value)} /></div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="mesures">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">{t("Mesures i conservació")}</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{t("Mida X (cm)")}</Label><Input type="number" step="0.1" value={midaX} onChange={(e) => setMidaX(e.target.value)} /></div>
                <div><Label>{t("Mida Y (cm)")}</Label><Input type="number" step="0.1" value={midaY} onChange={(e) => setMidaY(e.target.value)} /></div>
              </div>
              <div>
                <Label>{t("Estat de conservació")}</Label>
                <Select value={estatConservacio} onValueChange={setEstatConservacio}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{conservacioLabels.map((lbl, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{lbl}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="config">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">{t("Configuració")}</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div>
                <Label>{t("Visibilitat")}</Label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">{t("Públic")}</SelectItem>
                    <SelectItem value="entitat">{t("Només entitat")}</SelectItem>
                    <SelectItem value="esbos">{t("Esbós")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("Guardant...") : editId ? t("Actualitzar") : t("Crear objecte")}
        </Button>
      </form>
    </div>
  );
}
