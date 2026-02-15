import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onLocationChange: (lat: number, lng: number) => void;
}

// Fix leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export default function MapPicker({ lat, lng, onLocationChange }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [showMap, setShowMap] = useState(false);

  const getMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocationChange(pos.coords.latitude, pos.coords.longitude);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([pos.coords.latitude, pos.coords.longitude], 15);
        }
      },
      () => alert("No s'ha pogut obtenir la ubicació")
    );
  };

  useEffect(() => {
    if (!showMap || !mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([lat || 41.3851, lng || 2.1734], lat ? 15 : 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    if (lat && lng) {
      markerRef.current = L.marker([lat, lng]).addTo(map);
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat: la, lng: ln } = e.latlng;
      onLocationChange(la, ln);
      if (markerRef.current) markerRef.current.setLatLng([la, ln]);
      else markerRef.current = L.marker([la, ln]).addTo(map);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [showMap]);

  useEffect(() => {
    if (markerRef.current && lat && lng) {
      markerRef.current.setLatLng([lat, lng]);
    }
  }, [lat, lng]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowMap(!showMap)}>
          <MapPin className="h-4 w-4 mr-1" />
          {showMap ? "Amagar mapa" : "Mostrar mapa"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={getMyLocation}>
          <Navigation className="h-4 w-4 mr-1" />
          La meva ubicació
        </Button>
      </div>
      {lat && lng && (
        <p className="text-sm text-muted-foreground">
          Coordenades: {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
      )}
      {showMap && (
        <div ref={mapRef} className="h-64 rounded-lg border border-border" />
      )}
    </div>
  );
}
