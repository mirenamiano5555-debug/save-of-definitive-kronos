import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Trash2, QrCode, Link as LinkIcon, Copy } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ObjecteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [jacimentName, setJacimentName] = useState("");
  const [ueName, setUeName] = useState("");
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("objectes").select("*, jaciments(name), ues(codi_ue)").eq("id", id).single().then(({ data }) => {
      if (data) {
        setItem(data);
        setJacimentName((data as any).jaciments?.name || "");
        setUeName((data as any).ues?.codi_ue || "");
      }
    });
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    const { error } = await supabase.from("objectes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Objecte eliminat");
      navigate(-1);
    }
  };

  const objectUrl = `${window.location.origin}/objecte/${id}`;
  const conservacioLabels = ["Molt dolent", "Dolent", "Regular", "Bo", "Molt bo"];

  if (!item) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Carregant...</div>;

  const isOwner = user?.id === item.created_by;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-serif font-bold">{item.name}</h1>
            <p className="text-sm text-muted-foreground">{jacimentName}</p>
          </div>
        </div>
        {isOwner && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/edit/objecte/${id}`)}>
              <Edit className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar objecte?</AlertDialogTitle>
                  <AlertDialogDescription>Aquesta acció no es pot desfer.</AlertDialogDescription>
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
        {item.image_url && (
          <img src={item.image_url} alt={item.name} className="w-full h-64 object-cover" />
        )}

        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">ID: {item.object_id}</p>

          {/* QR Section */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowQR(!showQR)}>
              <QrCode className="h-4 w-4 mr-1" /> {showQR ? "Amagar QR" : "Mostrar QR"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(objectUrl); toast.success("Enllaç copiat!"); }}>
              <Copy className="h-4 w-4 mr-1" /> Copiar enllaç
            </Button>
          </div>

          {showQR && (
            <div className="bg-card border border-border rounded-lg p-4 flex flex-col items-center gap-2">
              <QRCodeSVG value={objectUrl} size={200} />
              <p className="text-xs text-muted-foreground break-all">{objectUrl}</p>
            </div>
          )}

          {/* Details */}
          <div className="space-y-2">
            <DetailRow label="Jaciment" value={jacimentName} />
            <DetailRow label="UE" value={ueName} />
            <DetailRow label="Tipus" value={item.tipus} />
            <DetailRow label="Data descobriment" value={item.data_descobriment} />
            <DetailRow label="Data origen" value={item.data_origen} />
            <DetailRow label="Estació GPS" value={item.estacio_gps} />
            <DetailRow label="Codi nivell" value={item.codi_nivell} />
            <DetailRow label="Subunitat" value={item.subunitat} />
            <DetailRow label="Persona registra" value={item.persona_registra} />
            <DetailRow label="Mides" value={item.mida_x && item.mida_y ? `${item.mida_x} x ${item.mida_y} cm` : ""} />
            <DetailRow label="Altres números" value={item.altres_nums} />
            <DetailRow label="Estat conservació" value={item.estat_conservacio ? conservacioLabels[item.estat_conservacio - 1] : ""} />
          </div>
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
