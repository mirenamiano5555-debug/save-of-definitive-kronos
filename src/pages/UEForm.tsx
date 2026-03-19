import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import ImageUpload from "@/components/ImageUpload";
import TemplateManager from "@/components/TemplateManager";
import UERelationSelect from "@/components/UERelationSelect";
import SketchPad from "@/components/SketchPad";

interface Jaciment { id: string; name: string; }
interface UEOption { id: string; codi_ue: string | null; }

function Field({ label, value, onChange, textarea, type }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      {textarea ? <Textarea value={value} onChange={e => onChange(e.target.value)} /> : <Input type={type || "text"} value={value} onChange={e => onChange(e.target.value)} />}
    </div>
  );
}

export default function UEForm({ editId }: { editId?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [jaciments, setJaciments] = useState<Jaciment[]>([]);
  const [ueOptions, setUeOptions] = useState<UEOption[]>([]);

  const [jacimentId, setJacimentId] = useState("");
  const [codiUe, setCodiUe] = useState("");
  const [campanya, setCampanya] = useState("");
  const [termeMunicipal, setTermeMunicipal] = useState("");
  const [comarca, setComarca] = useState("");
  const [zona, setZona] = useState("");
  const [sector, setSector] = useState("");
  const [ambit, setAmbit] = useState("");
  const [fet, setFet] = useState("");
  const [descripcio, setDescripcio] = useState("");
  const [color, setColor] = useState("");
  const [consistencia, setConsistencia] = useState("");
  const [igualA, setIgualA] = useState("");
  const [tallatPer, setTallatPer] = useState("");
  const [esRecolzaA, setEsRecolzaA] = useState("");
  const [seLiRecolza, setSeLiRecolza] = useState("");
  const [talla, setTalla] = useState("");
  const [reomplertPer, setReomplertPer] = useState("");
  const [cobertPer, setCobertPer] = useState("");
  const [reompleA, setReompleA] = useState("");
  const [cobreixA, setCobreixA] = useState("");
  const [interpretacio, setInterpretacio] = useState("");
  const [cronologia, setCronologia] = useState("");
  const [criteri, setCriteri] = useState("");
  const [materials, setMaterials] = useState("");
  const [planta, setPlanta] = useState("");
  const [seccio, setSeccio] = useState("");
  const [fotografia, setFotografia] = useState("");
  const [sediment, setSediment] = useState("");
  const [carpologia, setCarpologia] = useState("");
  const [antracologia, setAntracologia] = useState("");
  const [fauna, setFauna] = useState("");
  const [metalls, setMetalls] = useState("");
  const [observacions, setObservacions] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [visibility, setVisibility] = useState<string>("public");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [cotaSuperior, setCotaSuperior] = useState("");
  const [cotaInferior, setCotaInferior] = useState("");
  const [croquisUrl, setCroquisUrl] = useState("");

  useEffect(() => {
    supabase.from("jaciments").select("id, name").then(({ data }) => { if (data) setJaciments(data); });
  }, []);

  const fetchUEOptions = useCallback(async () => {
    if (!jacimentId) { setUeOptions([]); return; }
    const { data } = await supabase.from("ues").select("id, codi_ue").eq("jaciment_id", jacimentId);
    if (data) setUeOptions(data.filter(ue => ue.id !== editId));
  }, [jacimentId, editId]);

  useEffect(() => { fetchUEOptions(); }, [fetchUEOptions]);

  const generateUECode = useCallback(async () => {
    if (!jacimentId || codiUe || editId) return;
    const { data } = await supabase.from("ues").select("codi_ue").eq("jaciment_id", jacimentId);
    const existingNums = (data || [])
      .map(ue => { const match = ue.codi_ue?.match(/^UE-(\d+)$/); return match ? parseInt(match[1]) : 0; })
      .filter(n => n > 0);
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    if (nextNum <= 999) setCodiUe(`UE-${String(nextNum).padStart(3, "0")}`);
  }, [jacimentId, codiUe, editId]);

  useEffect(() => { generateUECode(); }, [generateUECode]);

  useEffect(() => {
    if (editId) {
      supabase.from("ues").select("*").eq("id", editId).single().then(({ data }) => {
        if (data) {
          setJacimentId(data.jaciment_id); setCodiUe(data.codi_ue || ""); setCampanya(data.campanya || "");
          setTermeMunicipal(data.terme_municipal || ""); setComarca(data.comarca || ""); setZona(data.zona || "");
          setSector(data.sector || ""); setAmbit(data.ambit || ""); setFet(data.fet || "");
          setDescripcio(data.descripcio || ""); setColor(data.color || ""); setConsistencia(data.consistencia || "");
          setIgualA(data.igual_a || ""); setTallatPer(data.tallat_per || ""); setEsRecolzaA(data.es_recolza_a || "");
          setSeLiRecolza(data.se_li_recolza || ""); setTalla(data.talla || ""); setReomplertPer(data.reomplert_per || "");
          setCobertPer(data.cobert_per || ""); setReompleA(data.reomple_a || ""); setCobreixA(data.cobreix_a || "");
          setInterpretacio(data.interpretacio || ""); setCronologia(data.cronologia || ""); setCriteri(data.criteri || "");
          setMaterials(data.materials || ""); setPlanta(data.planta || ""); setSeccio(data.seccio || "");
          setFotografia(data.fotografia || ""); setSediment(data.sediment || ""); setCarpologia(data.carpologia || "");
          setAntracologia(data.antracologia || ""); setFauna(data.fauna || ""); setMetalls(data.metalls || "");
          setObservacions(data.observacions || ""); setImageUrl(data.image_url || ""); setVisibility(data.visibility);
          setLatitude(data.latitude); setLongitude(data.longitude);
          setCotaSuperior((data as any).cota_superior?.toString() || "");
          setCotaInferior((data as any).cota_inferior?.toString() || "");
        }
      });
    }
  }, [editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !jacimentId) { toast.error("Selecciona un jaciment"); return; }
    setLoading(true);

    const payload: any = {
      jaciment_id: jacimentId, codi_ue: codiUe, campanya, terme_municipal: termeMunicipal, comarca, zona, sector, ambit, fet,
      descripcio, color, consistencia, igual_a: igualA, tallat_per: tallatPer, es_recolza_a: esRecolzaA,
      se_li_recolza: seLiRecolza, talla, reomplert_per: reomplertPer, cobert_per: cobertPer, reomple_a: reompleA,
      cobreix_a: cobreixA, interpretacio, cronologia, criteri, materials, planta, seccio, fotografia, sediment,
      carpologia, antracologia, fauna, metalls, observacions, image_url: imageUrl || croquisUrl || null,
      visibility: visibility as any, latitude, longitude, created_by: user.id,
      cota_superior: cotaSuperior ? parseFloat(cotaSuperior) : null,
      cota_inferior: cotaInferior ? parseFloat(cotaInferior) : null,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from("ues").update(payload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("ues").insert(payload));
    }

    if (!error) {
      await supabase.from("change_logs").insert({
        table_name: "ues", record_id: editId || "new", user_id: user.id,
        changes: editId ? { action: "update", fields: payload } : { action: "create" },
      } as any);
    }

    if (error) toast.error(error.message);
    else { toast.success(editId ? "UE actualitzada!" : "UE creada!"); navigate(-1); }
    setLoading(false);
  };

  const relationProps = { ueOptions, jacimentId, onUECreated: fetchUEOptions, currentUECode: codiUe };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-serif font-bold">{editId ? "Editar" : "Nova"} Unitat Estratigràfica</h1>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-6 pb-24 animate-fade-in">
        <TemplateManager
          type="ue"
          getCurrentData={() => ({ jacimentId, codiUe, campanya, termeMunicipal, comarca, zona, sector, ambit, fet, descripcio, color, consistencia, igualA, tallatPer, esRecolzaA, seLiRecolza, talla, reomplertPer, cobertPer, reompleA, cobreixA, interpretacio, cronologia, criteri, materials, planta, seccio, fotografia, sediment, carpologia, antracologia, fauna, metalls, observacions, visibility })}
          applyData={(d) => {
            if (d.jacimentId) setJacimentId(d.jacimentId); if (d.codiUe) setCodiUe(d.codiUe);
            if (d.campanya) setCampanya(d.campanya); if (d.termeMunicipal) setTermeMunicipal(d.termeMunicipal);
            if (d.comarca) setComarca(d.comarca); if (d.zona) setZona(d.zona); if (d.sector) setSector(d.sector);
            if (d.ambit) setAmbit(d.ambit); if (d.fet) setFet(d.fet); if (d.descripcio) setDescripcio(d.descripcio);
            if (d.color) setColor(d.color); if (d.consistencia) setConsistencia(d.consistencia);
            if (d.cronologia) setCronologia(d.cronologia); if (d.criteri) setCriteri(d.criteri);
            if (d.visibility) setVisibility(d.visibility);
          }}
        />

        <Accordion type="multiple" defaultValue={["identificacio", "descripcio", "relacions", "cotes", "interpretacio", "documentacio", "croquis", "mostres", "final"]} className="space-y-2">
          <AccordionItem value="identificacio">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">Dades identificatives</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div>
                <Label>Jaciment *</Label>
                <Select value={jacimentId} onValueChange={setJacimentId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un jaciment" /></SelectTrigger>
                  <SelectContent>
                    {jaciments.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Codi UE" value={codiUe} onChange={setCodiUe} />
              <Field label="Campanya" value={campanya} onChange={setCampanya} />
              <Field label="Terme municipal" value={termeMunicipal} onChange={setTermeMunicipal} />
              <Field label="Comarca" value={comarca} onChange={setComarca} />
              <Field label="Zona" value={zona} onChange={setZona} />
              <Field label="Sector" value={sector} onChange={setSector} />
              <Field label="Àmbit" value={ambit} onChange={setAmbit} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="descripcio">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">Descripció</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <Field label="FET" value={fet} onChange={setFet} />
              <Field label="Descripció" value={descripcio} onChange={setDescripcio} textarea />
              <Field label="Color" value={color} onChange={setColor} />
              <Field label="Consistència" value={consistencia} onChange={setConsistencia} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cotes">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">Cotes</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <Field label="Cota superior (m)" value={cotaSuperior} onChange={setCotaSuperior} type="number" />
              <Field label="Cota inferior (m)" value={cotaInferior} onChange={setCotaInferior} type="number" />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="relacions">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">Relacions estratigràfiques</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <UERelationSelect label="Igual a" value={igualA} onChange={setIgualA} fieldName="igual_a" {...relationProps} />
              <UERelationSelect label="Tallat per" value={tallatPer} onChange={setTallatPer} fieldName="tallat_per" {...relationProps} />
              <UERelationSelect label="Es recolza a" value={esRecolzaA} onChange={setEsRecolzaA} fieldName="es_recolza_a" {...relationProps} />
              <UERelationSelect label="Se li recolza" value={seLiRecolza} onChange={setSeLiRecolza} fieldName="se_li_recolza" {...relationProps} />
              <UERelationSelect label="Talla" value={talla} onChange={setTalla} fieldName="talla" {...relationProps} />
              <UERelationSelect label="Reomplert per" value={reomplertPer} onChange={setReomplertPer} fieldName="reomplert_per" {...relationProps} />
              <UERelationSelect label="Cobert per" value={cobertPer} onChange={setCobertPer} fieldName="cobert_per" {...relationProps} />
              <UERelationSelect label="Reomple a" value={reompleA} onChange={setReompleA} fieldName="reomple_a" {...relationProps} />
              <UERelationSelect label="Cobreix a" value={cobreixA} onChange={setCobreixA} fieldName="cobreix_a" {...relationProps} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="interpretacio">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">Interpretació i datació</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <Field label="Interpretació" value={interpretacio} onChange={setInterpretacio} textarea />
              <Field label="Cronologia" value={cronologia} onChange={setCronologia} />
              <Field label="Criteri" value={criteri} onChange={setCriteri} />
              <Field label="Materials" value={materials} onChange={setMaterials} textarea />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="documentacio">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">Documentació</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <Field label="Planta" value={planta} onChange={setPlanta} />
              <Field label="Secció" value={seccio} onChange={setSeccio} />
              <Field label="Fotografia" value={fotografia} onChange={setFotografia} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="croquis">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">Croquis</AccordionTrigger>
            <AccordionContent className="pt-2">
              <SketchPad value={croquisUrl} onChange={setCroquisUrl} folder="croquis" />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="mostres">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">Mostres</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <Field label="Sediment" value={sediment} onChange={setSediment} />
              <Field label="Carpologia" value={carpologia} onChange={setCarpologia} />
              <Field label="Antracologia" value={antracologia} onChange={setAntracologia} />
              <Field label="Fauna" value={fauna} onChange={setFauna} />
              <Field label="Metalls" value={metalls} onChange={setMetalls} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="final">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">Final</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <Field label="Observacions" value={observacions} onChange={setObservacions} textarea />
              <ImageUpload value={imageUrl} onChange={setImageUrl} label="Imatges (opcional)" folder="ues" multiple />
              <div>
                <Label>Visibilitat</Label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Públic</SelectItem>
                    <SelectItem value="entitat">Només entitat</SelectItem>
                    <SelectItem value="esbos">Esbós</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Guardant..." : editId ? "Actualitzar" : "Crear UE"}
        </Button>
      </form>
    </div>
  );
}
