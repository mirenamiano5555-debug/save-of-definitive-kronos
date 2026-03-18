import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface UEOption {
  id: string;
  codi_ue: string | null;
}

interface UERelationSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  ueOptions: UEOption[];
  onUECreated?: () => void;
  jacimentId: string;
}

export default function UERelationSelect({ label, value, onChange, ueOptions, onUECreated, jacimentId }: UERelationSelectProps) {
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [newUEName, setNewUEName] = useState("");
  const [creating, setCreating] = useState(false);

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

  const createProvisionalUE = async () => {
    if (!newUEName.trim() || !user || !jacimentId) return;
    setCreating(true);
    const { error } = await supabase.from("ues").insert({
      codi_ue: newUEName.trim(),
      jaciment_id: jacimentId,
      created_by: user.id,
      visibility: "esbos" as any,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`UE provisional "${newUEName.trim()}" creada`);
      setNewUEName("");
      setShowCreate(false);
      onUECreated?.();
    }
    setCreating(false);
  };

  return (
    <div>
      <Label>{label}</Label>
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
            onClick={() => toggleUE(ue.codi_ue!)}
          >
            {ue.codi_ue}
          </Badge>
        ))}
        {ueOptions.filter(ue => ue.codi_ue).length === 0 && (
          <span className="text-xs text-muted-foreground">No hi ha UEs al jaciment</span>
        )}
      </div>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Crear UE provisional
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear UE provisional</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Codi UE</Label>
              <Input value={newUEName} onChange={e => setNewUEName(e.target.value)} placeholder="Ex: UE 001" />
            </div>
            <Button onClick={createProvisionalUE} disabled={creating || !newUEName.trim()} className="w-full">
              {creating ? "Creant..." : "Crear"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
