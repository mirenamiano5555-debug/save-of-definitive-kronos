import { useState } from "react";
import { useT } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface UEOption { id: string; codi_ue: string | null; }

interface UERelationSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  ueOptions: UEOption[];
  onUECreated?: () => void;
  jacimentId: string;
  fieldName?: string;
  currentUECode?: string;
}

const INVERSE_MAP: Record<string, string> = {
  cobreix_a: "cobert_per", cobert_per: "cobreix_a",
  talla: "tallat_per", tallat_per: "talla",
  reomple_a: "reomplert_per", reomplert_per: "reomple_a",
  es_recolza_a: "se_li_recolza", se_li_recolza: "es_recolza_a",
  igual_a: "igual_a",
};

const LABEL_TO_FIELD: Record<string, string> = {
  "Cobreix a": "cobreix_a", "Cobert per": "cobert_per",
  "Talla": "talla", "Tallat per": "tallat_per",
  "Reomple a": "reomple_a", "Reomplert per": "reomplert_per",
  "Es recolza a": "es_recolza_a", "Se li recolza": "se_li_recolza",
  "Igual a": "igual_a",
};

export default function UERelationSelect({ label, value, onChange, ueOptions, onUECreated, jacimentId, fieldName, currentUECode }: UERelationSelectProps) {
  const { user } = useAuth();
  const { t } = useT();
  const [showCreate, setShowCreate] = useState(false);
  const [newUEName, setNewUEName] = useState("");
  const [creating, setCreating] = useState(false);

  const resolvedFieldName = fieldName || LABEL_TO_FIELD[label];
  const selectedCodes = value ? value.split(",").map(s => s.trim()).filter(Boolean) : [];

  const toggleUE = (code: string) => {
    if (selectedCodes.includes(code)) {
      onChange(selectedCodes.filter(c => c !== code).join(", "));
    } else {
      onChange([...selectedCodes, code].join(", "));
    }
  };

  const removeUE = (code: string) => {
    onChange(selectedCodes.filter(c => c !== code).join(", "));
  };

  const updateInverseRelation = async (targetUECode: string, sourceUECode: string) => {
    if (!resolvedFieldName || !sourceUECode) return;
    const inverseField = INVERSE_MAP[resolvedFieldName];
    if (!inverseField) return;
    const targetUE = ueOptions.find(ue => ue.codi_ue === targetUECode);
    if (!targetUE) return;
    const { data } = await supabase.from("ues").select(inverseField).eq("id", targetUE.id).single();
    if (!data) return;
    const currentInverse = (data as any)[inverseField] || "";
    const codes = currentInverse ? currentInverse.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
    if (!codes.includes(sourceUECode)) {
      codes.push(sourceUECode);
      await supabase.from("ues").update({ [inverseField]: codes.join(", ") } as any).eq("id", targetUE.id);
    }
  };

  const createProvisionalUE = async () => {
    if (!newUEName.trim() || !user || !jacimentId) return;
    setCreating(true);
    const inverseField = resolvedFieldName ? INVERSE_MAP[resolvedFieldName] : undefined;
    const insertData: any = {
      codi_ue: newUEName.trim(),
      jaciment_id: jacimentId,
      created_by: user.id,
      visibility: "esbos" as any,
    };
    if (inverseField && currentUECode) insertData[inverseField] = currentUECode;

    const { error } = await supabase.from("ues").insert(insertData);
    if (error) toast.error(error.message);
    else {
      toast.success(`UE "${newUEName.trim()}" ✓`);
      const newCodes = [...selectedCodes, newUEName.trim()];
      onChange(newCodes.join(", "));
      setNewUEName("");
      setShowCreate(false);
      onUECreated?.();
    }
    setCreating(false);
  };

  return (
    <div>
      <Label>{t(label)}</Label>
      <div className="flex flex-wrap gap-1 mb-2">
        {selectedCodes.map(code => (
          <Badge key={code} variant="secondary" className="gap-1">
            {code}
            <button onClick={() => removeUE(code)} className="ml-1"><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto border border-border rounded-md p-2">
        {ueOptions.filter(ue => ue.codi_ue).map(ue => (
          <Badge
            key={ue.id}
            variant={selectedCodes.includes(ue.codi_ue!) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => {
              toggleUE(ue.codi_ue!);
              if (!selectedCodes.includes(ue.codi_ue!) && currentUECode) {
                updateInverseRelation(ue.codi_ue!, currentUECode);
              }
            }}
          >
            {ue.codi_ue}
          </Badge>
        ))}
        {ueOptions.filter(ue => ue.codi_ue).length === 0 && (
          <span className="text-xs text-muted-foreground">{t("No hi ha UEs al jaciment")}</span>
        )}
      </div>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> {t("Crear UE provisional")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Crear UE provisional")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("Codi UE")}</Label>
              <Input value={newUEName} onChange={e => setNewUEName(e.target.value)} placeholder="Ex: UE-025" />
            </div>
            {resolvedFieldName && currentUECode && (
              <p className="text-xs text-muted-foreground">
                {t("La nova UE tindrà automàticament la relació inversa amb")} {currentUECode}.
              </p>
            )}
            <Button onClick={createProvisionalUE} disabled={creating || !newUEName.trim()} className="w-full">
              {creating ? t("Carregant...") : t("Crear")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
