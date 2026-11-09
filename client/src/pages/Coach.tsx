import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useStore } from "@/lib/store";
import { useToday } from "@/lib/derived";
import { Sheet } from "@/components/ui";
import { coachAnswer } from "@/lib/engine";
import { newId } from "@/lib/exercises";

const SUGGEST = ["Why did my overhead press stall?", "Should I deload?", "How is my sleep affecting progress?", "Am I eating enough protein?", "Why are weights held today?", "Which muscles need more volume?"];

export function CoachChat({ onClose }: { onClose: () => void }) {
  const { state, set, targets, profile } = useStore();
  const t = useToday();
  const [q, setQ] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [state.chat.length]);

  const ask = (text: string) => {
    const txt = text.trim();
    if (!txt) return;
    const answer = coachAnswer(txt, { state, today: t.today, targets, readiness: t.readiness, units: profile.units });
    const now = Date.now();
    set((s) => ({ ...s, chat: [...s.chat, { id: newId("m"), role: "user" as const, text: txt, ts: now }, { id: newId("m"), role: "coach" as const, text: answer, ts: now + 1 }].slice(-60) }));
    setQ("");
  };

  return (
    <Sheet title="Coach" onClose={onClose} full testId="sheet-coach"
      right={state.chat.length ? <button className="btn btn-ghost btn-sm" onClick={() => set((s) => ({ ...s, chat: [] }))} data-testid="button-clear-chat">Clear</button> : undefined}>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
        <p className="text-xs muted mb-3">Answers come from your logged data and the Corpus engine (readiness, fatigue, plateau, and progression rules), not generic advice.</p>
        <div className="stack" style={{ flex: 1 }}>
          {state.chat.map((m) => (
            <div key={m.id} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }} data-testid={`chat-${m.role}`}>
              {m.role === "user"
                ? <div className="text-sm" style={{ background: "var(--lime-dim)", border: "1px solid rgba(17,20,24,.18)", padding: "10px 12px", borderRadius: 10 }}>{m.text}</div>
                : <div className="card-flat" style={{ padding: "10px 12px" }}><div className="label lime mb-1">Coach</div><pre className="chat">{m.text}</pre></div>}
            </div>
          ))}
          <div ref={end} />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {SUGGEST.map((s) => <button key={s} className="chip" style={{ minHeight: 36, cursor: "pointer" }} onClick={() => ask(s)} data-testid={`chip-suggest-${SUGGEST.indexOf(s)}`}>{s}</button>)}
        </div>
        <div className="flex gap-2 mt-3" style={{ position: "sticky", bottom: 0, background: "var(--surface)", paddingTop: 8, paddingBottom: 4 }}>
          <input className="input" placeholder="Ask about your training…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask(q)} data-testid="input-coach" />
          <button className="btn btn-primary" onClick={() => ask(q)} aria-label="Send" data-testid="button-coach-send"><Send size={16} /></button>
        </div>
      </div>
    </Sheet>
  );
}
