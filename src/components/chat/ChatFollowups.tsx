import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

interface Props {
  userMessage: string;
  assistantReply: string;
  conversationId: string | null;
  messageId: string | null;
  onPick: (q: string) => void;
}

export function ChatFollowups({ userMessage, assistantReply, conversationId, messageId, onPick }: Props) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!assistantReply || assistantReply.length < 30) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-followups`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_message: userMessage,
            assistant_reply: assistantReply,
            conversation_id: conversationId,
            message_id: messageId,
          }),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && Array.isArray(json.questions)) setQuestions(json.questions);
      } catch (e) {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [assistantReply, userMessage, conversationId, messageId]);

  if (loading || questions.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2 max-w-full">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="w-3 h-3" />
        <span>اقتراحات</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => onPick(q)}
            className="px-3 py-1.5 text-xs rounded-full border border-border hover:bg-accent text-foreground/80 hover:text-foreground transition-colors text-right"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
