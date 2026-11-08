import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Sheet } from "./ui";
import { downloadDataUrl } from "@/lib/actions";

export interface PRData { lift: string; weight: number; reps: number; e1rm: number; units: string; why: string; name: string; date: string }

export async function drawPRCard(canvas: HTMLCanvasElement, d: PRData) {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  try { await Promise.all([document.fonts.load("700 80px 'Space Grotesk'"), document.fonts.load("600 80px 'JetBrains Mono'"), document.fonts.load("400 30px 'JetBrains Mono'")]); } catch { /* fonts optional */ }
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#D9DDE1"; g.fillRect(0, 0, W, H);
  // instrument grid
  g.strokeStyle = "#E9ECEF"; g.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
  for (let y = 0; y <= H; y += 40) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
  // frame
  g.strokeStyle = "#BCC3CA"; g.lineWidth = 2; g.strokeRect(60, 60, W - 120, H - 120);
  // wordmark
  g.fillStyle = "#5C3A21"; g.fillRect(100, 108, 30, 30);
  g.fillStyle = "#0A0C0E"; g.font = "700 48px 'Space Grotesk', sans-serif"; g.textBaseline = "alphabetic";
  g.fillText("RXS", 146, 138);
  g.font = "400 24px 'JetBrains Mono', monospace"; g.fillStyle = "#4E5760"; g.textAlign = "right";
  g.fillText(d.date.toUpperCase(), W - 100, 136); g.textAlign = "left";
  // label
  g.fillStyle = "#5C3A21"; g.font = "600 26px 'JetBrains Mono', monospace";
  g.fillText("PERSONAL RECORD", 100, 300);
  g.fillStyle = "#0A0C0E"; g.font = "700 76px 'Space Grotesk', sans-serif";
  wrap(g, d.lift, 100, 390, W - 200, 84);
  // big numbers
  g.font = "600 210px 'JetBrains Mono', monospace"; g.fillStyle = "#0A0C0E";
  const main = `${fmt(d.weight)}`;
  g.fillText(main, 92, 680);
  const mw = g.measureText(main).width;
  g.font = "600 64px 'JetBrains Mono', monospace"; g.fillStyle = "#4E5760";
  g.fillText(`${d.units} × ${d.reps}`, 100 + mw + 16, 680);
  // e1rm bar
  g.fillStyle = "#E9ECEF"; g.fillRect(100, 740, W - 200, 130); g.strokeStyle = "#BCC3CA"; g.strokeRect(100, 740, W - 200, 130);
  g.fillStyle = "#4E5760"; g.font = "500 24px 'JetBrains Mono', monospace"; g.fillText("ESTIMATED 1RM", 132, 790);
  g.fillStyle = "#5C3A21"; g.font = "600 56px 'JetBrains Mono', monospace"; g.fillText(`${Math.round(d.e1rm)} ${d.units}`, 132, 850);
  g.fillStyle = "#69727B"; g.font = "400 22px 'JetBrains Mono', monospace"; g.textAlign = "right"; g.fillText("w × (1 + r/30)", W - 132, 850); g.textAlign = "left";
  // why stat
  g.fillStyle = "#4E5760"; g.font = "500 24px 'JetBrains Mono', monospace"; g.fillText("WHY", 100, 960);
  g.fillStyle = "#0A0C0E"; g.font = "500 44px 'Space Grotesk', sans-serif"; wrap(g, d.why, 100, 1020, W - 200, 54);
  // footer
  g.fillStyle = "#BCC3CA"; g.fillRect(100, 1170, W - 200, 2);
  g.fillStyle = "#4E5760"; g.font = "500 26px 'Space Grotesk', sans-serif"; g.fillText(d.name, 100, 1222);
  g.font = "400 22px 'JetBrains Mono', monospace"; g.textAlign = "right"; g.fillText("Every rep, meal, and night's sleep — connected.", W - 100, 1222); g.textAlign = "left";
  return canvas.toDataURL("image/png");
}
const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  const words = text.split(" "); let line = ""; let yy = y;
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (g.measureText(t).width > max && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t;
  }
  g.fillText(line, x, yy);
}

export function PRCardSheet({ data, onClose }: { data: PRData; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string>("");
  useEffect(() => { if (ref.current) drawPRCard(ref.current, data).then(setUrl); }, [data]);
  const fname = `rxs-pr-${data.lift.toLowerCase().replace(/\W+/g, "-")}-${data.weight}x${data.reps}.png`;
  return (
    <Sheet title="PR card" onClose={onClose} testId="sheet-pr-card">
      <canvas ref={ref} style={{ display: "none" }} />
      {url ? <img src={url} alt={`PR card: ${data.lift} ${data.weight} × ${data.reps}`} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)" }} data-testid="img-pr-card" /> : <div className="empty pulse" style={{ aspectRatio: "4/5" }}>Rendering…</div>}
      <button className="btn btn-primary btn-lg btn-block mt-3" disabled={!url} onClick={() => downloadDataUrl(fname, url)} data-testid="button-download-pr"><Download size={18} /> Download PNG</button>
      <p className="text-[11px] faint mt-2 text-center">If the download is blocked in this preview, long-press or right-click the image to save it.</p>
    </Sheet>
  );
}
