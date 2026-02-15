import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Box, Layers, Mountain } from "lucide-react";
import ItemCard from "@/components/ItemCard";

export default function MyItemsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState("objectes");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    if (!user) return;
    setLoading(true);
    let data: any[] = [];

    if (tab === "objectes") {
      const { data: d } = await supabase.from("objectes").select("*, jaciments(name)").eq("created_by", user.id).order("created_at", { ascending: false });
      data = d || [];
    } else if (tab === "jaciments") {
      const { data: d } = await supabase.from("jaciments").select("*").eq("created_by", user.id).order("created_at", { ascending: false });
      data = d || [];
    } else {
      const { data: d } = await supabase.from("ues").select("*, jaciments(name)").eq("created_by", user.id).order("created_at", { ascending: false });
      data = d || [];
    }

    setItems(data);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [tab, user]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold">Els meus ítems</h1>
      </header>

      <div className="p-4 animate-fade-in">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="objectes" className="flex-1 gap-1"><Box className="h-3 w-3" /> Objectes</TabsTrigger>
            <TabsTrigger value="ues" className="flex-1 gap-1"><Layers className="h-3 w-3" /> UEs</TabsTrigger>
            <TabsTrigger value="jaciments" className="flex-1 gap-1"><Mountain className="h-3 w-3" /> Jaciments</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="space-y-3 mt-4">
            {loading && <p className="text-center text-muted-foreground">Carregant...</p>}
            {!loading && items.length === 0 && <p className="text-center text-muted-foreground">Encara no tens {tab}</p>}
            {items.map((item) => (
              <ItemCard key={item.id} item={item} type={tab as any} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
