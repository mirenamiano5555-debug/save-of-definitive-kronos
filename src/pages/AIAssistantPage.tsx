import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Bot, User, Loader2, Plus, Trash2, Image, X, Menu } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string; image_urls?: string[] };
type Conversation = { id: string; title: string; updated_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
const WELCOME_MSG: Msg = {
  role: "assistant",
  content: "Hola! Sóc l'assistent IA de Kronos. Puc ajudar-te amb:\n\n- **Consultar dades** de jaciments, UEs i objectes\n- **Crear registres** automàticament (jaciments, UEs, objectes)\n- **Analitzar imatges** que m'adjuntis\n- **Respondre preguntes** sobre arqueologia\n\nQuè necessites?"
};

export default function AIAssistantPage() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load conversations list
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

  // Load messages for active conversation
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
      setMessages([WELCOME_MSG]);
    }
  }, []);

  const selectConversation = async (convId: string) => {
    setActiveConvId(convId);
    await loadMessages(convId);
    setSidebarOpen(false);
  };

  const newConversation = () => {
    setActiveConvId(null);
    setMessages([WELCOME_MSG]);
    setPendingImages([]);
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

  // Image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/ai-chat/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from("images").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    setPendingImages(prev => [...prev, ...urls]);
    setUploading(false);
    if (e.target) e.target.value = "";
  };

  const removePendingImage = (idx: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== idx));
  };

  // Save message to DB
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
    if ((!text && pendingImages.length === 0) || loading || !session) return;

    const userMsg: Msg = {
      role: "user",
      content: text,
      image_urls: pendingImages.length > 0 ? [...pendingImages] : undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setPendingImages([]);
    setLoading(true);

    let convId = activeConvId;

    try {
      // Create conversation if new
      if (!convId) {
        const title = text.slice(0, 60) || "Imatge";
        const { data: conv, error } = await supabase
          .from("ai_conversations")
          .insert({ user_id: user!.id, title })
          .select()
          .single();
        if (error || !conv) throw new Error("No s'ha pogut crear la conversa");
        convId = conv.id;
        setActiveConvId(convId);
        // Save welcome message
        await saveMessage(convId, WELCOME_MSG);
      } else {
        // Update conversation timestamp
        await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      }

      // Save user message
      await saveMessage(convId, userMsg);

      // Build message history for AI (exclude welcome)
      const historyForAI = [...messages.filter((_, i) => i > 0), userMsg];

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
          setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Massa peticions. Espera uns segons i torna a provar." }]);
        } else if (resp.status === 402) {
          setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Crèdits esgotats. Contacta l'administrador." }]);
        } else {
          const errorText = await resp.text().catch(() => "");
          console.error("AI error:", resp.status, errorText);
          setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Error de connexió. Torna a provar." }]);
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

      // Save assistant response
      if (assistantSoFar && convId) {
        await saveMessage(convId, { role: "assistant", content: assistantSoFar });
      }

      loadConversations();
    } catch (e) {
      console.error("Chat error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Error de connexió. Torna a provar." }]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-72 bg-card border-r border-border transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 md:flex md:flex-col`}>
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Converses</h2>
          <Button variant="ghost" size="icon" onClick={newConversation} title="Nova conversa">
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
                <span className="truncate flex-1">{c.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">Cap conversa encara</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Overlay for mobile sidebar */}
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
          <h1 className="text-xl font-serif font-bold">Assistent IA</h1>
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
                    {msg.image_urls.map((url, idx) => (
                      <img key={idx} src={url} alt="Adjunt" className="h-32 rounded object-cover" />
                    ))}
                  </div>
                )}
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

        {/* Pending images preview */}
        {pendingImages.length > 0 && (
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {pendingImages.map((url, idx) => (
              <div key={idx} className="relative">
                <img src={url} alt="Preview" className="h-16 rounded object-cover border border-border" />
                <button
                  onClick={() => removePendingImage(idx)}
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
            >
              <Image className="h-5 w-5" />
            </Button>
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Escriu la teva pregunta..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={loading || (!input.trim() && pendingImages.length === 0)}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>
      </div>
    </div>
  );
}
