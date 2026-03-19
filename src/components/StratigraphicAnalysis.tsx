import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Search, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface Issue {
  type: "circular" | "contradiction" | "duplicate";
  message: string;
  ues: string[];
  suggestion: string;
  fix?: () => Promise<void>;
}

const INVERSE_PAIRS: [string, string][] = [
  ["cobreix_a", "cobert_per"],
  ["talla", "tallat_per"],
  ["reomple_a", "reomplert_per"],
  ["es_recolza_a", "se_li_recolza"],
];

const RELATION_LABELS: Record<string, string> = {
  cobreix_a: "cobreix a", cobert_per: "cobert per", talla: "talla", tallat_per: "tallat per",
  reomple_a: "reomple a", reomplert_per: "reomplert per", es_recolza_a: "es recolza a",
  se_li_recolza: "se li recolza", igual_a: "igual a",
};

const LATER_RELATIONS = ["cobreix_a", "talla", "reomple_a"];
const EARLIER_RELATIONS = ["cobert_per", "tallat_per", "reomplert_per"];

function parseRelations(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

export default function StratigraphicAnalysis({ jacimentId }: { jacimentId: string }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [fixing, setFixing] = useState(false);

  const analyze = async () => {
    setAnalyzing(true);
    const { data: ues } = await supabase
      .from("ues")
      .select("id, codi_ue, cobreix_a, cobert_per, talla, tallat_per, reomple_a, reomplert_per, es_recolza_a, se_li_recolza, igual_a")
      .eq("jaciment_id", jacimentId);

    if (!ues || ues.length === 0) { setIssues([]); setAnalyzed(true); setAnalyzing(false); return; }

    const foundIssues: Issue[] = [];
    const ueMap = new Map(ues.map(ue => [ue.codi_ue || ue.id.slice(0, 8), ue]));
    const laterThan = new Map<string, Set<string>>();
    const allCodes = [...ueMap.keys()];
    allCodes.forEach(code => laterThan.set(code, new Set()));

    for (const ue of ues) {
      const code = ue.codi_ue || ue.id.slice(0, 8);
      for (const rel of LATER_RELATIONS) {
        for (const t of parseRelations((ue as any)[rel])) laterThan.get(code)?.add(t);
      }
      for (const rel of EARLIER_RELATIONS) {
        for (const t of parseRelations((ue as any)[rel])) laterThan.get(t)?.add(code);
      }
    }

    // Cycles
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const cyclePaths: string[][] = [];
    function dfs(node: string, path: string[]) {
      if (inStack.has(node)) { cyclePaths.push(path.slice(path.indexOf(node))); return; }
      if (visited.has(node)) return;
      visited.add(node); inStack.add(node); path.push(node);
      for (const neighbor of laterThan.get(node) || []) dfs(neighbor, [...path]);
      inStack.delete(node);
    }
    for (const code of allCodes) if (!visited.has(code)) dfs(code, []);
    for (const cycle of cyclePaths) {
      foundIssues.push({ type: "circular", message: `Bucle: ${cycle.join(" → ")} → ${cycle[0]}`, ues: cycle, suggestion: `Revisa les relacions per trencar el bucle.` });
    }

    // Contradictions
    for (const ue of ues) {
      const code = ue.codi_ue || ue.id.slice(0, 8);
      for (const [laterRel, earlierRel] of INVERSE_PAIRS) {
        const laterTargets = parseRelations((ue as any)[laterRel]);
        const earlierTargets = parseRelations((ue as any)[earlierRel]);
        for (const t of laterTargets) {
          if (earlierTargets.includes(t)) {
            foundIssues.push({
              type: "contradiction",
              message: `${code} ${RELATION_LABELS[laterRel]} ${t} però també ${RELATION_LABELS[earlierRel]} ${t}`,
              ues: [code, t],
              suggestion: `Elimina una de les dues relacions contradictòries.`,
              fix: async () => {
                // Remove the "earlier" relation to fix contradiction
                const updated = earlierTargets.filter(x => x !== t).join(", ");
                await supabase.from("ues").update({ [earlierRel]: updated || null } as any).eq("id", ue.id);
              }
            });
          }
        }
      }
    }

    // Inverse consistency
    for (const ue of ues) {
      const code = ue.codi_ue || ue.id.slice(0, 8);
      for (const [rel, inverseRel] of INVERSE_PAIRS) {
        const targets = parseRelations((ue as any)[rel]);
        for (const t of targets) {
          const targetUE = ueMap.get(t);
          if (targetUE) {
            const inverseTargets = parseRelations((targetUE as any)[inverseRel]);
            if (!inverseTargets.includes(code)) {
              foundIssues.push({
                type: "duplicate",
                message: `${code} ${RELATION_LABELS[rel]} ${t}, però ${t} no té ${code} com a "${RELATION_LABELS[inverseRel]}"`,
                ues: [code, t],
                suggestion: `Afegeix "${code}" al camp "${RELATION_LABELS[inverseRel]}" de ${t}.`,
                fix: async () => {
                  const newVal = [...inverseTargets, code].join(", ");
                  await supabase.from("ues").update({ [inverseRel]: newVal } as any).eq("id", targetUE.id);
                }
              });
            }
          }
        }
      }
    }

    const unique = foundIssues.filter((issue, i, arr) => arr.findIndex(x => x.message === issue.message) === i);
    setIssues(unique);
    setAnalyzed(true);
    setAnalyzing(false);
    if (unique.length === 0) toast.success("Cap incoherència detectada!");
  };

  const autoCorrectAll = async () => {
    setFixing(true);
    const fixable = issues.filter(i => i.fix);
    for (const issue of fixable) {
      try { await issue.fix!(); } catch (e) { console.error(e); }
    }
    toast.success(`${fixable.length} incoherències corregides!`);
    setFixing(false);
    analyze(); // Re-analyze
  };

  return (
    <div className="space-y-3">
      <Button onClick={analyze} disabled={analyzing} className="w-full">
        <Search className="h-4 w-4 mr-2" />
        {analyzing ? "Analitzant..." : "Analitzar coherència estratigràfica"}
      </Button>

      {analyzed && issues.length === 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <p className="text-sm">Totes les relacions estratigràfiques són coherents.</p>
          </CardContent>
        </Card>
      )}

      {issues.length > 0 && issues.some(i => i.fix) && (
        <Button onClick={autoCorrectAll} disabled={fixing} variant="outline" className="w-full gap-2">
          <Wand2 className="h-4 w-4" />
          {fixing ? "Corregint..." : `Autocorregir ${issues.filter(i => i.fix).length} incoherències`}
        </Button>
      )}

      {issues.map((issue, i) => (
        <Card key={i} className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              {issue.type === "circular" ? "Bucle circular" : issue.type === "contradiction" ? "Contradicció" : "Inconsistència"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <p className="text-sm">{issue.message}</p>
            <p className="text-xs text-muted-foreground italic">{issue.suggestion}</p>
            {issue.fix && (
              <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={async () => {
                await issue.fix!();
                toast.success("Corregit!");
                analyze();
              }}>
                <Wand2 className="h-3 w-3" /> Corregir
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
