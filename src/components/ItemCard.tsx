import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mountain, Layers, Box } from "lucide-react";

interface ItemCardProps {
  item: any;
  type: "objectes" | "jaciments" | "ues";
}

const visibilityLabels: Record<string, string> = {
  public: "Públic",
  entitat: "Entitat",
  esbos: "Esbós",
};

const conservacioLabels = ["Molt dolent", "Dolent", "Regular", "Bo", "Molt bo"];

function DetailLine({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <span className="text-xs text-muted-foreground">
      <span className="font-medium">{label}:</span> {value}
    </span>
  );
}

export default function ItemCard({ item, type }: ItemCardProps) {
  const navigate = useNavigate();

  const getTitle = () => {
    if (type === "objectes") return item.name;
    if (type === "jaciments") return item.name;
    return item.codi_ue || `UE ${item.id.slice(0, 8)}`;
  };

  const handleClick = () => {
    if (type === "objectes") navigate(`/objecte/${item.id}`);
    else if (type === "jaciments") navigate(`/jaciment/${item.id}`);
    else navigate(`/ue/${item.id}`);
  };

  const Icon = type === "objectes" ? Box : type === "jaciments" ? Mountain : Layers;

  const renderObjecteDetails = () => (
    <div className="flex flex-col gap-0.5 mt-1">
      <DetailLine label="ID" value={item.object_id} />
      <DetailLine label="Jaciment" value={item.jaciments?.name} />
      <DetailLine label="UE" value={item.ues?.codi_ue} />
      <DetailLine label="Tipus" value={item.tipus} />
      <DetailLine label="Data" value={item.data_descobriment} />
      <DetailLine label="Origen" value={item.data_origen} />
      <DetailLine label="GPS" value={item.estacio_gps} />
      <DetailLine label="Nivell" value={item.codi_nivell} />
      <DetailLine label="Subunitat" value={item.subunitat} />
      <DetailLine label="Registra" value={item.persona_registra} />
      {item.mida_x && item.mida_y && (
        <DetailLine label="Mides" value={`${item.mida_x} x ${item.mida_y} cm`} />
      )}
      <DetailLine label="Conservació" value={item.estat_conservacio ? conservacioLabels[item.estat_conservacio - 1] : null} />
      <DetailLine label="Altres núms" value={item.altres_nums} />
    </div>
  );

  const renderJacimentDetails = () => (
    <div className="flex flex-col gap-0.5 mt-1">
      <DetailLine label="Període" value={item.period} />
      <DetailLine label="Descripció" value={item.description} />
      {item.latitude && item.longitude && (
        <DetailLine label="Coordenades" value={`${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`} />
      )}
      <DetailLine label="Entitat" value={item.entity} />
    </div>
  );

  const renderUEDetails = () => (
    <div className="flex flex-col gap-0.5 mt-1">
      <DetailLine label="Jaciment" value={item.jaciments?.name} />
      <DetailLine label="Campanya" value={item.campanya} />
      <DetailLine label="Zona" value={item.zona} />
      <DetailLine label="Sector" value={item.sector} />
      <DetailLine label="Àmbit" value={item.ambit} />
      <DetailLine label="FET" value={item.fet} />
      <DetailLine label="Descripció" value={item.descripcio} />
      <DetailLine label="Color" value={item.color} />
      <DetailLine label="Cronologia" value={item.cronologia} />
      <DetailLine label="Interpretació" value={item.interpretacio} />
      <DetailLine label="Observacions" value={item.observacions} />
    </div>
  );

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleClick}>
      <CardContent className="p-3 flex gap-3">
        {item.image_url ? (
          <img src={item.image_url} alt={getTitle()} className="w-16 h-16 rounded-md object-cover flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-serif font-semibold truncate">{getTitle()}</h3>
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {visibilityLabels[item.visibility] || item.visibility}
            </Badge>
          </div>
          {type === "objectes" && renderObjecteDetails()}
          {type === "jaciments" && renderJacimentDetails()}
          {type === "ues" && renderUEDetails()}
        </div>
      </CardContent>
    </Card>
  );
}
