import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type ItemType = Database["public"]["Enums"]["item_type"];

interface TemplateManagerProps {
  type: ItemType;
  getCurrentData: () => Record<string, any>;
  applyData: (data: Record<string, any>) => void;
}

interface Template {
  id: string;
  name: string;
  data: Record<string, any>;
}

export default function TemplateManager({ type, getCurrentData, applyData }: TemplateManagerProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("templates")
      .select("id, name, data")
      .eq("user_id", user.id)
      .eq("type", type);
    if (data) setTemplates(data as Template[]);
  };

  useEffect(() => {
    fetchTemplates();
  }, [user, type]);

  const handleSave = async () => {
    if (!user || !newName.trim()) {
      toast.error("Escriu un nom per la plantilla");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("templates").insert({
      user_id: user.id,
      type,
      name: newName.trim(),
      data: getCurrentData() as any,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Plantilla guardada!");
      setNewName("");
      fetchTemplates();
    }
    setSaving(false);
  };

  const handleLoad = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      applyData(tpl.data);
      toast.success(`Plantilla "${tpl.name}" aplicada`);
    }
  };

  const handleDelete = async (templateId: string) => {
    const { error } = await supabase.from("templates").delete().eq("id", templateId);
    if (error) toast.error(error.message);
    else {
      toast.success("Plantilla eliminada");
      fetchTemplates();
    }
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
      <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
        <FolderOpen className="h-4 w-4" /> Plantilles
      </h4>

      {templates.length > 0 && (
        <div className="space-y-2">
          <Select onValueChange={handleLoad}>
            <SelectTrigger><SelectValue placeholder="Carregar plantilla..." /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-1">
            {templates.map((t) => (
              <Button
                key={t.id}
                variant="ghost"
                size="sm"
                className="text-xs text-destructive h-6"
                onClick={() => handleDelete(t.id)}
              >
                ✕ {t.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Nom de la plantilla"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="text-sm h-8"
        />
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving} className="h-8 gap-1">
          <Save className="h-3 w-3" /> Desar
        </Button>
      </div>
    </div>
  );
}
