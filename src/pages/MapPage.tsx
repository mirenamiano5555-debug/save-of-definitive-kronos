import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface Jaciment {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  period: string | null;
  entity: string | null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const [jaciments, setJaciments] = useState<Jaciment[]>([]);

  useEffect(() => {
    supabase
      .from("jaciments")
      .select("id, name, latitude, longitude, period, entity")
      .eq("visibility", "public")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .then(({ data }) => {
        if (data) setJaciments(data as Jaciment[]);
      });
  }, []);

  const center = jaciments.length > 0
    ? [jaciments.reduce((s, j) => s + j.latitude, 0) / jaciments.length, jaciments.reduce((s, j) => s + j.longitude, 0) / jaciments.length] as [number, number]
    : [41.3851, 2.1734] as [number, number];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold">Mapa de jaciments</h1>
      </header>

      <div className="h-[calc(100vh-57px)]">
        <MapContainer center={center} zoom={7} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {jaciments.map(j => (
            <Marker key={j.id} position={[j.latitude, j.longitude]} icon={defaultIcon}>
              <Popup>
                <div className="space-y-1">
                  <p className="font-bold">{j.name}</p>
                  {j.period && <p className="text-xs">Període: {j.period}</p>}
                  {j.entity && <p className="text-xs">Entitat: {j.entity}</p>}
                  <button
                    className="text-xs text-blue-600 underline"
                    onClick={() => navigate(`/jaciment/${j.id}`)}
                  >
                    Veure fitxa →
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
