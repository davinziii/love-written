"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { ClientApiError } from "@/lib/client/api";
import { boothApi } from "@/lib/photobooth/client";
import type { ChatMessage } from "@/lib/photobooth/types";

const QUICK = ["I'm ready! 📸", "Wait for me", "One more?", "Let's do a heart 🫶", "❤️"];

/**
 * The two of you can talk the whole way through (lobby → photos → choosing the look → the
 * end). Messages arrive with the same Realtime nudge / polling as everything else.
 */
export function BoothChat({
  sessionId,
  token,
  messages,
  partnerName,
  onSent,
  className = "",
}: {
  sessionId: string;
  token: string;
  messages: ChatMessage[];
  partnerName: string;
  onSent: () => void;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<{ clientId: string; body: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  const count = messages.length + pending.length;
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [count]);

  async function send(body: string) {
    const clean = body.trim().slice(0, 300);
    if (!clean) return;
    const clientId = crypto.randomUUID();
    setPending((p) => [...p, { clientId, body: clean }]);
    setText("");
    setError(null);
    try {
      await boothApi(sessionId, token, "/chat", { method: "POST", body: { body: clean, clientId }, retries: 2 });
      onSent();
    } catch (err) {
      setError(err instanceof ClientApiError && err.status === 429 ? "Slow down a little 🙂" : "That message didn't send. Try again.");
      setText(clean);
    } finally {
      setPending((p) => p.filter((m) => m.clientId !== clientId));
    }
  }

  return (
    <section className={`flex min-h-0 flex-col rounded-[1.5rem] bg-paper ring-1 ring-line ${className}`} aria-label="Chat">
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <Icon.message size={15} className="text-rose" />
        <p className="truncate text-sm font-medium">Chat with {partnerName}</p>
      </header>
      <div ref={list} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3" aria-live="polite">
        {messages.length === 0 && pending.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-ink-soft">Say hi, decide on poses, or tell them you&rsquo;re ready.</p>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} mine={m.mine} body={m.body} />
        ))}
        {pending.map((m) => (
          <Bubble key={m.clientId} mine body={m.body} faded />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 pb-2">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void send(q)}
            className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs ring-1 ring-line hover:text-rose hover:ring-rose"
          >
            {q}
          </button>
        ))}
      </div>
      <form
        className="flex items-center gap-2 border-t border-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="Message…"
          aria-label={`Message ${partnerName}`}
          className="min-w-0 flex-1 rounded-full bg-white px-4 py-2.5 text-sm ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-rose/40"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Send"
          className="lw-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose text-white disabled:opacity-40"
        >
          <Icon.send size={16} />
        </button>
      </form>
      {error && (
        <p role="alert" className="px-4 pb-2 text-xs text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function Bubble({ mine, body, faded = false }: { mine: boolean; body: string; faded?: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${
          mine ? "rounded-br-md bg-rose text-white" : "rounded-bl-md bg-white ring-1 ring-line"
        } ${faded ? "opacity-60" : ""}`}
      >
        {body}
      </p>
    </div>
  );
}
