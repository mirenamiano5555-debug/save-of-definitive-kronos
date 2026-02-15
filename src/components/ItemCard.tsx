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

export default function ItemCard({ item, type }: ItemCardProps) {
  const navigate = useNavigate();

  const getTitle = () => {
    if (type === "objectes") return item.name;
    if (type === "jaciments") return item.name;
    return item.codi_ue || `UE ${item.id.slice(0, 8)}`;
  };

  const getSubtitle = () => {
    if (type === "objectes") return item.jaciments?.name || "Jaciment";
    if (type === "jaciments") return item.period || "";
    return item.jaciments?.name || "";
  };

  const getSecondary = () => {
    if (type === "objectes") return `ID: ${item.object_id}`;
    return "";
  };

  const handleClick = () => {
    if (type === "objectes") navigate(`/objecte/${item.id}`);
    else if (type === "jaciments") navigate(`/jaciment/${item.id}`);
    else navigate(`/ue/${item.id}`);
  };

  const Icon = type === "objectes" ? Box : type === "jaciments" ? Mountain : Layers;

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
          <h3 className="font-serif font-semibold truncate">{getTitle()}</h3>
          {getSubtitle() && <p className="text-sm text-muted-foreground truncate">{getSubtitle()}</p>}
          {getSecondary() && <p className="text-xs text-muted-foreground">{getSecondary()}</p>}
        </div>
        <Badge variant="outline" className="self-start text-xs flex-shrink-0">
          {visibilityLabels[item.visibility] || item.visibility}
        </Badge>
      </CardContent>
    </Card>
  );
}
