import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate auth
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
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { messages, conversationId, action } = await req.json();

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, serviceKey);

    // Handle AI tool actions (create jaciment, UE, objecte)
    if (action) {
      return await handleAction(supabase, userId, action, corsHeaders);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Get context data
    const [jacimentsRes, uesRes, objectesRes] = await Promise.all([
      supabase.from("jaciments").select("id, name, period, entity, closed, latitude, longitude").limit(50),
      supabase.from("ues").select("id, codi_ue, jaciment_id, cronologia, cota_superior, cota_inferior, cobreix_a, cobert_per, talla, tallat_per").limit(200),
      supabase.from("objectes").select("id, name, object_id, jaciment_id, tipus, ue_id").limit(200),
    ]);

    const jaciments = jacimentsRes.data || [];
    const ues = uesRes.data || [];
    const objectes = objectesRes.data || [];

    const dataContext = `
DADES ACTUALS DE L'APLICACIÓ KRONOS:

JACIMENTS (${jaciments.length}):
${jaciments.map(j => `- ${j.name} (ID: ${j.id}, Període: ${j.period || "N/A"}, Estat: ${j.closed ? "Tancat" : "Obert"}, Coords: ${j.latitude ?? "N/A"},${j.longitude ?? "N/A"})`).join("\n")}

UES (${ues.length}):
${ues.slice(0, 50).map(u => `- ${u.codi_ue || u.id.slice(0, 8)} (Jaciment: ${jaciments.find(j => j.id === u.jaciment_id)?.name || "?"}, Cronologia: ${u.cronologia || "N/A"}, Cota sup: ${u.cota_superior ?? "N/A"}, Cota inf: ${u.cota_inferior ?? "N/A"})`).join("\n")}

OBJECTES (${objectes.length}):
${objectes.slice(0, 50).map(o => `- ${o.name} (${o.object_id}, Tipus: ${o.tipus || "N/A"})`).join("\n")}
`;

    const systemPrompt = `Ets l'assistent IA de Kronos, una aplicació de documentació arqueològica professional en català.
L'ID de l'usuari actual és: ${userId}

CAPACITATS:
- Consultar i explicar dades de jaciments, unitats estratigràfiques (UEs) i objectes
- CREAR nous jaciments, UEs i objectes cridant funcions (tools)
- Ajudar a interpretar relacions estratigràfiques
- Donar consells sobre bones pràctiques en documentació arqueològica
- Proporcionar enllaços a fitxes específiques (format: /jaciment/ID, /ue/ID, /objecte/ID)
- Ajudar a entendre la matriu de Harris i les relacions entre UEs
- Respondre preguntes sobre arqueologia en general
- Processar imatges adjuntes dels usuaris

REGLES:
- Respon SEMPRE en català
- Sigues concís però informatiu
- Quan referencïis elements, proporciona l'enllaç directe
- Utilitza format markdown per organitzar les respostes
- Si l'usuari et demana crear un jaciment, UE o objecte, utilitza les funcions (tools) disponibles per fer-ho directament

${dataContext}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "create_jaciment",
          description: "Crea un nou jaciment a la base de dades",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nom del jaciment" },
              period: { type: "string", description: "Període històric" },
              description: { type: "string", description: "Descripció del jaciment" },
              latitude: { type: "number", description: "Latitud" },
              longitude: { type: "number", description: "Longitud" },
            },
            required: ["name"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_ue",
          description: "Crea una nova Unitat Estratigràfica (UE)",
          parameters: {
            type: "object",
            properties: {
              jaciment_id: { type: "string", description: "ID del jaciment" },
              codi_ue: { type: "string", description: "Codi de la UE (ex: UE-001)" },
              descripcio: { type: "string", description: "Descripció" },
              cronologia: { type: "string", description: "Cronologia" },
              cota_superior: { type: "number", description: "Cota superior" },
              cota_inferior: { type: "number", description: "Cota inferior" },
            },
            required: ["jaciment_id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_objecte",
          description: "Crea un nou objecte arqueològic",
          parameters: {
            type: "object",
            properties: {
              jaciment_id: { type: "string", description: "ID del jaciment" },
              name: { type: "string", description: "Nom de l'objecte" },
              object_id: { type: "string", description: "Identificador de l'objecte (ex: OBJ-001)" },
              tipus: { type: "string", description: "Tipus d'objecte" },
              ue_id: { type: "string", description: "ID de la UE associada" },
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

    // We need to handle tool calls - read full response to check for them
    // For streaming, we'll collect and check for tool_calls
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let toolCalls: any[] = [];
    let fullContent = "";
    let hasToolCalls = false;

    // Collect stream to detect tool calls
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

      // Send tool results back to get final response
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

    // No tool calls - reconstruct stream from collected chunks
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
      }).select().single();
      if (error) throw new Error(error.message);
      return { success: true, jaciment: data, message: `Jaciment "${data.name}" creat amb èxit. Enllaç: /jaciment/${data.id}` };
    }
    case "create_ue": {
      const { data, error } = await supabase.from("ues").insert({
        created_by: userId,
        jaciment_id: args.jaciment_id,
        codi_ue: args.codi_ue || null,
        descripcio: args.descripcio || null,
        cronologia: args.cronologia || null,
        cota_superior: args.cota_superior || null,
        cota_inferior: args.cota_inferior || null,
      }).select().single();
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
      }).select().single();
      if (error) throw new Error(error.message);
      return { success: true, objecte: data, message: `Objecte "${data.name}" creat amb èxit. Enllaç: /objecte/${data.id}` };
    }
    default:
      throw new Error(`Funció desconeguda: ${name}`);
  }
}

async function handleAction(supabase: any, userId: string, action: any, corsHeaders: any) {
  try {
    const result = await executeToolCall(supabase, userId, action.type, action.params);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
