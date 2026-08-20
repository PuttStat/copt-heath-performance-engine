"use client";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../ui/app-shell";

type Band = { id: string; label: string; opportunities: number | null; successes: number | null };
const initial: Band[] = ["Tee shot", "Over 200 yd", "150–200 yd", "125–150 yd", "100–125 yd", "50–100 yd", "Under 50 yd", "Bunker", "Putting 0–6 ft", "Putting 6 ft+"].map((label, i) => ({ id: `band-${i}`, label, opportunities: null, successes: null }));

export default function QuickRound() {
  const [bands, setBands] = useState<Band[]>(initial);
  const [saved, setSaved] = useState(false);
  useEffect(() => { const draft = localStorage.getItem("vgp-quick-round"); const timer = draft ? window.setTimeout(() => setBands(JSON.parse(draft)), 0) : undefined; return () => { if (timer) window.clearTimeout(timer); }; }, []);
  useEffect(() => { localStorage.setItem("vgp-quick-round", JSON.stringify(bands)); }, [bands]);
  const total = useMemo(() => bands.reduce((sum, band) => sum + (band.opportunities ?? 0), 0), [bands]);
  const update = (id: string, field: "opportunities" | "successes", raw: string) => setBands((all) => all.map((band) => band.id === id ? { ...band, [field]: raw === "" ? null : Math.max(0, Number(raw)) } : band));
  const invalid = bands.some((b) => b.successes !== null && b.opportunities !== null && b.successes > b.opportunities);
  const saveRound = () => { const queue = JSON.parse(localStorage.getItem("vgp-round-queue") || "[]"); const id = crypto.randomUUID(); localStorage.setItem("vgp-round-queue", JSON.stringify([...queue, { id, recordedAt: new Date().toISOString(), bands }])); localStorage.removeItem("vgp-quick-round"); setBands(initial); setSaved(true); };
  return <AppShell active="rounds"><header className="page-heading"><div><p className="eyebrow">Round capture</p><h1>Quick round</h1><p>Record only opportunities and successful outcomes. Empty means not entered; zero means it happened with no successes.</p></div><a className="secondary-action" href="/rounds/detailed">Detailed hole-by-hole <span>→</span></a></header>
    {saved && <div className="success-banner" role="status">Round saved to this device and ready to sync.</div>}
    <section className="entry-panel"><div className="entry-head"><span>Shot band</span><span>Opportunities</span><span>Successful</span></div>{bands.map((band) => <div className="entry-row" key={band.id}><label htmlFor={`${band.id}-opp`}>{band.label}</label><input id={`${band.id}-opp`} inputMode="numeric" min="0" type="number" value={band.opportunities ?? ""} onChange={(e) => update(band.id, "opportunities", e.target.value)} placeholder="—" /><input aria-label={`${band.label} successful`} inputMode="numeric" min="0" max={band.opportunities ?? undefined} type="number" value={band.successes ?? ""} onChange={(e) => update(band.id, "successes", e.target.value)} placeholder="—" /></div>)}</section>
    <footer className="round-footer"><div><strong>{total}</strong><span>Total opportunities</span></div><p>{invalid ? "Successful shots cannot exceed opportunities." : "Draft saved automatically on this device."}</p><button className="primary-action" disabled={invalid || total === 0} onClick={saveRound}>Save round</button></footer>
  </AppShell>;
}
