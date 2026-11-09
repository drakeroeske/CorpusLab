import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Sheet } from "./ui";
import { downloadDataUrl } from "@/lib/actions";

export interface PRData { lift: string; weight: number; reps: number; e1rm: number; units: string; why: string; name: string; date: string }

const BONE = "#ECE8DF", COBALT = "#2B3FD6", SIGNAL = "#E9A6D8";
const MONO = "'Space Mono', monospace", DISPLAY = "'Archivo Black', 'Arial Black', sans-serif";

function drawLogo(g: CanvasRenderingContext2D, x: number, y: number, size: number, ink: string) {
  const nodes = Array.from({ length: 7 }, (_, i) => { const a = ((50 + (i * 260) / 6) * Math.PI) / 180; return [50 + 36 * Math.cos(a), 50 - 36 * Math.sin(a)] as [number, number]; });
  const k = size / 100, P = (v: number, o: number) => o + v * k;
  g.strokeStyle = ink; g.lineWidth = 5 * k; g.lineCap = "square";
  const line = (a: [number, number], b: [number, number]) => { g.beginPath(); g.moveTo(P(a[0], x), P(a[1], y)); g.lineTo(P(b[0], x), P(b[1], y)); g.stroke(); };
  for (let i = 0; i < 6; i++) line(nodes[i], nodes[i + 1]);
  for (const i of [0, 2, 4, 6]) line([50, 50], nodes[i]);
  g.fillStyle = ink;
  for (const [nx, ny] of nodes) g.fillRect(P(nx - 6, x), P(ny - 6, y), 12 * k, 12 * k);
  g.fillRect(P(41, x), P(41, y), 18 * k, 18 * k);
}
function drawDiagram(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, ink: string) {
  g.strokeStyle = ink; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - r * 1.2, cy); g.lineTo(cx + r * 1.2, cy); g.moveTo(cx, cy - r * 1.2); g.lineTo(cx, cy + r * 1.2); g.stroke();
  for (let i = 0; i < 5; i++) {
    const rr = r * (0.3 + i * 0.175); g.setLineDash(i < 3 ? [] : [4, 6]); g.lineWidth = i < 3 ? 6 : 2;
    g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke();
  }
  g.setLineDash([]);
}
function bakeGrain(g: CanvasRenderingContext2D, W: number, H: number, amount: number) {
  const img = g.getImageData(0, 0, W, H), d = img.data;
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 255 * amount; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}

/** Draw a 1080×1350 Riso PR card (bone, pink band, cobalt ink) as PNG. */
export async function drawPRCard(canvas: HTMLCanvasElement, d: PRData) {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  try { await Promise.all([document.fonts.load(`400 80px ${DISPLAY}`), document.fonts.load(`700 80px ${MONO}`), document.fonts.load(`400 30px ${MONO}`)]); } catch { /* fonts optional */ }
  const g = canvas.getContext("2d")!;
  const U = d.units.toUpperCase();
  g.fillStyle = BONE; g.fillRect(0, 0, W, H);
  // pink header band
  g.fillStyle = SIGNAL; g.fillRect(0, 0, W, 250);
  g.fillStyle = COBALT; g.fillRect(0, 250, W, 8);
  g.font = `700 26px ${MONO}`; g.textBaseline = "alphabetic";
  g.fillText("SPOTTER // PR", 60, 72);
  g.textAlign = "right"; g.fillText(`${d.date.slice(5, 7)}.${d.date.slice(8, 10)}.${d.date.slice(2, 4)}`, W - 60, 72); g.textAlign = "left";
  g.font = `150px ${DISPLAY}`; g.fillText("NEW PR.", 50, 215);
  // diagram
  drawDiagram(g, 860, 500, 140, COBALT);
  // lift + weight + delta
  g.fillStyle = COBALT; g.font = `700 34px ${MONO}`;
  g.fillText(d.lift.toUpperCase(), 60, 350);
  g.font = `190px ${DISPLAY}`; g.fillText(fmt(d.weight), 48, 540);
  g.font = `700 54px ${MONO}`; g.fillText(`${U} × ${d.reps}`, 60, 620);
  g.fillRect(60, 690, W - 120, 4);
  g.font = `700 30px ${MONO}`;
  g.fillText(`e1RM ${Math.round(d.e1rm)} ${U}`, 60, 755);
  g.fillText("VERIFIED BY CORPUS", 60, 805);
  g.font = `400 30px ${MONO}`; wrap(g, `WHY: ${d.why.toUpperCase()}`, 60, 880, W - 120, 42);
  // footer
  g.fillRect(60, 1150, W - 120, 4);
  drawLogo(g, 60, 1190, 90, COBALT);
  g.font = `64px ${DISPLAY}`; g.fillText("CORPUS", 175, 1262);
  g.font = `700 24px ${MONO}`; g.textAlign = "right"; g.fillText(d.name.toUpperCase(), W - 60, 1258); g.textAlign = "left";
  bakeGrain(g, W, H, 0.12);
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
  const fname = `corpus-pr-${data.lift.toLowerCase().replace(/\W+/g, "-")}-${data.weight}x${data.reps}.png`;
  return (
    <Sheet title="PR card" onClose={onClose} testId="sheet-pr-card">
      <canvas ref={ref} style={{ display: "none" }} />
      {url ? <img src={url} alt={`PR card: ${data.lift} ${data.weight} × ${data.reps}`} style={{ width: "100%", border: "2px solid var(--ink)" }} data-testid="img-pr-card" /> : <div className="empty pulse" style={{ aspectRatio: "4/5" }}>Rendering…</div>}
      <button className="btn btn-primary btn-lg btn-block mt-3" disabled={!url} onClick={() => downloadDataUrl(fname, url)} data-testid="button-download-pr"><Download size={18} /> Download PNG</button>
      <p className="text-[11px] faint mt-2 text-center">If the download is blocked in this preview, long-press or right-click the image to save it.</p>
    </Sheet>
  );
}
