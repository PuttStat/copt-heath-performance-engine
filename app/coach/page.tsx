"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "../ui/app-shell";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { usePlayerData, type BandAggregate } from "../../lib/use-player-data";
import { buildDiagnosticObservations, type MissAggregate } from "../../lib/diagnostic-engine";

type Player = { id: string; display_name: string | null; email: string };
type LibraryItem = { id: string; code: string; title: string; item_type: "golf_drill" | "vector_exercise" | "swing_movement"; purpose: string; dosage: string | null };
type Recommendation = { id: string; sequence: number; recommendation_role: "test" | "practice" | "physical_support"; rationale: string; library_item_id: string; library_items: LibraryItem | null };
type Case = { id: string; shot_band: string; status: "draft" | "approved" | "rejected" | "superseded"; confidence: string; observation: string; evidence_summary: string; next_test: string; coach_note: string | null; case_recommendations: Recommendation[] };

export default function CoachWorkspace() {
  const { profile } = usePlayerData();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [aggregates, setAggregates] = useState<BandAggregate[]>([]);
  const [misses, setMisses] = useState<MissAggregate[]>([]);
  const [roundCount, setRoundCount] = useState(0);
  const [cases, setCases] = useState<Case[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [activeCaseId, setActiveCaseId] = useState("");
  const [message, setMessage] = useState("");
  const canCoach = profile?.role === "coach" || profile?.role === "admin";

  const loadPlayers = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !profile || !canCoach) return;
    const { data: links } = await sb.from("coach_player_links").select("player_id").eq("coach_id", profile.id);
    const ids = (links || []).map(link => link.player_id);
    if (!ids.length) { setPlayers([]); return; }
    const { data } = await sb.from("profiles").select("id,display_name,email").in("id", ids).order("display_name");
    const linked = (data || []) as Player[];
    setPlayers(linked);
    setSelectedId(current => current && linked.some(player => player.id === current) ? current : linked[0]?.id || "");
  }, [profile, canCoach]);

  const loadLibrary = useCallback(async () => {
    const sb = getSupabaseBrowserClient(); if (!sb) return;
    const { data } = await sb.from("library_items").select("id,code,title,item_type,purpose,dosage").eq("status", "approved").order("code");
    setLibrary((data || []) as LibraryItem[]);
  }, []);

  const loadPlayer = useCallback(async () => {
    const sb = getSupabaseBrowserClient(); if (!sb || !selectedId) return;
    const [roundsResult, resultsResult, shotsResult, casesResult] = await Promise.all([
      sb.from("rounds").select("id", { count: "exact" }).eq("player_id", selectedId),
      sb.from("shot_band_results").select("shot_band,opportunities,successes").eq("player_id", selectedId),
      sb.from("detailed_shots").select("shot_band,success,miss_length,miss_direction").eq("player_id", selectedId),
      sb.from("diagnostic_cases").select("id,shot_band,status,confidence,observation,evidence_summary,next_test,coach_note,case_recommendations(id,sequence,recommendation_role,rationale,library_item_id,library_items(id,code,title,item_type,purpose,dosage))").eq("player_id", selectedId).order("created_at", { ascending: false }),
    ]);
    const bandMap: Record<string, BandAggregate> = {};
    for (const row of resultsResult.data || []) { const item = bandMap[row.shot_band] ||= { shot_band: row.shot_band, opportunities: 0, successes: 0 }; item.opportunities += row.opportunities ?? 0; item.successes += row.successes ?? 0; }
    const missMap: Record<string, MissAggregate> = {};
    for (const shot of shotsResult.data || []) { const item = missMap[shot.shot_band] ||= { shot_band: shot.shot_band, failures: 0, short: 0, long: 0, left: 0, right: 0 }; if (!shot.success) { item.failures++; if (shot.miss_length === "short") item.short++; if (shot.miss_length === "long") item.long++; if (shot.miss_direction === "left") item.left++; if (shot.miss_direction === "right") item.right++; } }
    setRoundCount(roundsResult.count || 0); setAggregates(Object.values(bandMap)); setMisses(Object.values(missMap)); setCases((casesResult.data || []) as unknown as Case[]);
  }, [selectedId]);

  useEffect(() => { const timer = setTimeout(() => { void loadPlayers(); void loadLibrary(); }, 0); return () => clearTimeout(timer); }, [loadPlayers, loadLibrary]);
  useEffect(() => { const timer = setTimeout(() => void loadPlayer(), 0); return () => clearTimeout(timer); }, [loadPlayer]);
  const observations = useMemo(() => buildDiagnosticObservations(aggregates, misses), [aggregates, misses]);
  const selectedPlayer = players.find(player => player.id === selectedId);
  const visibleLibrary = library.filter(item => `${item.code} ${item.title} ${item.purpose}`.toLowerCase().includes(libraryQuery.toLowerCase())).slice(0, 8);

  const createReview = async (index: number) => {
    const sb = getSupabaseBrowserClient(); const observation = observations[index]; if (!sb || !profile || !selectedId) return;
    const { data, error } = await sb.from("diagnostic_cases").insert({ player_id: selectedId, shot_band: observation.band, status: "draft", confidence: observation.confidence, confidence_score: observation.confidenceScore, priority_score: observation.priorityScore, opportunities: observation.opportunities, successes: observation.successes, pattern_key: observation.patternKey, observation: observation.pattern, interpretation: observation.interpretation, evidence_summary: observation.evidenceSummary, next_test: observation.nextTest, guardrail: observation.guardrail, created_by: profile.id }).select("id").single();
    if (error || !data) { setMessage(error?.message || "Could not create review."); return; }
    const suggested = observation.suggestedCodes.map(code => library.find(item => item.code === code)).filter(Boolean) as LibraryItem[];
    if (suggested.length) await sb.from("case_recommendations").insert(suggested.map((item, sequence) => ({ case_id: data.id, library_item_id: item.id, sequence: sequence + 1, recommendation_role: item.item_type === "vector_exercise" ? "physical_support" : sequence === 0 ? "test" : "practice", rationale: item.item_type === "vector_exercise" ? "Physical support option, subject to movement screening." : sequence === 0 ? "Classify the pattern before changing technique." : "Progress after the comparison test supports the route." })));
    setMessage("Draft review created for the selected player."); setActiveCaseId(data.id); await loadPlayer();
  };
  const updateCase = async (caseId: string, changes: Record<string, unknown>) => { const sb = getSupabaseBrowserClient(); if (!sb || !profile) return; const reviewed = changes.status ? { reviewed_by: profile.id, reviewed_at: new Date().toISOString() } : {}; const { error } = await sb.from("diagnostic_cases").update({ ...changes, ...reviewed, updated_at: new Date().toISOString() }).eq("id", caseId); setMessage(error ? error.message : "Player prescription updated."); if (!error) await loadPlayer(); };
  const addItem = async (caseId: string, item: LibraryItem) => { const sb = getSupabaseBrowserClient(); const target = cases.find(entry => entry.id === caseId); if (!sb || !target) return; const role = item.item_type === "vector_exercise" ? "physical_support" : "practice"; const { error } = await sb.from("case_recommendations").insert({ case_id: caseId, library_item_id: item.id, sequence: (target.case_recommendations?.length || 0) + 1, recommendation_role: role, rationale: role === "physical_support" ? "Coach-selected physical support, subject to screening." : "Coach-selected practice route." }); setMessage(error ? error.message : `${item.code} added.`); if (!error) await loadPlayer(); };
  const removeItem = async (id: string) => { const sb = getSupabaseBrowserClient(); if (!sb) return; const { error } = await sb.from("case_recommendations").delete().eq("id", id); setMessage(error ? error.message : "Item removed from prescription."); if (!error) await loadPlayer(); };

  if (profile && !canCoach) return <AppShell active="coach"><div className="empty-state"><span>V</span><h2>Coach access required</h2><p>This workspace is available only to approved Vector coaches and administrators.</p></div></AppShell>;
  return <AppShell active="coach"><header className="page-heading"><div><p className="eyebrow">Package 7E.3 · Coach workspace</p><h1>One player. One clear route.</h1><p>Select a linked player, inspect the evidence and publish only the drills and Vector support you judge appropriate.</p></div></header>{message && <div className="success-banner" role="status">{message}</div>}<section className="player-selector"><label>Selected player<select value={selectedId} onChange={event => { setSelectedId(event.target.value); setActiveCaseId(""); }}><option value="">Choose a linked player</option>{players.map(player => <option value={player.id} key={player.id}>{player.display_name || player.email}</option>)}</select></label>{selectedPlayer && <div><strong>{selectedPlayer.display_name || "Player"}</strong><span>{selectedPlayer.email}</span></div>}<div><strong>{roundCount}</strong><span>rounds</span></div><div><strong>{cases.filter(item => item.status === "draft").length}</strong><span>draft reviews</span></div></section>{!players.length ? <div className="empty-state compact"><h2>No linked players yet</h2><p>Add a coach-player link in Supabase before using the workspace.</p></div> : selectedId && <div className="coach-grid"><section className="coach-evidence"><div className="section-heading"><div><p className="eyebrow">Live player evidence</p><h2>Ranked opportunities</h2></div></div>{observations.map((observation, index) => <article className="coach-observation" key={observation.band}><div><span className="rank">{String(index + 1).padStart(2, "0")}</span><div><strong>{observation.band}</strong><p>{observation.pattern} · {observation.evidenceSummary}</p></div></div><span className={`confidence ${observation.confidence}`}>{observation.confidence}</span><button disabled={observation.confidence === "insufficient"} onClick={() => createReview(index)}>{observation.confidence === "insufficient" ? "More data needed" : "Create review"}</button></article>)}</section><section className="case-workspace"><div className="section-heading"><div><p className="eyebrow">Saved reviews</p><h2>Prescription editor</h2></div></div>{cases.map(item => <article className={`case-editor ${activeCaseId === item.id ? "active" : ""}`} key={item.id}><button className="case-title" onClick={() => setActiveCaseId(activeCaseId === item.id ? "" : item.id)}><span><strong>{item.shot_band}</strong><small>{item.observation}</small></span><b>{item.status}</b></button>{activeCaseId === item.id && <div className="case-detail"><p>{item.evidence_summary}</p><div className="next-test"><strong>Next test</strong><span>{item.next_test}</span></div><label>Coach note<textarea defaultValue={item.coach_note || ""} onBlur={event => updateCase(item.id, { coach_note: event.target.value })} placeholder="Explain the priority, feel or constraint in the player's language." /></label><div className="prescription-list">{(item.case_recommendations || []).sort((a, b) => a.sequence - b.sequence).map(rec => <div key={rec.id}><span><b>{rec.library_items?.code}</b>{rec.library_items?.title}<small>{rec.recommendation_role.replace("_", " ")}</small></span><button onClick={() => removeItem(rec.id)}>Remove</button></div>)}</div><div className="library-picker"><input aria-label="Search approved library" placeholder="Add drill or Vector exercise" value={libraryQuery} onChange={event => setLibraryQuery(event.target.value)} />{libraryQuery && <div>{visibleLibrary.map(libraryItem => <button key={libraryItem.id} onClick={() => addItem(item.id, libraryItem)}><b>{libraryItem.code}</b><span>{libraryItem.title}</span></button>)}</div>}</div><div className="case-actions"><button onClick={() => updateCase(item.id, { status: "rejected" })}>Reject</button><button onClick={() => updateCase(item.id, { status: "superseded" })}>Supersede</button><button className="primary-action" onClick={() => updateCase(item.id, { status: "approved" })}>Approve for player</button></div></div>}</article>)}{!cases.length && <p className="empty-copy">Create a review from the ranked evidence to begin.</p>}</section></div>}</AppShell>;
}
