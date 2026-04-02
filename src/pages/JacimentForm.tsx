import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import MapPicker from "@/components/MapPicker";
import ImageUpload from "@/components/ImageUpload";
import TemplateManager from "@/components/TemplateManager";

export default function JacimentForm({ editId }: { editId?: string }) {
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
  const [name, setName] = useState("");
  const [period, setPeriod] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<string>("public");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (editId) {
      supabase.from("jaciments").select("*").eq("id", editId).single().then(({ data }) => {
        if (data) {
          setName(data.name); setPeriod(data.period || ""); setDescription(data.description || "");
          setVisibility(data.visibility); setLat(data.latitude); setLng(data.longitude); setImageUrl(data.image_url || "");
        }
      });
    }
  }, [editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (profile?.role !== "director") { toast.error(t("Només els usuaris amb rol 'director' poden crear jaciments")); return; }
    if (!imageUrl) { toast.error(t("La imatge és obligatòria")); return; }
    setLoading(true);

    const payload = {
      name, period, description, visibility: visibility as any,
      latitude: lat, longitude: lng, image_url: imageUrl,
      entity: profile?.entity || "", created_by: user.id,
    };

    let error;
    if (editId) { ({ error } = await supabase.from("jaciments").update(payload).eq("id", editId)); }
    else { ({ error } = await supabase.from("jaciments").insert(payload)); }

    if (error) toast.error(error.message);
    else { toast.success(editId ? t("Jaciment actualitzat!") : t("Jaciment creat!")); navigate(-1); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-serif font-bold">{editId ? t("Editar") : t("Nou")} {t("Jaciment")}</h1>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-4 pb-24 animate-fade-in">
        <TemplateManager
          type="jaciment"
          getCurrentData={() => ({ name, period, description, visibility, lat, lng, imageUrl })}
          applyData={(d) => {
            if (d.name) setName(d.name); if (d.period) setPeriod(d.period);
            if (d.description) setDescription(d.description); if (d.visibility) setVisibility(d.visibility);
            if (d.lat) setLat(d.lat); if (d.lng) setLng(d.lng); if (d.imageUrl) setImageUrl(d.imageUrl);
          }}
        />

        <Accordion type="multiple" defaultValue={["imatge", "dades", "ubicacio", "config"]} className="space-y-2">
          <AccordionItem value="imatge">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">{t("Imatge")}</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <ImageUpload value={imageUrl} onChange={setImageUrl} label={t("Imatge del jaciment *")} folder="jaciments" />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dades">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">{t("Dades bàsiques")}</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div><Label>{t("Nom del jaciment *")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div><Label>{t("Període històric")}</Label><Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder={t("p.ex. Romà, Medieval...")} /></div>
              <div><Label>{t("Descripció")}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ubicacio">
            <AccordionTrigger className="font-serif text-lg font-semibold text-primary">{t("Ubicació")}</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <MapPicker lat={lat} lng={lng} onLocationChange={(la, ln) => { setLat(la); setLng(ln); }} />
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
          {loading ? t("Guardant...") : editId ? t("Actualitzar") : t("Crear jaciment")}
        </Button>
      </form>
    </div>
  );
}
