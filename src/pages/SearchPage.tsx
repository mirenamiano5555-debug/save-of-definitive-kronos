import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Search as SearchIcon, Mountain, Layers, Box } from "lucide-react";

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("objectes");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageBustKey, setImageBustKey] = useState(Date.now());

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const q = `%${query}%`;

    let data: any[] = [];
    if (tab === "objectes") {
      const { data: d } = await supabase
        .from("objectes")
        .select("*, jaciments(name), ues(codi_ue)")
        .or(`name.ilike.${q},object_id.ilike.${q},tipus.ilike.${q},persona_registra.ilike.${q},estacio_gps.ilike.${q}`)
        .limit(50);
      data = d || [];
    } else if (tab === "jaciments") {
      const { data: d } = await supabase
        .from("jaciments")
        .select("*")
        .or(`name.ilike.${q},period.ilike.${q},description.ilike.${q},entity.ilike.${q}`)
        .limit(50);
      data = d || [];
    } else {
      const { data: d } = await supabase
        .from("ues")
        .select("*,jaciments(name)")
        .or(`codi_ue.ilike.${q},descripcio.ilike.${q},zona.ilike.${q},campanya.ilike.${q},sector.ilike.${q},cronologia.ilike.${q},interpretacio.ilike.${q},terme_municipal.ilike.${q},comarca.ilike.${q}`)
        .limit(50);
      data = d || [];
    }

    setResults(data);
    setImageBustKey(Date.now());
    setLoading(false);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query.trim()) doSearch();
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, tab]);

  const getItemName = (item: any) => {
    if (tab === "objectes") return item.name || "Objecte sense nom";
    if (tab === "jaciments") return item.name || "Jaciment sense nom";
    return item.codi_ue || `UE ${item.id.slice(0, 8)}`;
  };

  const getItemId = (item: any) => {
    if (tab === "objectes") return item.object_id || item.id;
    if (tab === "jaciments") return item.id;
    return item.codi_ue || item.id;
  };

  const getItemRoute = (item: any) => {
    if (tab === "objectes") return `/objecte/${item.id}`;
    if (tab === "jaciments") return `/jaciment/${item.id}`;
    return `/ue/${item.id}`;
  };

  const getImageSrc = (imageUrl: string | null) => {
    if (!imageUrl) return null;
    const separator = imageUrl.includes("?") ? "&" : "?";
    return `${imageUrl}${separator}v=${imageBustKey}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold">Buscar</h1>
      </header>

      <div className="p-4 space-y-4 animate-fade-in">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nom, ID, lloc..."
            className="pl-10"
          />
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setResults([]);
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="objectes" className="flex-1 gap-1">
              <Box className="h-3 w-3" /> Objectes
            </TabsTrigger>
            <TabsTrigger value="jaciments" className="flex-1 gap-1">
              <Mountain className="h-3 w-3" /> Jaciments
            </TabsTrigger>
            <TabsTrigger value="ues" className="flex-1 gap-1">
              <Layers className="h-3 w-3" /> UEs
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="space-y-3 mt-4">
            {loading && <p className="text-center text-muted-foreground">Cercant...</p>}
            {!loading && results.length === 0 && query && (
              <p className="text-center text-muted-foreground">Cap resultat trobat</p>
            )}

            {results.map((item) => {
              const imageSrc = getImageSrc(item.image_url);
              const itemName = getItemName(item);
              const itemId = getItemId(item);

              return (
                <button
                  key={item.id}
                  onClick={() => navigate(getItemRoute(item))}
                  className="w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50 flex items-center gap-3"
                >
                  <div className="h-16 w-16 rounded-md bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={`Imatge de ${itemName}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground text-center px-1">Sense imatge</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="font-medium truncate">{itemName}</p>
                    <p className="text-xs text-muted-foreground truncate">ID: {itemId}</p>
                  </div>
                </button>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

