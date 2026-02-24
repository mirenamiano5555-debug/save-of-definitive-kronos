import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Search, Users } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  read: boolean;
}

interface Contact {
  user_id: string;
  full_name: string | null;
  entity: string;
  avatar_url: string | null;
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const appendMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }, []);

  // Load contacts (all profiles except self)
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("user_id, full_name, entity, avatar_url")
      .neq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          setContacts(data);
          setFilteredContacts(data);
        }
      });
  }, [user]);

  useEffect(() => {
    if (!contactSearch.trim()) {
      setFilteredContacts(contacts);
    } else {
      const q = contactSearch.toLowerCase();
      setFilteredContacts(
        contacts.filter(
          (c) =>
            c.full_name?.toLowerCase().includes(q) ||
            c.entity.toLowerCase().includes(q)
        )
      );
    }
  }, [contactSearch, contacts]);

  // Load messages for selected contact
  useEffect(() => {
    if (!user || !selectedContact) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${selectedContact.user_id}),and(sender_id.eq.${selectedContact.user_id},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };

    loadMessages();

    // Mark unread messages as read
    supabase
      .from("messages")
      .update({ read: true })
      .eq("sender_id", selectedContact.user_id)
      .eq("receiver_id", user.id)
      .eq("read", false)
      .then(() => {});

    // Realtime subscription
    const channel = supabase
      .channel(`messages-${user.id}-${selectedContact.user_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const msg = payload.new as Message;
          if (
            (msg.sender_id === user.id && msg.receiver_id === selectedContact.user_id) ||
            (msg.sender_id === selectedContact.user_id && msg.receiver_id === user.id)
          ) {
            appendMessage(msg);
            if (msg.sender_id === selectedContact.user_id) {
              supabase.from("messages").update({ read: true }).eq("id", msg.id).then(() => {});
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedContact, appendMessage]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !selectedContact || sending) return;

    setSending(true);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        content: newMessage.trim(),
        sender_id: user.id,
        receiver_id: selectedContact.user_id,
      })
      .select("*")
      .single();

    if (error) {
      toast.error("Error enviant el missatge");
    } else if (data) {
      appendMessage(data as Message);
      setNewMessage("");
    }

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => selectedContact ? setSelectedContact(null) : navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold">
          {selectedContact ? (selectedContact.full_name || selectedContact.entity) : "Missatges"}
        </h1>
      </header>

      {!selectedContact ? (
        /* Contact list */
        <div className="flex-1 p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Cercar contacte..."
              className="pl-10"
            />
          </div>

          {filteredContacts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No s'han trobat contactes</p>
            </div>
          )}

          <div className="space-y-1">
            {filteredContacts.map((contact) => (
              <button
                key={contact.user_id}
                onClick={() => setSelectedContact(contact)}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-muted transition-colors flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {contact.avatar_url ? (
                    <img src={contact.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-primary">
                      {(contact.full_name || contact.entity).charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">{contact.full_name || "Sense nom"}</p>
                  <p className="text-xs text-muted-foreground">{contact.entity}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Chat view */
        <div className="flex-1 flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">
                Encara no hi ha missatges. Escriu el primer!
              </p>
            )}
            {messages.map((msg) => {
              const isMine = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                      isMine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p>{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString("ca", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border p-3 flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escriu un missatge..."
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={!newMessage.trim() || sending} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
