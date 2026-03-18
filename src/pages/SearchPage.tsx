import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Search as SearchIcon, Mountain, Layers, Box } from "lucide-react";
import AdvancedFilters, { EMPTY_FILTERS, type Filters } from "@/components/AdvancedFilters";
import MassExport from "@/components/MassExport";

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("objectes");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const q = `%${query}%`;
    let data: any[] = [];

    if (tab === "objectes") {
      let qb = supabase.from("objectes").select("*, jaciments(name), ues(codi_ue)")
        .or(`name.ilike.${q},object_id.ilike.${q},tipus.ilike.${q},persona_registra.ilike.${q},estacio_gps.ilike.${q}`);
      if (filters.visibility) qb = qb.eq("visibility", filters.visibility);
      if (filters.tipus) qb = qb.ilike("tipus", `%${filters.tipus}%`);
      if (filters.estatConservacio) qb = qb.eq("estat_conservacio", parseInt(filters.estatConservacio));
      if (filters.dateFrom) qb = qb.gte("created_at", filters.dateFrom);
      if (filters.dateTo) qb = qb.lte("created_at", filters.dateTo + "T23:59:59");
      const { data: d } = await qb.limit(50);
      data = d || [];
    } else if (tab === "jaciments") {
      let qb = supabase.from("jaciments").select("*")
        .or(`name.ilike.${q},period.ilike.${q},description.ilike.${q},entity.ilike.${q}`);
      if (filters.visibility) qb = qb.eq("visibility", filters.visibility);
      if (filters.dateFrom) qb = qb.gte("created_at", filters.dateFrom);
      if (filters.dateTo) qb = qb.lte("created_at", filters.dateTo + "T23:59:59");
      const { data: d } = await qb.limit(50);
      data = d || [];
    } else {
      let qb = supabase.from("ues").select("*,jaciments(name)")
        .or(`codi_ue.ilike.${q},descripcio.ilike.${q},zona.ilike.${q},campanya.ilike.${q},sector.ilike.${q},cronologia.ilike.${q},interpretacio.ilike.${q},terme_municipal.ilike.${q},comarca.ilike.${q}`);
      if (filters.visibility) qb = qb.eq("visibility", filters.visibility);
      if (filters.campanya) qb = qb.ilike("campanya", `%${filters.campanya}%`);
      if (filters.dateFrom) qb = qb.gte("created_at", filters.dateFrom);
      if (filters.dateTo) qb = qb.lte("created_at", filters.dateTo + "T23:59:59");
      const { data: d } = await qb.limit(50);
      data = d || [];
    }

    setResults(data);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => {
    const timeout = setTimeout(() => { if (query.trim()) doSearch(); }, 300);
    return () => clearTimeout(timeout);
  }, [query, tab, filters]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map(r => r.id)));
  };

  const getItemRoute = (item: any) => {
    if (tab === "objectes") return `/objecte/${item.id}`;
    if (tab === "jaciments") return `/jaciment/${item.id}`;
    return `/ue/${item.id}`;
  };

  const getName = (item: any) => {
    if (tab === "objectes") return item.name || "Objecte";
    if (tab === "jaciments") return item.name || "Jaciment";
    return item.codi_ue || `UE ${item.id.slice(0, 8)}`;
  };

  const selectedItems = results.filter(r => selected.has(r.id));

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
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cerca per nom, ID, lloc..." className="pl-10" />
        </div>

        <Tabs value={tab} onValueChange={v => { setTab(v); setResults([]); setSelected(new Set()); }}>
          <TabsList className="w-full">
            <TabsTrigger value="objectes" className="flex-1 gap-1"><Box className="h-3 w-3" /> Objectes</TabsTrigger>
            <TabsTrigger value="jaciments" className="flex-1 gap-1"><Mountain className="h-3 w-3" /> Jaciments</TabsTrigger>
            <TabsTrigger value="ues" className="flex-1 gap-1"><Layers className="h-3 w-3" /> UEs</TabsTrigger>
          </TabsList>

          <div className="mt-3">
            <AdvancedFilters tab={tab} filters={filters} onChange={setFilters} />
          </div>

          {results.length > 0 && (
            <div className="flex items-center justify-between mt-3">
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
                {selected.size === results.length ? "Deseleccionar tot" : "Seleccionar tot"}
              </Button>
              {selected.size > 0 && <MassExport items={selectedItems} type={tab as any} />}
            </div>
          )}

          <TabsContent value={tab} className="space-y-3 mt-2">
            {loading && <p className="text-center text-muted-foreground">Cercant...</p>}
            {!loading && results.length === 0 && query && <p className="text-center text-muted-foreground">Cap resultat trobat</p>}

            {results.map(item => (
              <div key={item.id} className="flex items-center gap-2">
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggleSelect(item.id)}
                />
                <button
                  onClick={() => navigate(getItemRoute(item))}
                  className="flex-1 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50 flex items-center gap-3"
                >
                  <div className="h-12 w-12 rounded-md bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{getName(item)}</p>
                    <p className="text-xs text-muted-foreground truncate">{tab === "objectes" ? item.object_id : item.id.slice(0, 8)}</p>
                  </div>
                </button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
