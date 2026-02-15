import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, X } from "lucide-react";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  folder?: string;
}

export default function ImageUpload({ value, onChange, label = "Imatge", folder = "general" }: ImageUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${folder}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("images").upload(path, file);
    if (error) {
      console.error(error);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("images").getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  };

  return (
    <div>
      <Label>{label}</Label>
      {value ? (
        <div className="relative mt-2 rounded-lg overflow-hidden border border-border">
          <img src={value} alt="Preview" className="w-full h-48 object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={() => onChange("")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-32 mt-2 border-dashed flex flex-col gap-2"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Camera className="h-6 w-6 text-muted-foreground" />
          <span className="text-muted-foreground text-sm">
            {uploading ? "Pujant..." : "Seleccionar imatge"}
          </span>
        </Button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
}
