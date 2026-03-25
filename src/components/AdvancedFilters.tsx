import { useState } from "react";
import { useT } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Filter, ChevronDown } from "lucide-react";

export interface Filters {
  visibility: string;
  dateFrom: string;
  dateTo: string;
  campanya: string;
  estatConservacio: string;
  tipus: string;
}

const EMPTY_FILTERS: Filters = { visibility: "", dateFrom: "", dateTo: "", campanya: "", estatConservacio: "", tipus: "" };

interface Props {
  tab: string;
  filters: Filters;
  onChange: (f: Filters) => void;
}

export default function AdvancedFilters({ tab, filters, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useT();

  const hasActiveFilters = Object.values(filters).some(v => v !== "");

  const reset = () => onChange(EMPTY_FILTERS);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-1">
            <Filter className="h-3 w-3" /> {t("Filtres avançats")}
            {hasActiveFilters && <span className="bg-primary text-primary-foreground text-[10px] rounded-full px-1.5">{t("actius")}</span>}
          </span>
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 border border-border rounded-md p-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">{t("Visibilitat")}</Label>
            <Select value={filters.visibility} onValueChange={v => onChange({ ...filters, visibility: v === "all" ? "" : v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("Totes")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Totes")}</SelectItem>
                <SelectItem value="public">{t("Públic")}</SelectItem>
                <SelectItem value="entitat">{t("Entitat")}</SelectItem>
                <SelectItem value="esbos">{t("Esbós")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tab === "objectes" && (
            <>
              <div>
                <Label className="text-xs">{t("Tipus")}</Label>
                <Input className="h-8 text-xs" placeholder={t("Tipus d'objecte")} value={filters.tipus} onChange={e => onChange({ ...filters, tipus: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t("Conservació")}</Label>
                <Select value={filters.estatConservacio} onValueChange={v => onChange({ ...filters, estatConservacio: v === "all" ? "" : v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("Tots")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("Tots")}</SelectItem>
                    <SelectItem value="1">{t("Molt dolent")}</SelectItem>
                    <SelectItem value="2">{t("Dolent")}</SelectItem>
                    <SelectItem value="3">{t("Regular")}</SelectItem>
                    <SelectItem value="4">{t("Bo")}</SelectItem>
                    <SelectItem value="5">{t("Molt bo")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {tab === "ues" && (
            <div>
              <Label className="text-xs">{t("Campanya")}</Label>
              <Input className="h-8 text-xs" placeholder="Ex: 2024" value={filters.campanya} onChange={e => onChange({ ...filters, campanya: e.target.value })} />
            </div>
          )}

          <div>
            <Label className="text-xs">{t("Data des de")}</Label>
            <Input type="date" className="h-8 text-xs" value={filters.dateFrom} onChange={e => onChange({ ...filters, dateFrom: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">{t("Data fins")}</Label>
            <Input type="date" className="h-8 text-xs" value={filters.dateTo} onChange={e => onChange({ ...filters, dateTo: e.target.value })} />
          </div>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs w-full">
            {t("Esborrar filtres")}
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export { EMPTY_FILTERS };
