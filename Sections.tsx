// Sub-sections inside a tab: 2–3 main ones as sub-tabs, the rest one tap away in a "More" list.
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export interface Section { id: string; label: ReactNode; title?: string; more?: boolean; hint?: string }

export function Sectioned({ name, sections, value, onChange, render }: {
  name: string; sections: Section[]; value: string; onChange: (id: string) => void; render: (id: string) => ReactNode;
}) {
  const main = sections.filter((s) => !s.more);
  const more = sections.filter((s) => s.more);
  const cur = sections.find((s) => s.id === value) ?? main[0];
  const go = (id: string) => { onChange(id); window.scrollTo({ top: 0 }); };

  if (cur.more) return (
    <div>
      <div className="px-4 pb-3"><button className="btn btn-sm btn-outline" onClick={() => go(main[0].id)} data-testid="button-section-back">← {name}</button></div>
      <div className="screen">
        <div className="section-title" style={{ marginTop: 0 }}><h2>{cur.title ?? cur.label}</h2></div>
        {render(cur.id)}
      </div>
    </div>
  );

  return (
    <div>
      {main.length > 1 && (
        <nav className="subtabs" aria-label={`${name} sections`}>
          {main.map((s) => <button key={s.id} aria-pressed={cur.id === s.id ? "true" : "false"} onClick={() => go(s.id)} data-testid={`subtab-${s.id}`}>{s.label}</button>)}
        </nav>
      )}
      <div className="screen">
        {render(cur.id)}
        {more.length > 0 && (
          <>
            <div className="section-title"><h2>More</h2></div>
            <div className="card" style={{ padding: "4px 18px" }} data-testid={`more-${name.toLowerCase()}`}>
              {more.map((s) => (
                <button key={s.id} className="rowline w-full text-left" onClick={() => go(s.id)} data-testid={`more-${s.id}`}>
                  <span className="min0">
                    <span className="block font-semibold text-[15px]">{s.title ?? s.label}</span>
                    {s.hint && <span className="block text-[13px] muted">{s.hint}</span>}
                  </span>
                  <ChevronRight size={18} className="shrink-0" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
