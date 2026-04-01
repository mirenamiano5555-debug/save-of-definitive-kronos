import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user with their token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { messages, conversationId } = await req.json();

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, serviceKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Get context data
    const [jacimentsRes, uesRes, objectesRes] = await Promise.all([
      supabase.from("jaciments").select("id, name, period, entity, closed, latitude, longitude").limit(50),
      supabase.from("ues").select("id, codi_ue, jaciment_id, cronologia, cota_superior, cota_inferior, cobreix_a, cobert_per, talla, tallat_per, descripcio, image_url").limit(200),
      supabase.from("objectes").select("id, name, object_id, jaciment_id, tipus, ue_id, image_url").limit(200),
    ]);

    const jaciments = jacimentsRes.data || [];
    const ues = uesRes.data || [];
    const objectes = objectesRes.data || [];

    const dataContext = `
DADES ACTUALS DE L'APLICACIÓ KRONOS:

JACIMENTS (${jaciments.length}):
${jaciments.map(j => `- ${j.name} (ID: ${j.id}, Període: ${j.period || "N/A"}, Estat: ${j.closed ? "Tancat" : "Obert"}, Coords: ${j.latitude ?? "N/A"},${j.longitude ?? "N/A"})`).join("\n")}

UES (${ues.length}):
${ues.slice(0, 50).map(u => `- ${u.codi_ue || u.id.slice(0, 8)} (ID: ${u.id}, Jaciment: ${jaciments.find(j => j.id === u.jaciment_id)?.name || "?"}, Cronologia: ${u.cronologia || "N/A"}, Cota sup: ${u.cota_superior ?? "N/A"}, Cota inf: ${u.cota_inferior ?? "N/A"})`).join("\n")}

OBJECTES (${objectes.length}):
${objectes.slice(0, 50).map(o => `- ${o.name} (${o.object_id}, ID: ${o.id}, Tipus: ${o.tipus || "N/A"}, Jaciment: ${jaciments.find(j => j.id === o.jaciment_id)?.name || "?"})`).join("\n")}
`;

    const systemPrompt = `Ets l'assistent IA de Kronos, una aplicació de documentació arqueològica professional.
L'ID de l'usuari actual és: ${userId}

CAPACITATS:
- Consultar i explicar dades de jaciments, unitats estratigràfiques (UEs) i objectes
- CREAR nous jaciments, UEs i objectes cridant funcions (tools)
- Ajudar a interpretar relacions estratigràfiques
- Donar consells sobre bones pràctiques en documentació arqueològica
- Proporcionar enllaços a fitxes específiques (format: /jaciment/ID, /ue/ID, /objecte/ID)
- Ajudar a entendre la matriu de Harris i les relacions entre UEs
- Respondre preguntes sobre arqueologia en general
- Processar imatges adjuntes dels usuaris i reconèixer el seu contingut
- Processar PDFs i documents per extreure informació d'UEs i objectes
- Generar dades plausibles per a camps d'ítems si l'usuari ho demana

REGLES IMPORTANTS:
- IDIOMA: Respon SEMPRE en el mateix idioma en què l'usuari t'escriu. Si l'usuari parla en català, respon en català. Si parla en castellà, respon en castellà. Si parla en anglès, respon en anglès. Detecta l'idioma del primer missatge de l'usuari i mantén-lo durant tota la conversa, excepte si l'usuari canvia d'idioma.
- Sigues concís però informatiu
- Quan referencïis elements, proporciona l'enllaç directe
- Utilitza format markdown per organitzar les respostes
- **CONFIRMACIÓ OBLIGATÒRIA**: Abans de crear QUALSEVOL element (jaciment, UE o objecte), has de mostrar un RESUM COMPLET de les dades que crearàs i demanar confirmació explícita a l'usuari amb un missatge com "Vols que creï aquest registre?". NO creis res sense que l'usuari digui explícitament "sí", "confirmo", "endavant", "crea-ho" o similar.
- Si l'usuari t'envia una imatge i et demana que la incloguis com a imatge d'un ítem, pots fer-ho passant la URL de la imatge al camp image_url.
- Si l'usuari et dona un PDF o document amb informació d'una UE o objecte, has d'extreure'n les dades, mostrar un resum i demanar confirmació abans de crear-lo.
- Si l'usuari demana generar dades aleatòries però plausibles, genera-les, mostra-les i demana confirmació.

${dataContext}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "create_jaciment",
          description: "Crea un nou jaciment a la base de dades. IMPORTANT: Demana confirmació a l'usuari ABANS de cridar aquesta funció.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nom del jaciment" },
              period: { type: "string", description: "Període històric" },
              description: { type: "string", description: "Descripció del jaciment" },
              latitude: { type: "number", description: "Latitud" },
              longitude: { type: "number", description: "Longitud" },
              image_url: { type: "string", description: "URL de la imatge del jaciment" },
            },
            required: ["name"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_ue",
          description: "Crea una nova Unitat Estratigràfica (UE). IMPORTANT: Demana confirmació a l'usuari ABANS de cridar aquesta funció.",
          parameters: {
            type: "object",
            properties: {
              jaciment_id: { type: "string", description: "UUID del jaciment (ha de ser un UUID vàlid de la llista de jaciments)" },
              codi_ue: { type: "string", description: "Codi de la UE (ex: UE-001)" },
              descripcio: { type: "string", description: "Descripció" },
              cronologia: { type: "string", description: "Cronologia" },
              cota_superior: { type: "number", description: "Cota superior" },
              cota_inferior: { type: "number", description: "Cota inferior" },
              color: { type: "string", description: "Color del sediment" },
              sediment: { type: "string", description: "Tipus de sediment" },
              interpretacio: { type: "string", description: "Interpretació" },
              image_url: { type: "string", description: "URL de la imatge" },
              cobreix_a: { type: "string", description: "Codi UE que cobreix (relació estratigràfica)" },
              cobert_per: { type: "string", description: "Codi UE que la cobreix (relació estratigràfica)" },
              talla: { type: "string", description: "Codi UE que talla (relació estratigràfica)" },
              tallat_per: { type: "string", description: "Codi UE que la talla (relació estratigràfica)" },
              reomple_a: { type: "string", description: "Codi UE que reomple (relació estratigràfica)" },
              reomplert_per: { type: "string", description: "Codi UE que la reomple (relació estratigràfica)" },
              es_recolza_a: { type: "string", description: "Codi UE on es recolza (relació estratigràfica)" },
              se_li_recolza: { type: "string", description: "Codi UE que s'hi recolza (relació estratigràfica)" },
              igual_a: { type: "string", description: "Codi UE equivalent (relació estratigràfica)" },
            },
            required: ["jaciment_id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_objecte",
          description: "Crea un nou objecte arqueològic. IMPORTANT: Demana confirmació a l'usuari ABANS de cridar aquesta funció.",
          parameters: {
            type: "object",
            properties: {
              jaciment_id: { type: "string", description: "UUID del jaciment" },
              name: { type: "string", description: "Nom de l'objecte" },
              object_id: { type: "string", description: "Identificador de l'objecte (ex: MMP00001)" },
              tipus: { type: "string", description: "Tipus d'objecte" },
              ue_id: { type: "string", description: "UUID de la UE associada" },
              image_url: { type: "string", description: "URL de la imatge de l'objecte" },
            },
            required: ["jaciment_id", "name", "object_id"],
          },
        },
      },
    ];

    // Build messages for AI, handling image content
    const aiMessages: any[] = [{ role: "system", content: systemPrompt }];
    for (const msg of messages) {
      if (msg.image_urls && msg.image_urls.length > 0) {
        const content: any[] = [];
        if (msg.content) content.push({ type: "text", text: msg.content });
        for (const url of msg.image_urls) {
          content.push({ type: "image_url", image_url: { url } });
        }
        aiMessages.push({ role: msg.role, content });
      } else {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        tools,
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

    // Read full stream to detect tool calls
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let toolCalls: any[] = [];
    let fullContent = "";
    let hasToolCalls = false;
    const chunks: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      chunks.push(chunk);
      buffer += chunk;

      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) fullContent += delta.content;
          if (delta?.tool_calls) {
            hasToolCalls = true;
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                while (toolCalls.length <= tc.index) toolCalls.push({ id: "", function: { name: "", arguments: "" } });
                if (tc.id) toolCalls[tc.index].id = tc.id;
                if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name;
                if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
              }
            }
          }
        } catch {}
      }
    }

    // If tool calls detected, execute them and get final response
    if (hasToolCalls && toolCalls.length > 0) {
      const toolResults: any[] = [];
      for (const tc of toolCalls) {
        try {
          const args = JSON.parse(tc.function.arguments);
          const result = await executeToolCall(supabase, userId, tc.function.name, args);
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        } catch (e) {
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: e instanceof Error ? e.message : "Error executant l'acció" }),
          });
        }
      }

      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            ...aiMessages,
            { role: "assistant", content: fullContent || null, tool_calls: toolCalls.map(tc => ({ id: tc.id, type: "function", function: tc.function })) },
            ...toolResults,
          ],
          stream: true,
        }),
      });

      if (!finalResponse.ok) {
        return new Response(JSON.stringify({ error: "AI follow-up error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(finalResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls - return collected stream
    const fullStream = chunks.join("");
    return new Response(fullStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function executeToolCall(supabase: any, userId: string, name: string, args: any) {
  switch (name) {
    case "create_jaciment": {
      const { data, error } = await supabase.from("jaciments").insert({
        created_by: userId,
        name: args.name,
        period: args.period || null,
        description: args.description || null,
        latitude: args.latitude || null,
        longitude: args.longitude || null,
        image_url: args.image_url || null,
      }).select().single();
      if (error) throw new Error(error.message);
      return { success: true, jaciment: data, message: `Jaciment "${data.name}" creat amb èxit. Enllaç: /jaciment/${data.id}` };
    }
    case "create_ue": {
      const insertData: any = {
        created_by: userId,
        jaciment_id: args.jaciment_id,
        codi_ue: args.codi_ue || null,
        descripcio: args.descripcio || null,
        cronologia: args.cronologia || null,
        cota_superior: args.cota_superior ?? null,
        cota_inferior: args.cota_inferior ?? null,
        color: args.color || null,
        sediment: args.sediment || null,
        interpretacio: args.interpretacio || null,
        image_url: args.image_url || null,
      };
      const { data, error } = await supabase.from("ues").insert(insertData).select().single();
      if (error) throw new Error(error.message);
      return { success: true, ue: data, message: `UE "${data.codi_ue || data.id}" creada amb èxit. Enllaç: /ue/${data.id}` };
    }
    case "create_objecte": {
      const { data, error } = await supabase.from("objectes").insert({
        created_by: userId,
        jaciment_id: args.jaciment_id,
        name: args.name,
        object_id: args.object_id,
        tipus: args.tipus || null,
        ue_id: args.ue_id || null,
        image_url: args.image_url || null,
      }).select().single();
      if (error) throw new Error(error.message);
      return { success: true, objecte: data, message: `Objecte "${data.name}" creat amb èxit. Enllaç: /objecte/${data.id}` };
    }
    default:
      throw new Error(`Funció desconeguda: ${name}`);
  }
}
