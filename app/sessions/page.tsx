"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "../ui/app-shell";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { usePlayerData } from "../../lib/use-player-data";
import { buildDiagnosticObservations, type MissAggregate } from "../../lib/diagnostic-engine";
import {
  recommendPlanItems,
  recommendationForSession,
  splitMinutes,
  type ApprovedPrescription,
  type PlanningPhase,
  type RecommendationLibraryItem,
} from "../../lib/programme-recommendation";
type Player = { id: string; display_name: string | null; email: string };
type Programme = { id: string; player_id: string; status: string; planning_mode: "coach_led" | "self_directed" };
type Week = {
  id: string;
  week_number: number;
  phase: PlanningPhase;
  focus: string;
  golf_minutes: number;
  vector_minutes: number;
  status: string;
};
type Item = RecommendationLibraryItem;
type Block = {
  id: string;
  sequence: number;
  domain: "golf" | "vector";
  stage: string;
  minutes: number;
  instructions: string | null;
  success_criterion: string | null;
  library_item_id: string | null;
  source_case_id: string | null;
  recommendation_source: "vector_engine" | "coach_approved" | "coach_override" | "player_override" | null;
  recommendation_rationale: string | null;
  recommendation_score: number | null;
  evidence_snapshot: Record<string, unknown> | null;
  library_items: Item | null;
};
type Session = {
  id: string;
  session_number: number;
  title: string;
  scheduled_day: string | null;
  objective: string | null;
  status: string;
  session_blocks: Block[];
};
const stageByPhase: Record<string, string[]> = {
  Measure: ["baseline", "technique", "skill"],
  Build: ["technique", "skill", "random"],
  Stabilise: ["skill", "random", "pressure"],
  Transfer: ["random", "pressure", "transfer"],
  Perform: ["pressure", "transfer", "baseline"],
};
export default function SessionsPage() {
  const { profile } = usePlayerData(),
    [players, setPlayers] = useState<Player[]>([]),
    [selectedId, setSelectedId] = useState(""),
    [programme, setProgramme] = useState<Programme | null>(null),
    [weeks, setWeeks] = useState<Week[]>([]),
    [weekId, setWeekId] = useState(""),
    [sessions, setSessions] = useState<Session[]>([]),
    [library, setLibrary] = useState<Item[]>([]),
    [approvedItems, setApprovedItems] = useState<ApprovedPrescription[]>([]),
    [bandRows, setBandRows] = useState<Array<{ shot_band: string; opportunities: number | null; successes: number | null }>>([]),
    [misses, setMisses] = useState<MissAggregate[]>([]),
    [intake, setIntake] = useState<{ sessions_per_week: number; facilities: string[]; recovery_constraints: string } | null>(null),
    [message, setMessage] = useState("");
  const canCoach = profile?.role === "coach" || profile?.role === "admin";
  const targetId = canCoach ? selectedId : profile?.id || "";
  const week = weeks.find((item) => item.id === weekId);
  const canPlan = canCoach || (!!programme && programme.planning_mode === "self_directed" && programme.player_id === profile?.id);
  const loadPlayers = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !profile || !canCoach) return;
    const { data: links } = await sb
      .from("coach_player_links")
      .select("player_id")
      .eq("coach_id", profile.id);
    const ids = (links || []).map((x) => x.player_id);
    if (!ids.length) return;
    const { data } = await sb
      .from("profiles")
      .select("id,display_name,email")
      .in("id", ids);
    const rows = (data || []) as Player[];
    setPlayers(rows);
    setSelectedId((current) => current || rows[0]?.id || "");
  }, [profile, canCoach]);
  const loadBase = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !targetId) return;
    const { data: p } = await sb
      .from("programmes")
      .select("id,player_id,status,planning_mode")
      .eq("player_id", targetId)
      .in(
        "status",
        canCoach
          ? ["draft", "published", "completed"]
          : ["draft", "published", "completed"],
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setProgramme(p as Programme | null);
    if (!p) {
      setWeeks([]);
      return;
    }
    const [{ data: w }, { data: l }, { data: c }, { data: results }, { data: detailed }, { data: intakeRow }] = await Promise.all([
      sb
        .from("programme_weeks")
        .select("id,week_number,phase,focus,golf_minutes,vector_minutes,status")
        .eq("programme_id", p.id)
        .order("week_number"),
      sb
        .from("library_items")
        .select(
          "id,code,title,item_type,category,stage,purpose,dosage,pass_criterion,equipment,guardrails,instruction_complete",
        )
        .eq("status", "approved")
        .eq("instruction_complete", true)
        .order("code"),
      sb
        .from("diagnostic_cases")
        .select(
          "id,priority_score,evidence_summary,case_recommendations(rationale,library_items(id,code,title,item_type,category,stage,purpose,dosage,pass_criterion,equipment,guardrails,instruction_complete))",
        )
        .eq("player_id", targetId)
        .eq("status", "approved"),
      sb.from("shot_band_results").select("shot_band,opportunities,successes").eq("player_id", targetId),
      sb.from("detailed_shots").select("shot_band,success,miss_length,miss_direction").eq("player_id", targetId),
      sb.from("programme_intakes").select("sessions_per_week,facilities,recovery_constraints").eq("player_id", targetId).maybeSingle(),
    ]);
    const weekRows = (w || []) as Week[];
    setWeeks(weekRows);
    setWeekId((current) =>
      current && weekRows.some((x) => x.id === current)
        ? current
        : weekRows[0]?.id || "",
    );
    setLibrary((l || []) as Item[]);
    setBandRows((results || []) as typeof bandRows);
    const missMap: Record<string, MissAggregate> = {};
    for (const shot of detailed || []) {
      const row = missMap[shot.shot_band] ||= { shot_band: shot.shot_band, failures: 0, short: 0, long: 0, left: 0, right: 0 };
      if (!shot.success) {
        row.failures++;
        if (shot.miss_length === "short") row.short++;
        if (shot.miss_length === "long") row.long++;
        if (shot.miss_direction === "left") row.left++;
        if (shot.miss_direction === "right") row.right++;
      }
    }
    setMisses(Object.values(missMap));
    setIntake(intakeRow as typeof intake);
    const approved: ApprovedPrescription[] = [];
    for (const diagnostic of c || [])
      for (const rec of diagnostic.case_recommendations || []) {
        const raw = rec.library_items as unknown;
        const item = (Array.isArray(raw) ? raw[0] : raw) as Item | null;
        if (
          item?.instruction_complete &&
          !approved.some((entry) => entry.item.id === item.id)
        )
          approved.push({ item, caseId: diagnostic.id, priorityScore: Number(diagnostic.priority_score || 0), rationale: rec.rationale || diagnostic.evidence_summary });
      }
    setApprovedItems(approved);
  }, [targetId, canCoach]);
  const loadSessions = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !weekId) return;
    const { data } = await sb
      .from("programme_sessions")
      .select(
        "id,session_number,title,scheduled_day,objective,status,session_blocks(id,sequence,domain,stage,minutes,instructions,success_criterion,library_item_id,source_case_id,recommendation_source,recommendation_rationale,recommendation_score,evidence_snapshot,library_items(id,code,title,item_type,category,stage,purpose,dosage,pass_criterion,equipment,guardrails,instruction_complete))",
      )
      .eq("programme_week_id", weekId)
      .order("session_number");
    setSessions((data || []) as unknown as Session[]);
  }, [weekId]);
  useEffect(() => {
    const t = setTimeout(() => void loadPlayers(), 0);
    return () => clearTimeout(t);
  }, [loadPlayers]);
  useEffect(() => {
    const t = setTimeout(() => void loadBase(), 0);
    return () => clearTimeout(t);
  }, [loadBase]);
  useEffect(() => {
    const t = setTimeout(() => void loadSessions(), 0);
    return () => clearTimeout(t);
  }, [loadSessions]);
  const totals = useMemo(
    () =>
      sessions
        .flatMap((s) => s.session_blocks || [])
        .reduce(
          (sum, b) => {
            sum[b.domain] += b.minutes;
            if (!b.library_item_id) sum.missing++;
            else if (!b.library_items?.instruction_complete) sum.notReady++;
            return sum;
          },
          { golf: 0, vector: 0, missing: 0, notReady: 0 },
        ),
    [sessions],
  );
  const balanced =
    !!week &&
    totals.golf === week.golf_minutes &&
    totals.vector === week.vector_minutes &&
    totals.missing === 0 &&
    totals.notReady === 0;
  const aggregates = useMemo(() => Object.values(bandRows.reduce<Record<string, { shot_band: string; opportunities: number; successes: number }>>((map, row) => {
    const aggregate = map[row.shot_band] ||= { shot_band: row.shot_band, opportunities: 0, successes: 0 };
    aggregate.opportunities += row.opportunities || 0;
    aggregate.successes += row.successes || 0;
    return map;
  }, {})), [bandRows]);
  const observations = useMemo(() => buildDiagnosticObservations(aggregates, misses), [aggregates, misses]);
  const suggestions = useMemo(() => week ? recommendPlanItems({
    library,
    observations,
    approved: approvedItems,
    phase: week.phase,
    facilities: intake?.facilities || [],
    recoveryConstraints: intake?.recovery_constraints || "",
  }) : null, [week, library, observations, approvedItems, intake]);
  const buildWeek = async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !week || !canPlan || !suggestions) return;
    if (sessions.length) {
      setMessage(
        "This week already has sessions. Remove or edit them instead of rebuilding.",
      );
      return;
    }
    if (!suggestions.golf.length || (week.vector_minutes > 0 && !suggestions.vector.length)) {
      setMessage("Vector needs more usable evidence or suitable player-ready library items before it can build this week.");
      return;
    }
    const sessionCount = Math.min(7, Math.max(1, intake?.sessions_per_week || 3)),
      golfSplit = splitMinutes(week.golf_minutes, sessionCount),
      vectorSplit = splitMinutes(week.vector_minutes, Math.min(2, sessionCount));
    const { data: created, error } = await sb
      .from("programme_sessions")
      .insert(
        Array.from({ length: sessionCount }, (_, i) => ({
          programme_week_id: week.id,
          session_number: i + 1,
          title: `${week.phase} session ${i + 1}`,
          objective: week.focus,
          status: "draft",
        })),
      )
      .select("id,session_number");
    if (error || !created) {
      setMessage(error?.message || "Could not create sessions.");
      return;
    }
    const stages = stageByPhase[week.phase] || ["skill", "random", "transfer"];
    const blocks: Array<Record<string, unknown>> = [];
    created.forEach((session, i) => {
      const selected = recommendationForSession(suggestions.golf, week.week_number, i);
      if (golfSplit[i] > 0)
        blocks.push({
          session_id: session.id,
          sequence: 1,
          domain: "golf",
          stage: stages[i % stages.length],
          minutes: golfSplit[i],
          library_item_id: selected?.item.id || null,
          source_case_id: selected?.sourceCaseId || null,
          recommendation_source: selected?.sourceCaseId ? "coach_approved" : "vector_engine",
          recommendation_rationale: selected?.rationale || null,
          recommendation_score: selected?.score || null,
          evidence_snapshot: selected?.evidence || null,
          instructions:
            selected?.item.purpose || "Coach to assign an approved drill.",
          success_criterion:
            selected?.item.pass_criterion ||
            "Record the agreed success measure before progressing.",
        });
      if (i < vectorSplit.length && vectorSplit[i] > 0) {
        const v = recommendationForSession(suggestions.vector, week.week_number, i);
        blocks.push({
          session_id: session.id,
          sequence: 2,
          domain: "vector",
          stage: "vector",
          minutes: vectorSplit[i],
          library_item_id: v?.item.id || null,
          source_case_id: v?.sourceCaseId || null,
          recommendation_source: v?.sourceCaseId ? "coach_approved" : "vector_engine",
          recommendation_rationale: v?.rationale || null,
          recommendation_score: v?.score || null,
          evidence_snapshot: v?.evidence || null,
          instructions:
            v?.item.purpose ||
            "Assign Vector support only after a demonstrated movement requirement.",
          success_criterion:
            v?.item.pass_criterion ||
            "Movement quality retained without unnecessary fatigue.",
        });
      }
    });
    const { error: blockError } = await sb
      .from("session_blocks")
      .insert(blocks);
    setMessage(
      blockError
        ? blockError.message
        : suggestions.requiresReview
          ? "Suggested week built. Review the Vector exercise against the player's recovery constraints before release."
          : "Vector built the suggested week from the player's ranked evidence. Review or change any item before release.",
    );
    await loadSessions();
  };
  const updateBlock = async (id: string, changes: Partial<Block>) => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    const { error } = await sb
      .from("session_blocks")
      .update(changes)
      .eq("id", id);
    setMessage(error ? error.message : "Session block updated.");
    if (!error) await loadSessions();
  };
  const updateSession = async (id: string, changes: Partial<Session>) => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    const { error } = await sb
      .from("programme_sessions")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", id);
    setMessage(error ? error.message : "Session updated.");
    if (!error) await loadSessions();
  };
  const release = async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !week || !programme) return;
    if (!balanced) {
      setMessage(
        "Every block needs a player-ready library item and reconciled minutes before release.",
      );
      return;
    }
    const { error } = await sb
      .from("programme_weeks")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("id", week.id);
    if (!error && programme.status === "draft")
      await sb
        .from("programmes")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", programme.id);
    setMessage(error ? error.message : "Week released to the player.");
    if (!error) await loadBase();
  };
  const selectable = (domain: "golf" | "vector") =>
    library.filter(
      (item) =>
        item.item_type ===
        (domain === "golf" ? "golf_drill" : "vector_exercise"),
    );
  return (
    <AppShell active="sessions">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Package 7F.2 · Session builder</p>
          <h1>Every minute has a purpose.</h1>
          <p>
            Build from coach-approved evidence, progress through staged practice
            and release only when golf and Vector minutes reconcile exactly.
          </p>
        </div>
      </header>
      {message && (
        <div className="success-banner" role="status">
          {message}
        </div>
      )}
      {canCoach && (
        <section className="session-player">
          <label>
            Player
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {players.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.display_name || p.email}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      {programme && (
        <section className="week-tabs">
          {weeks.map((w) => (
            <button
              className={w.id === weekId ? "active" : ""}
              onClick={() => setWeekId(w.id)}
              key={w.id}
            >
              <b>{w.week_number}</b>
              <span>{w.phase}</span>
            </button>
          ))}
        </section>
      )}
      {week && (
        <>
        {suggestions && <section className="vector-suggestion-summary">
          <div><span>Vector recommendation</span><strong>{suggestions.evidenceSummary}</strong></div>
          <small>{suggestions.golf.length} suitable drills · {suggestions.vector.length} suitable Vector exercises</small>
          {suggestions.requiresReview && <b>Recovery constraint: review exercise choice before release</b>}
        </section>}
        <section className="reconcile-bar">
          <div>
            <span>Golf</span>
            <strong>
              {totals.golf}/{week.golf_minutes}
            </strong>
          </div>
          <div>
            <span>Vector</span>
            <strong>
              {totals.vector}/{week.vector_minutes}
            </strong>
          </div>
          <div>
            <span>Assignments</span>
            <strong>
              {totals.missing
                ? `${totals.missing} missing`
                : totals.notReady
                  ? `${totals.notReady} need instructions`
                  : "Player ready"}
            </strong>
          </div>
          <b className={balanced ? "balanced" : "unbalanced"}>
            {balanced ? "Ready to release" : "Reconciliation required"}
          </b>
          {canPlan && !sessions.length && (
            <button onClick={buildWeek}>Build suggested week</button>
          )}
          {canPlan && sessions.length > 0 && (
            <button disabled={!balanced} onClick={release}>
              {canCoach ? "Release week" : "Add week to my plan"}
            </button>
          )}
        </section>
        </>
      )}
      <section className="session-builder">
        {sessions.map((session) => (
          <article className="planned-session" key={session.id}>
            <header>
              <span>Session {session.session_number}</span>
              {canPlan ? (
                <>
                  <input
                    value={session.title}
                    onChange={(e) =>
                      setSessions((all) =>
                        all.map((s) =>
                          s.id === session.id
                            ? { ...s, title: e.target.value }
                            : s,
                        ),
                      )
                    }
                    onBlur={(e) =>
                      updateSession(session.id, { title: e.target.value })
                    }
                  />
                  <input
                    placeholder="Scheduled day"
                    value={session.scheduled_day || ""}
                    onChange={(e) =>
                      setSessions((all) =>
                        all.map((s) =>
                          s.id === session.id
                            ? { ...s, scheduled_day: e.target.value }
                            : s,
                        ),
                      )
                    }
                    onBlur={(e) =>
                      updateSession(session.id, {
                        scheduled_day: e.target.value,
                      })
                    }
                  />
                </>
              ) : (
                <>
                  <h2>{session.title}</h2>
                  <small>{session.scheduled_day}</small>
                </>
              )}
            </header>
            <div>
              {(session.session_blocks || [])
                .sort((a, b) => a.sequence - b.sequence)
                .map((block) => (
                  <div
                    className={`planned-block ${block.domain}`}
                    key={block.id}
                  >
                    <span>{block.stage}</span>
                    <div>
                      {canPlan ? (
                        <select
                          value={block.library_item_id || ""}
                          onChange={(e) => {
                            const item = library.find(
                              (x) => x.id === e.target.value,
                            );
                            void updateBlock(block.id, {
                              library_item_id: e.target.value || null,
                              instructions: item?.purpose || null,
                              success_criterion: item?.pass_criterion || null,
                              source_case_id: null,
                              recommendation_source: canCoach ? "coach_override" : "player_override",
                              recommendation_rationale: canCoach
                                ? "Coach changed Vector's suggested item after reviewing the player."
                                : "Player selected an alternative player-ready item.",
                              recommendation_score: null,
                              evidence_snapshot: null,
                            });
                          }}
                        >
                          <option value="">Choose a different player-ready item</option>
                          {selectable(block.domain).map((item) => (
                            <option value={item.id} key={item.id}>
                              {item.code} · {item.title}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <h3>{block.library_items?.title}</h3>
                      )}
                      <p>{block.instructions}</p>
                      {block.recommendation_rationale && (
                        <p className="recommendation-reason"><b>Why Vector suggested this:</b> {block.recommendation_rationale}</p>
                      )}
                      {block.library_items?.dosage && (
                        <small>{block.library_items.dosage}</small>
                      )}
                      {block.success_criterion && (
                        <small>Success: {block.success_criterion}</small>
                      )}
                    </div>
                    {canPlan ? (
                      <label>
                        Minutes
                        <input
                          type="number"
                          min="1"
                          max="300"
                          value={block.minutes}
                          onChange={(e) =>
                            setSessions((all) =>
                              all.map((s) => ({
                                ...s,
                                session_blocks: s.session_blocks.map((b) =>
                                  b.id === block.id
                                    ? { ...b, minutes: Number(e.target.value) }
                                    : b,
                                ),
                              })),
                            )
                          }
                          onBlur={(e) =>
                            updateBlock(block.id, {
                              minutes: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    ) : (
                      <strong>{block.minutes} min</strong>
                    )}
                  </div>
                ))}
            </div>
          </article>
        ))}
        {programme && !sessions.length && (
          <div className="empty-state compact">
            <h2>No sessions built for this week</h2>
            <p>
              {canPlan
                ? "Build Vector's suggested week, then review every assignment and minute before adding it to the plan."
                : "Your coach has not released this week yet."}
            </p>
          </div>
        )}
        {!programme && (
          <div className="empty-state compact">
            <h2>No programme available</h2>
            <p>
              Create and publish the 12-week programme foundation before
              building sessions.
            </p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
