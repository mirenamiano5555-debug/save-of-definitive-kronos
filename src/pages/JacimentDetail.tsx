import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Trash2, QrCode, Info } from "lucide-react";
import { toast } from "sonner";
import ExportButtons from "@/components/ExportButtons";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import JacimentQREditor from "@/components/JacimentQREditor";

export default function JacimentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [tab, setTab] = useState("info");

  useEffect(() => {
    if (!id) return;
    supabase.from("jaciments").select("*").eq("id", id).single().then(({ data }) => {
      if (data) setItem(data);
    });
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    const { error } = await supabase.from("jaciments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Jaciment eliminat"); navigate(-1); }
  };

  if (!item) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregant...</div>;

  const isOwner = user?.id === item.created_by;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-serif font-bold">{item.name}</h1>
        </div>
        {isOwner && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/edit/jaciment/${id}`)}>
              <Edit className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar jaciment?</AlertDialogTitle>
                  <AlertDialogDescription>S'eliminaran totes les UEs i objectes associats.</AlertDialogDescription>
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
        {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-64 object-cover" />}

        <div className="p-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1 gap-1">
                <Info className="h-3 w-3" /> Informació
              </TabsTrigger>
              <TabsTrigger value="qr-editor" className="flex-1 gap-1">
                <QrCode className="h-3 w-3" /> Editor QR
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-2 mt-4">
              <div className="flex justify-end mb-2">
                <ExportButtons
                  title={item.name}
                  fields={[
                    { label: "Període", value: item.period },
                    { label: "Descripció", value: item.description },
                    { label: "Entitat", value: item.entity },
                    { label: "Coordenades", value: item.latitude && item.longitude ? `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}` : undefined },
                    { label: "Visibilitat", value: item.visibility === "public" ? "Públic" : item.visibility === "entitat" ? "Entitat" : "Esbós" },
                  ]}
                />
              </div>
              {item.period && <DetailRow label="Període" value={item.period} />}
              {item.description && <DetailRow label="Descripció" value={item.description} />}
              {item.entity && <DetailRow label="Entitat" value={item.entity} />}
              {item.latitude && item.longitude && (
                <DetailRow label="Coordenades" value={`${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`} />
              )}
              <DetailRow label="Visibilitat" value={item.visibility === "public" ? "Públic" : item.visibility === "entitat" ? "Entitat" : "Esbós"} />
            </TabsContent>

            <TabsContent value="qr-editor" className="mt-4">
              <JacimentQREditor jacimentId={item.id} imageUrl={item.image_url || ""} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-2 border-b border-border">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
