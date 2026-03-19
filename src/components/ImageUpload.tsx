import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Image, X } from "lucide-react";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  folder?: string;
  multiple?: boolean;
}

export default function ImageUpload({ value, onChange, label = "Imatge", folder = "general", multiple = false }: ImageUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const images = multiple && value ? value.split(",").map(s => s.trim()).filter(Boolean) : value ? [value] : [];

  const uploadFile = async (file: File) => {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await supabase.storage.from("images").upload(path, file);
    if (error) { console.error(error); return null; }
    const { data } = supabase.storage.from("images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setUploading(true);

    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadFile(file);
      if (url) urls.push(url);
    }

    if (multiple) {
      const all = [...images, ...urls];
      onChange(all.join(", "));
    } else {
      if (urls[0]) onChange(urls[0]);
    }
    setUploading(false);
    if (e.target) e.target.value = "";
  };

  const removeImage = (idx: number) => {
    if (multiple) {
      const updated = images.filter((_, i) => i !== idx);
      onChange(updated.join(", "));
    } else {
      onChange("");
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      {images.length > 0 && (
        <div className={`mt-2 gap-2 ${multiple ? "grid grid-cols-2" : ""}`}>
          {images.map((img, idx) => (
            <div key={idx} className="relative rounded-lg overflow-hidden border border-border">
              <img src={img} alt="Preview" className="w-full h-48 object-cover" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => removeImage(idx)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {(multiple || images.length === 0) && (
        <div className="flex gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-24 border-dashed flex flex-col gap-1"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Image className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground text-xs">
              {uploading ? "Pujant..." : "Galeria"}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-24 border-dashed flex flex-col gap-1"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground text-xs">
              {uploading ? "Pujant..." : "Càmera"}
            </span>
          </Button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={handleUpload} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />
    </div>
  );
}
