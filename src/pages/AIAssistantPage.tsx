import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Bot, User, Loader2, Plus, Trash2, Image, X, Menu, Paperclip, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Attachment = { url: string; type: "image" | "file"; name?: string };
type Msg = { role: "user" | "assistant"; content: string; image_urls?: string[]; attachments?: Attachment[] };
type Conversation = { id: string; title: string; updated_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

function getWelcomeMsg(lang: string): Msg {
  if (lang === "es") return {
    role: "assistant",
    content: "¡Hola! Soy el asistente IA de Kronos. Puedo ayudarte con:\n\n- **Consultar datos** de yacimientos, UEs y objetos\n- **Crear, editar y eliminar** registros automáticamente\n- **Analizar imágenes** que me adjuntes (identificar cerámica, lítica, etc.)\n- **Generar resúmenes** completos de yacimientos\n- **Sugerir relaciones** estratigráficas que falten\n- **Buscar ítems** por criterios (tipo, cronología, etc.)\n- **Generar datos plausibles** si lo necesitas\n\n📎 Puedes adjuntar imágenes con el botón de clip.\n\n¿Qué necesitas?"
  };
  if (lang === "en") return {
    role: "assistant",
    content: "Hello! I'm Kronos' AI assistant. I can help you with:\n\n- **Query data** from sites, SUs and objects\n- **Create, edit and delete** records automatically\n- **Analyze images** you attach (identify pottery, lithics, etc.)\n- **Generate summaries** of entire sites\n- **Suggest relationships** that might be missing\n- **Search items** by criteria (type, chronology, etc.)\n- **Generate plausible data** if needed\n\n📎 You can attach images with the clip button.\n\nWhat do you need?"
  };
  return {
    role: "assistant",
    content: "Hola! Sóc l'assistent IA de Kronos. Puc ajudar-te amb:\n\n- **Consultar dades** de jaciments, UEs i objectes\n- **Crear, editar i eliminar** registres automàticament\n- **Analitzar imatges** que m'adjuntis (identificar ceràmica, lítica, etc.)\n- **Generar resums** complets de jaciments\n- **Suggerir relacions** estratigràfiques que faltin\n- **Cercar ítems** per criteris (tipus, cronologia, etc.)\n- **Generar dades plausibles** si ho necessites\n\n📎 Pots adjuntar imatges usant el botó de clip.\n\nQuè necessites?"
  };
}

export default function AIAssistantPage() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { t, lang } = useT();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([getWelcomeMsg(lang)]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ai_conversations")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) setConversations(data);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadMessages = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from("ai_messages")
      .select("role, content, image_urls")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (data && data.length > 0) {
      setMessages(data.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        image_urls: m.image_urls || undefined,
      })));
    } else {
      setMessages([getWelcomeMsg(lang)]);
    }
  }, [lang]);

  const selectConversation = async (convId: string) => {
    setActiveConvId(convId);
    await loadMessages(convId);
    setSidebarOpen(false);
  };

  const newConversation = () => {
    setActiveConvId(null);
    setMessages([getWelcomeMsg(lang)]);
    setPendingAttachments([]);
    setSidebarOpen(false);
  };

  const deleteConversation = async (convId: string) => {
    await supabase.from("ai_conversations").delete().eq("id", convId);
    if (activeConvId === convId) newConversation();
    loadConversations();
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    setUploading(true);
    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const isImage = file.type.startsWith("image/");
      const path = `${user.id}/ai-chat/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("images").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("images").getPublicUrl(path);
        newAttachments.push({
          url: data.publicUrl,
          type: isImage ? "image" : "file",
          name: file.name,
        });
      }
    }

    setPendingAttachments(prev => [...prev, ...newAttachments]);
    setUploading(false);
    if (e.target) e.target.value = "";
  };

  const removeAttachment = (idx: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const saveMessage = async (convId: string, msg: Msg) => {
    await supabase.from("ai_messages").insert({
      conversation_id: convId,
      role: msg.role,
      content: msg.content,
      image_urls: msg.image_urls || [],
    });
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && pendingAttachments.length === 0) || loading || !session) return;

    const imageUrls = pendingAttachments.filter(a => a.type === "image").map(a => a.url);
    const fileUrls = pendingAttachments.filter(a => a.type === "file");

    let fullContent = text;
    if (fileUrls.length > 0) {
      const fileRefs = fileUrls.map(f => `[Document adjunt: ${f.name || "fitxer"} - ${f.url}]`).join("\n");
      fullContent = fullContent ? `${fullContent}\n\n${fileRefs}` : fileRefs;
    }

    // Add language hint for the AI
    const langHint = lang === "es" ? "\n[Responde en castellano]" : lang === "en" ? "\n[Reply in English]" : "";
    const contentForAI = fullContent + langHint;

    const allImageUrls = [...imageUrls, ...fileUrls.filter(f => f.url.match(/\.(pdf)$/i)).map(f => f.url)];

    const userMsg: Msg = {
      role: "user",
      content: fullContent,
      image_urls: allImageUrls.length > 0 ? allImageUrls : undefined,
      attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
    };
    const userMsgForAI: Msg = {
      ...userMsg,
      content: contentForAI,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setPendingAttachments([]);
    setLoading(true);

    let convId = activeConvId;

    try {
      if (!convId) {
        const title = text.slice(0, 60) || "Imatge/Document";
        const { data: conv, error } = await supabase
          .from("ai_conversations")
          .insert({ user_id: user!.id, title })
          .select()
          .single();
        if (error || !conv) throw new Error("No s'ha pogut crear la conversa");
        convId = conv.id;
        setActiveConvId(convId);
        await saveMessage(convId, getWelcomeMsg(lang));
      } else {
        await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      }

      await saveMessage(convId, userMsg);

      const historyForAI = [...messages.filter((_, i) => i > 0), userMsgForAI];

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: historyForAI,
          conversationId: convId,
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) {
          setMessages(prev => [...prev, { role: "assistant", content: "⚠️ " + t("Massa peticions. Espera uns segons i torna a provar.") }]);
        } else if (resp.status === 402) {
          setMessages(prev => [...prev, { role: "assistant", content: "⚠️ " + t("Crèdits esgotats. Contacta l'administrador.") }]);
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "⚠️ " + t("Error de connexió. Torna a provar.") }]);
        }
        setLoading(false);
        loadConversations();
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantSoFar = "";
      let buffer = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && prev.length > 1 && assistantSoFar.length > chunk.length) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {}
        }
      }

      if (assistantSoFar && convId) {
        await saveMessage(convId, { role: "assistant", content: assistantSoFar });
      }

      loadConversations();
    } catch (e) {
      console.error("Chat error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ " + t("Error de connexió. Torna a provar.") }]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-72 bg-card border-r border-border transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 md:flex md:flex-col`}>
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">{t("Converses")}</h2>
          <Button variant="ghost" size="icon" onClick={newConversation} title={t("Nova conversa")}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.map(c => (
              <div
                key={c.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm hover:bg-muted group ${activeConvId === c.id ? "bg-muted" : ""}`}
                onClick={() => selectConversation(c.id)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <span className="truncate flex-1">{c.title}</span>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">{t("Cap conversa encara")}</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Bot className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-serif font-bold">{t("Assistent IA")}</h1>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 pb-40">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                {msg.image_urls && msg.image_urls.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {msg.image_urls.filter(url => !url.endsWith(".pdf")).map((url, idx) => (
                      <img key={idx} src={url} alt="Adjunt" className="h-32 rounded object-cover" />
                    ))}
                  </div>
                )}
                {msg.attachments?.filter(a => a.type === "file").map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2 p-2 rounded bg-background/50 text-foreground">
                    <FileText className="h-4 w-4 shrink-0" />
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs underline truncate">{a.name || "Document"}</a>
                  </div>
                ))}
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {pendingAttachments.length > 0 && (
          <div className="px-4 pb-2 flex gap-2 flex-wrap border-t border-border pt-2">
            {pendingAttachments.map((att, idx) => (
              <div key={idx} className="relative group">
                {att.type === "image" ? (
                  <img src={att.url} alt="Preview" className="h-16 rounded object-cover border border-border" />
                ) : (
                  <div className="h-16 px-3 rounded border border-border bg-muted flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium truncate max-w-[8rem]">{att.name || "fitxer"}</span>
                      <span className="text-[10px] text-muted-foreground">PDF</span>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(idx)}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-xs"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 md:left-72 bg-card border-t border-border p-4">
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 max-w-3xl mx-auto">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="shrink-0"
              title={t("Adjuntar imatges o documents")}
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            </Button>
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t("Escriu la teva pregunta...")}
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={loading || (!input.trim() && pendingAttachments.length === 0)}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt,.csv"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>
    </div>
  );
}
