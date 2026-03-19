import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch context data for the AI
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get summary of data for context
    const [jacimentsRes, uesRes, objectesRes] = await Promise.all([
      supabase.from("jaciments").select("id, name, period, entity, closed").limit(50),
      supabase.from("ues").select("id, codi_ue, jaciment_id, cronologia, cota_superior, cota_inferior, cobreix_a, cobert_per, talla, tallat_per").limit(200),
      supabase.from("objectes").select("id, name, object_id, jaciment_id, tipus").limit(200),
    ]);

    const jaciments = jacimentsRes.data || [];
    const ues = uesRes.data || [];
    const objectes = objectesRes.data || [];

    const dataContext = `
DADES ACTUALS DE L'APLICACIÓ KRONOS:

JACIMENTS (${jaciments.length}):
${jaciments.map(j => `- ${j.name} (ID: ${j.id}, Període: ${j.period || "N/A"}, Estat: ${j.closed ? "Tancat" : "Obert"})`).join("\n")}

UES (${ues.length}):
${ues.slice(0, 50).map(u => `- ${u.codi_ue || u.id.slice(0, 8)} (Jaciment: ${jaciments.find(j => j.id === u.jaciment_id)?.name || "?"}, Cronologia: ${u.cronologia || "N/A"}, Cota sup: ${u.cota_superior ?? "N/A"}, Cota inf: ${u.cota_inferior ?? "N/A"})`).join("\n")}

OBJECTES (${objectes.length}):
${objectes.slice(0, 50).map(o => `- ${o.name} (${o.object_id}, Tipus: ${o.tipus || "N/A"})`).join("\n")}
`;

    const systemPrompt = `Ets l'assistent IA de Kronos, una aplicació de documentació arqueològica professional en català.

CAPACITATS:
- Consultar i explicar dades de jaciments, unitats estratigràfiques (UEs) i objectes
- Ajudar a interpretar relacions estratigràfiques
- Donar consells sobre bones pràctiques en documentació arqueològica
- Proporcionar enllaços a fitxes específiques (format: /jaciment/ID, /ue/ID, /objecte/ID)
- Ajudar a entendre la matriu de Harris i les relacions entre UEs
- Respondre preguntes sobre arqueologia en general

REGLES:
- Respon SEMPRE en català
- Sigues concís però informatiu
- Quan referencïis elements, proporciona l'enllaç directe
- Si l'usuari demana crear o modificar registres, explica-li com fer-ho manualment a l'app
- Utilitza format markdown per organitzar les respostes

${dataContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
