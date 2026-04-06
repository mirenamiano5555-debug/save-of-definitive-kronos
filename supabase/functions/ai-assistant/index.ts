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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { messages, conversationId } = await req.json();

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: userRoles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isVisitant = userRoles?.some((r: any) => r.role === "visitant") && !userRoles?.some((r: any) => r.role === "tecnic" || r.role === "director" || r.role === "admin");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const [jacimentsRes, uesRes, objectesRes] = await Promise.all([
      supabase.from("jaciments").select("id, name, period, entity, closed, latitude, longitude").limit(50),
      supabase.from("ues").select("id, codi_ue, jaciment_id, cronologia, cota_superior, cota_inferior, cobreix_a, cobert_per, talla, tallat_per, reomple_a, reomplert_per, es_recolza_a, se_li_recolza, igual_a, descripcio, image_url, color, sediment, interpretacio").limit(200),
      supabase.from("objectes").select("id, name, object_id, jaciment_id, tipus, ue_id, image_url").limit(200),
    ]);

    const jaciments = jacimentsRes.data || [];
    const ues = uesRes.data || [];
    const objectes = objectesRes.data || [];

    const dataContext = buildDataContext(jaciments, ues, objectes);
    const systemPrompt = buildSystemPrompt(userId, isVisitant, dataContext);
    const tools = isVisitant ? undefined : buildTools();

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
        ...(tools ? { tools } : {}),
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

    if (hasToolCalls && toolCalls.length > 0) {
      const toolResults: any[] = [];
      for (const tc of toolCalls) {
        try {
          const args = JSON.parse(tc.function.arguments);
          const result = await executeToolCall(supabase, userId, tc.function.name, args, userRoles || []);
          toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        } catch (e) {
          toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: e instanceof Error ? e.message : "Error executant l'acció" }) });
        }
      }

      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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
        return new Response(JSON.stringify({ error: "AI follow-up error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(finalResponse.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    return new Response(chunks.join(""), { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function buildDataContext(jaciments: any[], ues: any[], objectes: any[]) {
  return `
DADES ACTUALS DE L'APLICACIÓ KRONOS:

JACIMENTS (${jaciments.length}):
${jaciments.map(j => `- ${j.name} (ID: ${j.id}, Període: ${j.period || "N/A"}, Estat: ${j.closed ? "Tancat" : "Obert"}, Coords: ${j.latitude ?? "N/A"},${j.longitude ?? "N/A"})`).join("\n")}

UES (${ues.length}):
${ues.slice(0, 80).map(u => {
  const jName = jaciments.find(j => j.id === u.jaciment_id)?.name || "?";
  const rels = [
    u.cobreix_a && `cobreix: ${u.cobreix_a}`, u.cobert_per && `cobert per: ${u.cobert_per}`,
    u.talla && `talla: ${u.talla}`, u.tallat_per && `tallat per: ${u.tallat_per}`,
    u.reomple_a && `reomple: ${u.reomple_a}`, u.reomplert_per && `reomplert per: ${u.reomplert_per}`,
    u.es_recolza_a && `es recolza a: ${u.es_recolza_a}`, u.se_li_recolza && `se li recolza: ${u.se_li_recolza}`,
    u.igual_a && `igual a: ${u.igual_a}`,
  ].filter(Boolean).join(", ");
  return `- ${u.codi_ue || u.id.slice(0, 8)} (ID: ${u.id}, Jaciment: ${jName}, Cronologia: ${u.cronologia || "N/A"}, Cota sup: ${u.cota_superior ?? "N/A"}, Cota inf: ${u.cota_inferior ?? "N/A"}${rels ? `, Relacions: ${rels}` : ""})`;
}).join("\n")}

OBJECTES (${objectes.length}):
${objectes.slice(0, 80).map(o => `- ${o.name} (${o.object_id}, ID: ${o.id}, Tipus: ${o.tipus || "N/A"}, Jaciment: ${jaciments.find(j => j.id === o.jaciment_id)?.name || "?"}${o.ue_id ? `, UE: ${ues.find(u => u.id === o.ue_id)?.codi_ue || o.ue_id.slice(0,8)}` : ""})`).join("\n")}
`;
}

function buildSystemPrompt(userId: string, isVisitant: boolean, dataContext: string) {
  return `Ets l'assistent IA de Kronos, una aplicació de documentació arqueològica professional.
L'ID de l'usuari actual és: ${userId}

CAPACITATS:
- Consultar i explicar dades de jaciments, unitats estratigràfiques (UEs) i objectes
- CREAR nous jaciments, UEs i objectes cridant funcions (tools)
- EDITAR jaciments, UEs i objectes existents (actualitzar camps)
- ELIMINAR jaciments, UEs i objectes (amb confirmació explícita)
- Ajudar a interpretar relacions estratigràfiques i la matriu de Harris
- Analitzar la matriu de Harris d'un jaciment i suggerir relacions que podrien faltar
- Donar consells sobre bones pràctiques en documentació arqueològica
- Proporcionar enllaços a fitxes específiques (format: /jaciment/ID, /ue/ID, /objecte/ID)
- Respondre preguntes sobre arqueologia en general
- Processar imatges adjuntes dels usuaris i reconèixer el seu contingut (ceràmica, lítica, fauna, etc.)
- Analitzar imatges de troballes i suggerir tipus, cronologia i classificació
- Processar PDFs i documents per extreure informació d'UEs i objectes. Llegeix la informació visible al text/imatge del PDF.
- Generar dades plausibles per a camps d'ítems si l'usuari ho demana
- Generar un resum complet d'un jaciment (estadístiques, UEs, objectes, cronologies, relacions)
- Fer cerques semàntiques (ex: "quins objectes de ceràmica del segle II hi ha?")

REGLES IMPORTANTS:
- IDIOMA: Respon SEMPRE en el mateix idioma en què l'usuari t'escriu. Si l'usuari parla en català, respon en català. Si parla en castellà, respon en castellà. Si parla en anglès, respon en anglès.
- Sigues concís però informatiu
- Quan referencïis elements, proporciona l'enllaç directe
- Utilitza format markdown per organitzar les respostes
- **CONFIRMACIÓ OBLIGATÒRIA**: Abans de crear, editar o eliminar QUALSEVOL element, mostra un RESUM COMPLET de l'acció i demana confirmació explícita. NO actuïs sense que l'usuari digui "sí", "confirmo", "endavant", "crea-ho", "elimina-ho", "actualitza-ho" o similar.
- Per a ELIMINAR, demana doble confirmació: primer mostra què s'eliminarà, i si l'usuari confirma, torna a preguntar "Estàs segur? Aquesta acció és irreversible."
- Si l'usuari t'envia una imatge i et demana que la incloguis com a imatge d'un ítem, pots fer-ho passant la URL al camp image_url.
- Si l'usuari et dona un PDF, analitza el contingut visible i extreu-ne les dades.
- Si l'usuari demana generar dades aleatòries però plausibles, genera-les, mostra-les i demana confirmació.
- Quan l'usuari demani un resum d'un jaciment, inclou: nombre d'UEs i objectes, cronologies presents, relacions estratigràfiques, possibles incoherències.
- Quan l'usuari demani suggeriments de relacions, analitza les UEs del jaciment i proposa relacions lògiques basades en cotes, cronologia i relacions existents.
${isVisitant ? `
- **RESTRICCIÓ DE VISITANT**: L'usuari actual té rol de VISITANT. NO pots crear, editar ni eliminar cap element. Explica que ha de canviar el seu rol a tècnic o director.` : ""}

${dataContext}`;
}

function buildTools() {
  return [
    {
      type: "function",
      function: {
        name: "create_jaciment",
        description: "Crea un nou jaciment. Demana confirmació ABANS.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" }, period: { type: "string" }, description: { type: "string" },
            latitude: { type: "number" }, longitude: { type: "number" }, image_url: { type: "string" },
          },
          required: ["name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_jaciment",
        description: "Actualitza un jaciment existent. Demana confirmació ABANS.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "UUID del jaciment a actualitzar" },
            name: { type: "string" }, period: { type: "string" }, description: { type: "string" },
            latitude: { type: "number" }, longitude: { type: "number" }, image_url: { type: "string" },
            closed: { type: "boolean" },
          },
          required: ["id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_jaciment",
        description: "Elimina un jaciment. Demana DOBLE confirmació ABANS.",
        parameters: {
          type: "object",
          properties: { id: { type: "string", description: "UUID del jaciment a eliminar" } },
          required: ["id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_ue",
        description: "Crea una nova UE. Demana confirmació ABANS.",
        parameters: {
          type: "object",
          properties: {
            jaciment_id: { type: "string" }, codi_ue: { type: "string" }, descripcio: { type: "string" },
            cronologia: { type: "string" }, cota_superior: { type: "number" }, cota_inferior: { type: "number" },
            color: { type: "string" }, sediment: { type: "string" }, interpretacio: { type: "string" },
            image_url: { type: "string" },
            cobreix_a: { type: "string" }, cobert_per: { type: "string" },
            talla: { type: "string" }, tallat_per: { type: "string" },
            reomple_a: { type: "string" }, reomplert_per: { type: "string" },
            es_recolza_a: { type: "string" }, se_li_recolza: { type: "string" },
            igual_a: { type: "string" },
          },
          required: ["jaciment_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_ue",
        description: "Actualitza una UE existent. Demana confirmació ABANS.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "UUID de la UE a actualitzar" },
            codi_ue: { type: "string" }, descripcio: { type: "string" }, cronologia: { type: "string" },
            cota_superior: { type: "number" }, cota_inferior: { type: "number" },
            color: { type: "string" }, sediment: { type: "string" }, interpretacio: { type: "string" },
            image_url: { type: "string" },
            cobreix_a: { type: "string" }, cobert_per: { type: "string" },
            talla: { type: "string" }, tallat_per: { type: "string" },
            reomple_a: { type: "string" }, reomplert_per: { type: "string" },
            es_recolza_a: { type: "string" }, se_li_recolza: { type: "string" },
            igual_a: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_ue",
        description: "Elimina una UE. Demana DOBLE confirmació ABANS.",
        parameters: {
          type: "object",
          properties: { id: { type: "string", description: "UUID de la UE a eliminar" } },
          required: ["id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_objecte",
        description: "Crea un nou objecte. Demana confirmació ABANS.",
        parameters: {
          type: "object",
          properties: {
            jaciment_id: { type: "string" }, name: { type: "string" }, object_id: { type: "string" },
            tipus: { type: "string" }, ue_id: { type: "string" }, image_url: { type: "string" },
          },
          required: ["jaciment_id", "name", "object_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_objecte",
        description: "Actualitza un objecte existent. Demana confirmació ABANS.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "UUID de l'objecte a actualitzar" },
            name: { type: "string" }, object_id: { type: "string" }, tipus: { type: "string" },
            ue_id: { type: "string" }, image_url: { type: "string" },
          },
          required: ["id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_objecte",
        description: "Elimina un objecte. Demana DOBLE confirmació ABANS.",
        parameters: {
          type: "object",
          properties: { id: { type: "string", description: "UUID de l'objecte a eliminar" } },
          required: ["id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "summarize_jaciment",
        description: "Genera un resum complet d'un jaciment amb estadístiques, UEs, objectes i relacions.",
        parameters: {
          type: "object",
          properties: { jaciment_id: { type: "string", description: "UUID del jaciment" } },
          required: ["jaciment_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "suggest_relations",
        description: "Analitza les UEs d'un jaciment i suggereix relacions estratigràfiques que podrien faltar.",
        parameters: {
          type: "object",
          properties: { jaciment_id: { type: "string", description: "UUID del jaciment" } },
          required: ["jaciment_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_items",
        description: "Cerca semàntica d'ítems per tipus, cronologia, jaciment o qualsevol criteri.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Consulta de cerca (ex: 'ceràmica segle II', 'UEs amb cronologia romana')" },
            item_type: { type: "string", enum: ["jaciment", "ue", "objecte", "all"], description: "Tipus d'ítem a cercar" },
          },
          required: ["query"],
        },
      },
    },
  ];
}

async function uploadImageFromUrl(supabase: any, userId: string, imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;
  // If already a Supabase storage URL, keep it
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  if (imageUrl.includes(supabaseUrl)) return imageUrl;
  
  try {
    const resp = await fetch(imageUrl);
    if (!resp.ok) return imageUrl; // fallback to original
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return imageUrl;
    
    const blob = await resp.blob();
    const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
    const path = `${userId}/ai-uploads/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    
    const { error } = await supabase.storage.from("images").upload(path, blob, { contentType, upsert: false });
    if (error) {
      console.error("Storage upload error:", error.message);
      return imageUrl;
    }
    
    const { data } = supabase.storage.from("images").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error("Image download error:", e);
    return imageUrl;
  }
}

async function executeToolCall(supabase: any, userId: string, name: string, args: any, userRoles: any[]) {
  const isDirector = userRoles.some((r: any) => r.role === "director" || r.role === "admin");

  switch (name) {
    case "create_jaciment": {
      const resolvedImage = await uploadImageFromUrl(supabase, userId, args.image_url);
      const { data, error } = await supabase.from("jaciments").insert({
        created_by: userId, name: args.name, period: args.period || null,
        description: args.description || null, latitude: args.latitude || null,
        longitude: args.longitude || null, image_url: resolvedImage,
      }).select().single();
      if (error) throw new Error(error.message);
      return { success: true, jaciment: data, message: `Jaciment "${data.name}" creat. Enllaç: /jaciment/${data.id}` };
    }

    case "update_jaciment": {
      const { id, ...updates } = args;
      if (updates.image_url) updates.image_url = await uploadImageFromUrl(supabase, userId, updates.image_url);
      const cleanUpdates: any = {};
      for (const [k, v] of Object.entries(updates)) { if (v !== undefined) cleanUpdates[k] = v; }
      if (Object.keys(cleanUpdates).length === 0) return { error: "Cap camp a actualitzar" };

      // Check ownership or director
      const { data: jac } = await supabase.from("jaciments").select("created_by, name").eq("id", id).single();
      if (!jac) throw new Error("Jaciment no trobat");
      if (jac.created_by !== userId && !isDirector) throw new Error("No tens permisos per editar aquest jaciment");

      const { data, error } = await supabase.from("jaciments").update(cleanUpdates).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return { success: true, jaciment: data, message: `Jaciment "${data.name}" actualitzat. Enllaç: /jaciment/${data.id}` };
    }

    case "delete_jaciment": {
      const { data: jac } = await supabase.from("jaciments").select("created_by, name").eq("id", args.id).single();
      if (!jac) throw new Error("Jaciment no trobat");
      if (jac.created_by !== userId && !isDirector) throw new Error("No tens permisos per eliminar aquest jaciment");
      
      // Delete related UEs and objectes first
      await supabase.from("objectes").delete().eq("jaciment_id", args.id);
      await supabase.from("ues").delete().eq("jaciment_id", args.id);
      const { error } = await supabase.from("jaciments").delete().eq("id", args.id);
      if (error) throw new Error(error.message);
      return { success: true, message: `Jaciment "${jac.name}" i tots els seus registres associats eliminats.` };
    }

    case "create_ue": {
      const insertData: any = { created_by: userId, jaciment_id: args.jaciment_id };
      const ueFields = ["codi_ue","descripcio","cronologia","cota_superior","cota_inferior","color","sediment","interpretacio","image_url","cobreix_a","cobert_per","talla","tallat_per","reomple_a","reomplert_per","es_recolza_a","se_li_recolza","igual_a"];
      for (const f of ueFields) { if (args[f] !== undefined) insertData[f] = args[f]; }
      if (insertData.image_url) insertData.image_url = await uploadImageFromUrl(supabase, userId, insertData.image_url);
      const { data, error } = await supabase.from("ues").insert(insertData).select().single();
      if (error) throw new Error(error.message);
      return { success: true, ue: data, message: `UE "${data.codi_ue || data.id}" creada. Enllaç: /ue/${data.id}` };
    }

    case "update_ue": {
      const { id, ...updates } = args;
      if (updates.image_url) updates.image_url = await uploadImageFromUrl(supabase, userId, updates.image_url);
      const cleanUpdates: any = {};
      for (const [k, v] of Object.entries(updates)) { if (v !== undefined) cleanUpdates[k] = v; }
      if (Object.keys(cleanUpdates).length === 0) return { error: "Cap camp a actualitzar" };

      const { data: ue } = await supabase.from("ues").select("created_by, codi_ue").eq("id", id).single();
      if (!ue) throw new Error("UE no trobada");
      if (ue.created_by !== userId && !isDirector) throw new Error("No tens permisos per editar aquesta UE");

      const { data, error } = await supabase.from("ues").update(cleanUpdates).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return { success: true, ue: data, message: `UE "${data.codi_ue || data.id}" actualitzada. Enllaç: /ue/${data.id}` };
    }

    case "delete_ue": {
      const { data: ue } = await supabase.from("ues").select("created_by, codi_ue").eq("id", args.id).single();
      if (!ue) throw new Error("UE no trobada");
      if (ue.created_by !== userId && !isDirector) throw new Error("No tens permisos per eliminar aquesta UE");

      await supabase.from("objectes").update({ ue_id: null }).eq("ue_id", args.id);
      const { error } = await supabase.from("ues").delete().eq("id", args.id);
      if (error) throw new Error(error.message);
      return { success: true, message: `UE "${ue.codi_ue || args.id}" eliminada.` };
    }

    case "create_objecte": {
      const { data, error } = await supabase.from("objectes").insert({
        created_by: userId, jaciment_id: args.jaciment_id, name: args.name,
        object_id: args.object_id, tipus: args.tipus || null,
        ue_id: args.ue_id || null, image_url: args.image_url || null,
      }).select().single();
      if (error) throw new Error(error.message);
      return { success: true, objecte: data, message: `Objecte "${data.name}" creat. Enllaç: /objecte/${data.id}` };
    }

    case "update_objecte": {
      const { id, ...updates } = args;
      const cleanUpdates: any = {};
      for (const [k, v] of Object.entries(updates)) { if (v !== undefined) cleanUpdates[k] = v; }
      if (Object.keys(cleanUpdates).length === 0) return { error: "Cap camp a actualitzar" };

      const { data: obj } = await supabase.from("objectes").select("created_by, name").eq("id", id).single();
      if (!obj) throw new Error("Objecte no trobat");
      if (obj.created_by !== userId && !isDirector) throw new Error("No tens permisos per editar aquest objecte");

      const { data, error } = await supabase.from("objectes").update(cleanUpdates).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return { success: true, objecte: data, message: `Objecte "${data.name}" actualitzat. Enllaç: /objecte/${data.id}` };
    }

    case "delete_objecte": {
      const { data: obj } = await supabase.from("objectes").select("created_by, name").eq("id", args.id).single();
      if (!obj) throw new Error("Objecte no trobat");
      if (obj.created_by !== userId && !isDirector) throw new Error("No tens permisos per eliminar aquest objecte");

      const { error } = await supabase.from("objectes").delete().eq("id", args.id);
      if (error) throw new Error(error.message);
      return { success: true, message: `Objecte "${obj.name}" eliminat.` };
    }

    case "summarize_jaciment": {
      const { data: jac } = await supabase.from("jaciments").select("*").eq("id", args.jaciment_id).single();
      if (!jac) throw new Error("Jaciment no trobat");

      const { data: jUes } = await supabase.from("ues").select("*").eq("jaciment_id", args.jaciment_id);
      const { data: jObjs } = await supabase.from("objectes").select("*").eq("jaciment_id", args.jaciment_id);
      const uesList = jUes || [];
      const objsList = jObjs || [];

      const cronologies = [...new Set(uesList.map(u => u.cronologia).filter(Boolean))];
      const tipus = [...new Set(objsList.map(o => o.tipus).filter(Boolean))];
      const relCount = uesList.filter(u => u.cobreix_a || u.cobert_per || u.talla || u.tallat_per || u.reomple_a || u.reomplert_per).length;

      return {
        jaciment: { name: jac.name, period: jac.period, closed: jac.closed, entity: jac.entity },
        stats: {
          total_ues: uesList.length, total_objectes: objsList.length,
          ues_amb_relacions: relCount, cronologies, tipus_objectes: tipus,
        },
        ues: uesList.map(u => ({ codi_ue: u.codi_ue, cronologia: u.cronologia, cota_superior: u.cota_superior, cota_inferior: u.cota_inferior })),
        objectes: objsList.map(o => ({ name: o.name, object_id: o.object_id, tipus: o.tipus })),
      };
    }

    case "suggest_relations": {
      const { data: jUes } = await supabase.from("ues").select("*").eq("jaciment_id", args.jaciment_id);
      if (!jUes || jUes.length === 0) return { suggestions: [], message: "No hi ha UEs en aquest jaciment." };

      const suggestions: string[] = [];
      for (let i = 0; i < jUes.length; i++) {
        for (let j = i + 1; j < jUes.length; j++) {
          const a = jUes[i], b = jUes[j];
          const aCode = a.codi_ue || a.id.slice(0,8);
          const bCode = b.codi_ue || b.id.slice(0,8);

          // Check if already related
          const alreadyRelated = [a.cobreix_a, a.cobert_per, a.talla, a.tallat_per, a.reomple_a, a.reomplert_per, a.es_recolza_a, a.se_li_recolza, a.igual_a]
            .some(r => r && r.includes(bCode));
          if (alreadyRelated) continue;

          // Suggest based on cotes
          if (a.cota_superior != null && b.cota_superior != null && a.cota_inferior != null && b.cota_inferior != null) {
            if (a.cota_inferior >= b.cota_superior) {
              suggestions.push(`${aCode} podria cobrir ${bCode} (cota inferior ${a.cota_inferior} >= cota superior ${b.cota_superior})`);
            } else if (b.cota_inferior >= a.cota_superior) {
              suggestions.push(`${bCode} podria cobrir ${aCode} (cota inferior ${b.cota_inferior} >= cota superior ${a.cota_superior})`);
            }
          }
        }
      }
      return { suggestions: suggestions.slice(0, 15), total_ues: jUes.length };
    }

    case "search_items": {
      const q = args.query.toLowerCase();
      const type = args.item_type || "all";
      const results: any = {};

      if (type === "all" || type === "jaciment") {
        const { data } = await supabase.from("jaciments").select("id, name, period, entity, closed").limit(100);
        results.jaciments = (data || []).filter((j: any) => 
          [j.name, j.period, j.entity].some(v => v && v.toLowerCase().includes(q))
        ).slice(0, 10);
      }
      if (type === "all" || type === "ue") {
        const { data } = await supabase.from("ues").select("id, codi_ue, cronologia, descripcio, interpretacio, jaciment_id").limit(500);
        results.ues = (data || []).filter((u: any) => 
          [u.codi_ue, u.cronologia, u.descripcio, u.interpretacio].some(v => v && v.toLowerCase().includes(q))
        ).slice(0, 15);
      }
      if (type === "all" || type === "objecte") {
        const { data } = await supabase.from("objectes").select("id, name, object_id, tipus, jaciment_id").limit(500);
        results.objectes = (data || []).filter((o: any) => 
          [o.name, o.object_id, o.tipus].some(v => v && v.toLowerCase().includes(q))
        ).slice(0, 15);
      }
      return results;
    }

    default:
      throw new Error(`Funció desconeguda: ${name}`);
  }
}
