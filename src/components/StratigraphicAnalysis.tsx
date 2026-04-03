import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Search, Wand2 } from "lucide-react";
import { toast } from "sonner";

interface Issue {
  type: "circular" | "contradiction" | "duplicate" | "fill_cover";
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
  const { t } = useT();

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
        for (const tgt of parseRelations((ue as any)[rel])) laterThan.get(code)?.add(tgt);
      }
      for (const rel of EARLIER_RELATIONS) {
        for (const tgt of parseRelations((ue as any)[rel])) laterThan.get(tgt)?.add(code);
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
      foundIssues.push({ type: "circular", message: `Bucle: ${cycle.join(" → ")} → ${cycle[0]}`, ues: cycle, suggestion: t("Bucle circular") });
    }

    // Contradictions
    for (const ue of ues) {
      const code = ue.codi_ue || ue.id.slice(0, 8);
      for (const [laterRel, earlierRel] of INVERSE_PAIRS) {
        const laterTargets = parseRelations((ue as any)[laterRel]);
        const earlierTargets = parseRelations((ue as any)[earlierRel]);
        for (const tgt of laterTargets) {
          if (earlierTargets.includes(tgt)) {
            foundIssues.push({
              type: "contradiction",
              message: `${code} ${RELATION_LABELS[laterRel]} ${tgt} → ${RELATION_LABELS[earlierRel]} ${tgt}`,
              ues: [code, tgt],
              suggestion: t("Contradicció"),
              fix: async () => {
                const updated = earlierTargets.filter(x => x !== tgt).join(", ");
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
        for (const tgt of targets) {
          const targetUE = ueMap.get(tgt);
          if (targetUE) {
            const inverseTargets = parseRelations((targetUE as any)[inverseRel]);
            if (!inverseTargets.includes(code)) {
              foundIssues.push({
                type: "duplicate",
                message: `${code} ${RELATION_LABELS[rel]} ${tgt}, ${tgt} ≠ ${RELATION_LABELS[inverseRel]} ${code}`,
                ues: [code, tgt],
                suggestion: t("Inconsistència"),
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

    // NEW: Fill implies covered-by check
    // If UE A fills UE B (A.reomple_a contains B), then A must also be covered by
    // all UEs that cover B (i.e., all UEs in B.cobreix_a should also appear in A.cobert_per)
    for (const ue of ues) {
      const codeA = ue.codi_ue || ue.id.slice(0, 8);
      const fillsTargets = parseRelations(ue.reomple_a);
      const coveredByA = parseRelations(ue.cobert_per);

      for (const filledCode of fillsTargets) {
        const filledUE = ueMap.get(filledCode);
        if (!filledUE) continue;

        // UEs that cover the filled UE (B.cobreix_a → who covers B? Actually we need who covers B = B.cobert_per)
        // Wait: "cobreix_a" means "this UE covers X". So if C.cobreix_a contains B, then C covers B.
        // We need: all UEs that cover B. That means: all C where C.cobreix_a contains B, OR equivalently B.cobert_per.
        const covererCodes = parseRelations(filledUE.cobert_per);

        for (const covererCode of covererCodes) {
          if (covererCode === codeA) continue; // A itself covering B is fine
          if (!coveredByA.includes(covererCode)) {
            const covererUE = ueMap.get(covererCode);
            foundIssues.push({
              type: "fill_cover",
              message: `${codeA} ${t("reomple")} ${filledCode}, ${t("però no està coberta per")} ${covererCode} (${t("que cobreix")} ${filledCode})`,
              ues: [codeA, filledCode, covererCode],
              suggestion: t("Si A reomple B, A ha d'estar coberta per les UEs que cobreixen B"),
              fix: async () => {
                // Add covererCode to A's cobert_per
                const newCoveredBy = [...coveredByA, covererCode].join(", ");
                await supabase.from("ues").update({ cobert_per: newCoveredBy } as any).eq("id", ue.id);
                // Also add A to coverer's cobreix_a if not there
                if (covererUE) {
                  const covererCovers = parseRelations(covererUE.cobreix_a);
                  if (!covererCovers.includes(codeA)) {
                    const newCovers = [...covererCovers, codeA].join(", ");
                    await supabase.from("ues").update({ cobreix_a: newCovers } as any).eq("id", covererUE.id);
                  }
                }
              }
            });
          }
        }
      }
    }

    const unique = foundIssues.filter((issue, i, arr) => arr.findIndex(x => x.message === issue.message) === i);
    setIssues(unique);
    setAnalyzed(true);
    setAnalyzing(false);
    if (unique.length === 0) toast.success(t("Cap incoherència detectada!"));
  };

  const autoCorrectAll = async () => {
    setFixing(true);
    const fixable = issues.filter(i => i.fix);
    for (const issue of fixable) {
      try { await issue.fix!(); } catch (e) { console.error(e); }
    }
    toast.success(`${fixable.length} ${t("incoherències corregides!")}`);
    setFixing(false);
    analyze();
  };

  const issueTypeLabel = (type: string) => {
    if (type === "circular") return t("Bucle circular");
    if (type === "contradiction") return t("Contradicció");
    if (type === "fill_cover") return t("Reompliment sense cobertura");
    return t("Inconsistència");
  };

  return (
    <div className="space-y-3">
      <Button onClick={analyze} disabled={analyzing} className="w-full">
        <Search className="h-4 w-4 mr-2" />
        {analyzing ? t("Analitzant...") : t("Analitzar coherència estratigràfica")}
      </Button>

      {analyzed && issues.length === 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <p className="text-sm">{t("Totes les relacions estratigràfiques són coherents.")}</p>
          </CardContent>
        </Card>
      )}

      {issues.length > 0 && issues.some(i => i.fix) && (
        <Button onClick={autoCorrectAll} disabled={fixing} variant="outline" className="w-full gap-2">
          <Wand2 className="h-4 w-4" />
          {fixing ? t("Corregint...") : `${t("Autocorregir")} ${issues.filter(i => i.fix).length} ${t("incoherències")}`}
        </Button>
      )}

      {issues.map((issue, i) => (
        <Card key={i} className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              {issueTypeLabel(issue.type)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <p className="text-sm">{issue.message}</p>
            <p className="text-xs text-muted-foreground italic">{issue.suggestion}</p>
            {issue.fix && (
              <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={async () => {
                await issue.fix!();
                toast.success(t("Corregit!"));
                analyze();
              }}>
                <Wand2 className="h-3 w-3" /> {t("Corregir")}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
