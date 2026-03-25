import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/contexts/LanguageContext";
import { Clock } from "lucide-react";

interface LogEntry {
  id: string;
  user_id: string;
  changes: any;
  created_at: string;
  profile?: { full_name: string | null };
}

export default function ChangeLog({ tableName, recordId }: { tableName: string; recordId: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, lang } = useT();

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from("change_logs")
        .select("*")
        .eq("table_name", tableName)
        .eq("record_id", recordId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(d => d.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        setLogs(data.map(d => ({ ...d, profile: profileMap.get(d.user_id) as any })));
      }
      setLoading(false);
    };
    fetchLogs();
  }, [tableName, recordId]);

  const dateLocale = lang === "en" ? "en" : lang === "es" ? "es" : "ca";

  if (loading) return <p className="text-sm text-muted-foreground">{t("Carregant historial...")}</p>;
  if (logs.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">{t("Sense canvis registrats.")}</p>;

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {logs.map(log => {
        const changes = typeof log.changes === "object" ? log.changes : {};
        const changedFields = Object.keys(changes);

        return (
          <div key={log.id} className="border border-border rounded-md p-2 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              <span>{new Date(log.created_at).toLocaleString(dateLocale)}</span>
              <span className="font-medium text-foreground ml-1">
                {log.profile?.full_name || t("Usuari")}
              </span>
            </div>
            {changedFields.length > 0 ? (
              <ul className="space-y-0.5">
                {changedFields.map(field => (
                  <li key={field}>
                    <span className="font-medium">{field}</span>:{" "}
                    <span className="text-muted-foreground line-through">{changes[field]?.old || "—"}</span>{" → "}
                    <span>{changes[field]?.new || "—"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t("Creat")}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
