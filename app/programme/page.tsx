"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "../ui/app-shell";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { usePlayerData } from "../../lib/use-player-data";
import {
  buildDiagnosticObservations,
  type MissAggregate,
} from "../../lib/diagnostic-engine";
import {
  recommendPlanItems,
  buildGolfPracticeSequence,
  recommendationForSession,
  splitGolfPracticeMinutes,
  splitMinutes,
  type ApprovedPrescription,
  type RecommendationLibraryItem,
} from "../../lib/programme-recommendation";
import {
  programmeTemplate,
  type ProgrammeLength,
} from "../../lib/programme-templates";
import {
  suggestSwingMovement,
  type SwingMovement,
} from "../../lib/swing-movement-recommendation";
import styles from "./programme-length.module.css";

type Player = { id: string; display_name: string | null; email: string };
type Intake = {
  player_id: string;
  primary_goal: string;
  outcome_target: string;
  weekly_golf_minutes: number;
  weekly_vector_minutes: number;
  sessions_per_week: number;
  available_days: string[];
  facilities: string[];
  competition_dates: string;
  recovery_constraints: string;
  consent_confirmed: boolean;
};
type Programme = {
  id: string;
  player_id: string;
  coach_id: string;
  title: string;
  primary_goal: string;
  start_date: string;
  status: "draft" | "published" | "completed" | "archived";
  planning_mode: "coach_led" | "self_directed";
  golf_minutes_per_week: number;
  vector_minutes_per_week: number;
  current_week: number;
  created_at: string;
};
type Week = {
  id: string;
  week_number: number;
  phase: "Measure" | "Build" | "Stabilise" | "Transfer" | "Perform";
  focus: string;
  golf_minutes: number;
  vector_minutes: number;
  review_type: string | null;
  coach_notes: string | null;
  status: string;
};
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const facilities = [
  "Driving range",
  "Short-game area",
  "Putting green",
  "Golf course",
  "Gym",
  "Home equipment",
  "Launch monitor",
];
const practiceRoleLabel = {
  technical_1: "Technical correction 1",
  technical_2: "Technical correction 2",
  performance_test: "Performance test",
};
const blankIntake = (id: string): Intake => ({
  player_id: id,
  primary_goal: "",
  outcome_target: "",
  weekly_golf_minutes: 180,
  weekly_vector_minutes: 60,
  sessions_per_week: 3,
  available_days: [],
  facilities: [],
  competition_dates: "",
  recovery_constraints: "",
  consent_confirmed: false,
});
export default function ProgrammePage() {
  const { profile } = usePlayerData();
  const [players, setPlayers] = useState<Player[]>([]),
    [selectedId, setSelectedId] = useState(""),
    [intake, setIntake] = useState<Intake | null>(null),
    [programme, setProgramme] = useState<Programme | null>(null),
    [programmeHistory, setProgrammeHistory] = useState<Programme[]>([]),
    [weeks, setWeeks] = useState<Week[]>([]),
    [programmeLength, setProgrammeLength] = useState<ProgrammeLength>(12),
    [deleteTarget, setDeleteTarget] = useState<Programme | null>(null),
    [hasCoach, setHasCoach] = useState(false),
    [message, setMessage] = useState("");
  const canCoach = profile?.role === "coach" || profile?.role === "admin";
  const targetId = canCoach ? selectedId : profile?.id || "";
  const loadPlayers = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !profile || !canCoach) return;
    const { data: links } = await sb
      .from("coach_player_links")
      .select("player_id")
      .eq("coach_id", profile.id);
    const ids = (links || []).map((link) => link.player_id);
    if (!ids.length) {
      setPlayers([]);
      return;
    }
    const { data } = await sb
      .from("profiles")
      .select("id,display_name,email")
      .in("id", ids)
      .order("display_name");
    const linked = (data || []) as Player[];
    setPlayers(linked);
    setSelectedId((current) =>
      current && linked.some((player) => player.id === current)
        ? current
        : linked[0]?.id || "",
    );
  }, [profile, canCoach]);
  const loadProgramme = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !targetId) return;
    const [intakeResult, programmeResult, linkResult, historyResult] =
      await Promise.all([
        sb
          .from("programme_intakes")
          .select("*")
          .eq("player_id", targetId)
          .maybeSingle(),
        sb
          .from("programmes")
          .select("*")
          .eq("player_id", targetId)
          .in(
            "status",
            canCoach ? ["draft", "published"] : ["published", "completed"],
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        canCoach
          ? Promise.resolve({ data: [] })
          : sb
              .from("coach_player_links")
              .select("coach_id")
              .eq("player_id", targetId),
        canCoach
          ? sb
              .from("programmes")
              .select("*")
              .eq("player_id", targetId)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);
    setHasCoach(!canCoach && !!linkResult.data?.length);
    setIntake((intakeResult.data as Intake | null) || blankIntake(targetId));
    const found = programmeResult.data as Programme | null;
    setProgramme(found);
    setProgrammeHistory((historyResult.data || []) as Programme[]);
    if (found) {
      const { data } = await sb
        .from("programme_weeks")
        .select("*")
        .eq("programme_id", found.id)
        .order("week_number");
      setWeeks((data || []) as Week[]);
    } else setWeeks([]);
  }, [targetId, canCoach]);
  useEffect(() => {
    const timer = setTimeout(() => void loadPlayers(), 0);
    return () => clearTimeout(timer);
  }, [loadPlayers]);
  useEffect(() => {
    const timer = setTimeout(() => void loadProgramme(), 0);
    return () => clearTimeout(timer);
  }, [loadProgramme]);
  const saveIntake = async (event: React.FormEvent) => {
    event.preventDefault();
    const sb = getSupabaseBrowserClient();
    if (!sb || !intake || !profile || canCoach) return;
    const { error } = await sb.from("programme_intakes").upsert({
      ...intake,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setMessage(
      error ? error.message : "Programme questionnaire saved for your coach.",
    );
  };
  const createProgramme = async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !profile || !targetId || !intake) return;
    const selfDirected = !canCoach;
    const selectedLength: ProgrammeLength = selfDirected ? 12 : programmeLength;
    if (selfDirected && hasCoach) {
      setMessage(
        "Your linked coach controls the programme. Ask them to generate or amend the plan.",
      );
      return;
    }
    const start = new Date();
    start.setDate(start.getDate() + ((8 - start.getDay()) % 7));
    const { data, error } = await sb
      .from("programmes")
      .insert({
        player_id: targetId,
        coach_id: profile.id,
        planning_mode: selfDirected ? "self_directed" : "coach_led",
        title: `${selectedLength}-Week Performance Programme`,
        primary_goal: intake.primary_goal || "Improve scoring performance",
        start_date: start.toISOString().slice(0, 10),
        golf_minutes_per_week: intake.weekly_golf_minutes,
        vector_minutes_per_week: intake.weekly_vector_minutes,
      })
      .select("*")
      .single();
    if (error || !data) {
      setMessage(error?.message || "Could not create programme.");
      return;
    }
    const rows = programmeTemplate(selectedLength).map(
      ([week_number, phase, focus, review_type]) => ({
        programme_id: data.id,
        week_number,
        phase,
        focus,
        golf_minutes: intake.weekly_golf_minutes,
        vector_minutes: intake.weekly_vector_minutes,
        review_type,
        status: "draft",
      }),
    );
    const { data: createdWeeks, error: weekError } = await sb
      .from("programme_weeks")
      .insert(rows)
      .select("id,week_number,phase,focus,golf_minutes,vector_minutes");
    if (weekError || !createdWeeks) {
      setMessage(weekError?.message || "Could not create the programme weeks.");
      await loadProgramme();
      return;
    }
    if (!selfDirected) {
      setMessage(`${selectedLength}-week programme created as a coach draft.`);
      await loadProgramme();
      return;
    }

    const [libraryResult, resultRows, detailedRows, caseRows, movementRows] =
      await Promise.all([
        sb
          .from("library_items")
          .select(
            "id,code,title,item_type,category,stage,purpose,dosage,pass_criterion,equipment,guardrails,instruction_complete",
          )
          .eq("status", "approved")
          .eq("instruction_complete", true),
        sb
          .from("shot_band_results")
          .select("shot_band,opportunities,successes")
          .eq("player_id", targetId),
        sb
          .from("detailed_shots")
          .select("shot_band,success,miss_length,miss_direction")
          .eq("player_id", targetId),
        sb
          .from("diagnostic_cases")
          .select(
            "id,priority_score,evidence_summary,case_recommendations(rationale,library_items(id,code,title,item_type,category,stage,purpose,dosage,pass_criterion,equipment,guardrails,instruction_complete))",
          )
          .eq("player_id", targetId)
          .eq("status", "approved"),
        sb
          .from("swing_movements")
          .select("id,code,p_position,title,body_target,pressure_target,hands_arms_target,shaft_face_target,incorrect_patterns,rehearsal,acceptance_gate,applicable_categories")
          .eq("status", "approved")
          .order("p_position"),
      ]);
    const library = (libraryResult.data || []) as RecommendationLibraryItem[];
    const swingMovements = (movementRows.data || []) as SwingMovement[];
    const aggregateMap: Record<
      string,
      { shot_band: string; opportunities: number; successes: number }
    > = {};
    for (const row of resultRows.data || []) {
      const aggregate = (aggregateMap[row.shot_band] ||= {
        shot_band: row.shot_band,
        opportunities: 0,
        successes: 0,
      });
      aggregate.opportunities += row.opportunities || 0;
      aggregate.successes += row.successes || 0;
    }
    const missMap: Record<string, MissAggregate> = {};
    for (const shot of detailedRows.data || []) {
      const miss = (missMap[shot.shot_band] ||= {
        shot_band: shot.shot_band,
        failures: 0,
        short: 0,
        long: 0,
        left: 0,
        right: 0,
      });
      if (!shot.success) {
        miss.failures++;
        if (shot.miss_length === "short") miss.short++;
        if (shot.miss_length === "long") miss.long++;
        if (shot.miss_direction === "left") miss.left++;
        if (shot.miss_direction === "right") miss.right++;
      }
    }
    const observations = buildDiagnosticObservations(
      Object.values(aggregateMap),
      Object.values(missMap),
    );
    const approved: ApprovedPrescription[] = [];
    for (const diagnostic of caseRows.data || [])
      for (const rec of diagnostic.case_recommendations || []) {
        const raw = rec.library_items as unknown;
        const item = (
          Array.isArray(raw) ? raw[0] : raw
        ) as RecommendationLibraryItem | null;
        if (
          item?.instruction_complete &&
          !approved.some((entry) => entry.item.id === item.id)
        )
          approved.push({
            item,
            caseId: diagnostic.id,
            priorityScore: Number(diagnostic.priority_score || 0),
            rationale: rec.rationale || diagnostic.evidence_summary,
          });
      }
    const plans = new Map<number, ReturnType<typeof recommendPlanItems>>();
    for (const week of createdWeeks)
      plans.set(
        week.week_number,
        recommendPlanItems({
          library,
          observations,
          approved,
          phase: week.phase,
          facilities: intake.facilities,
          recoveryConstraints: intake.recovery_constraints || "",
        }),
      );
    const sessionCount = Math.min(
      7,
      Math.max(1, intake.sessions_per_week || 3),
    );
    const complete = createdWeeks.every((week) => {
      const plan = plans.get(week.week_number);
      return (
        !!plan?.golf.length &&
        Array.from({ length: sessionCount }, (_, index) =>
          buildGolfPracticeSequence({
            recommended: plan.golf,
            library,
            facilities: intake.facilities,
            weekNumber: week.week_number,
            sessionIndex: index,
          }),
        ).every((sequence) => sequence.length === 3) &&
        (week.vector_minutes === 0 || !!plan.vector.length)
      );
    });
    if (!complete) {
      setMessage(
        `Vector created the ${selectedLength}-week framework, but there is not yet enough usable player data or suitable library content to populate every session. Record more evidence, then build the suggested weeks in Sessions.`,
      );
      await loadProgramme();
      return;
    }
    const sessionRows = createdWeeks.flatMap((week) =>
      Array.from({ length: sessionCount }, (_, index) => ({
        programme_week_id: week.id,
        session_number: index + 1,
        title: `${week.phase} session ${index + 1}`,
        objective: week.focus,
        status: "draft",
      })),
    );
    const { data: createdSessions, error: sessionError } = await sb
      .from("programme_sessions")
      .insert(sessionRows)
      .select("id,programme_week_id,session_number");
    if (sessionError || !createdSessions) {
      setMessage(
        sessionError?.message || "Could not build the recommended sessions.",
      );
      await loadProgramme();
      return;
    }
    const weekById = new Map(createdWeeks.map((week) => [week.id, week]));
    const blocks: Array<Record<string, unknown>> = [];
    for (const session of createdSessions) {
      const week = weekById.get(session.programme_week_id);
      if (!week) continue;
      const plan = plans.get(week.week_number)!;
      const index = session.session_number - 1;
      const golfSplit = splitMinutes(week.golf_minutes, sessionCount),
        vectorCount = Math.min(2, sessionCount),
        vectorSplit = splitMinutes(week.vector_minutes, vectorCount);
      const golf = buildGolfPracticeSequence({
        recommended: plan.golf,
        library,
        facilities: intake.facilities,
        weekNumber: week.week_number,
        sessionIndex: index,
      });
      const practiceMinutes = splitGolfPracticeMinutes(golfSplit[index]);
      const movementSuggestion = suggestSwingMovement(golf[0]?.item, swingMovements);
      golf.forEach((drill, drillIndex) => {
        if (practiceMinutes[drillIndex] <= 0) return;
        blocks.push({
          session_id: session.id,
          sequence: drillIndex + 1,
          domain: "golf",
          stage: drill.stage,
          minutes: practiceMinutes[drillIndex],
          library_item_id: drill.item.id,
          source_case_id: drill.sourceCaseId || null,
          instructions: `${practiceRoleLabel[drill.role]} · ${drill.allocationPercent}% of practice balls (${drill.allocationPercent} of a 100-ball bucket). ${drill.item.purpose}`,
          success_criterion: drill.item.pass_criterion,
          recommendation_source: drill.sourceCaseId
            ? "coach_approved"
            : "vector_engine",
          recommendation_rationale: drill.rationale,
          recommendation_score: drill.score,
          evidence_snapshot: drill.evidence,
          swing_movement_id: drillIndex === 0 ? movementSuggestion.movement?.id || null : null,
          swing_movement_source: drillIndex === 0 && movementSuggestion.movement ? "vector_engine" : null,
          swing_movement_rationale: drillIndex === 0 ? movementSuggestion.rationale : null,
        });
      });
      if (index < vectorCount && vectorSplit[index] > 0) {
        const vector = recommendationForSession(
          plan.vector,
          week.week_number,
          index,
        );
        blocks.push({
          session_id: session.id,
          sequence: 4,
          domain: "vector",
          stage: "vector",
          minutes: vectorSplit[index],
          library_item_id: vector?.item.id,
          source_case_id: vector?.sourceCaseId || null,
          instructions: vector?.item.purpose,
          success_criterion: vector?.item.pass_criterion,
          recommendation_source: vector?.sourceCaseId
            ? "coach_approved"
            : "vector_engine",
          recommendation_rationale: vector?.rationale,
          recommendation_score: vector?.score,
          evidence_snapshot: vector?.evidence,
        });
      }
    }
    const { error: blockError } = await sb
      .from("session_blocks")
      .insert(blocks);
    if (blockError) {
      setMessage(blockError.message);
      await loadProgramme();
      return;
    }
    const needsReview =
      (intake.recovery_constraints || "").trim().length > 0 ||
      [...plans.values()].some((plan) => plan.requiresReview);
    if (!needsReview) {
      const weekIds = createdWeeks.map((week) => week.id);
      const { error: publishWeekError } = await sb
        .from("programme_weeks")
        .update({ status: "published", updated_at: new Date().toISOString() })
        .in("id", weekIds);
      if (!publishWeekError) {
        await sb
          .from("programme_sessions")
          .update({ status: "published", updated_at: new Date().toISOString() })
          .in("programme_week_id", weekIds);
        await sb
          .from("programmes")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            recommendation_generated_at: new Date().toISOString(),
            recommendation_snapshot: {
              evidence: observations.slice(0, 3).map((item) => ({
                band: item.band,
                priority_score: item.priorityScore,
                confidence: item.confidence,
              })),
              facilities: intake.facilities,
            },
          })
          .eq("id", data.id);
      } else {
        setMessage(publishWeekError.message);
        await loadProgramme();
        return;
      }
    }
    setMessage(
      needsReview
        ? `Vector produced all ${selectedLength} weeks as a draft. Review the suggested Vector exercises against your recovery or pain information before publishing.`
        : `Vector produced and published your personalised ${selectedLength}-week practice plan. You can change any suggested drill or exercise in Sessions.`,
    );
    await loadProgramme();
  };
  const updateProgramme = async (changes: Partial<Programme>) => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !programme) return;
    const publish =
      changes.status === "published"
        ? { published_at: new Date().toISOString() }
        : {};
    const { error } = await sb
      .from("programmes")
      .update({ ...changes, ...publish, updated_at: new Date().toISOString() })
      .eq("id", programme.id);
    if (!error && changes.status === "published")
      await sb
        .from("programme_weeks")
        .update({ status: "published", updated_at: new Date().toISOString() })
        .eq("programme_id", programme.id);
    setMessage(error ? error.message : "Programme updated.");
    if (!error) await loadProgramme();
  };
  const updateWeek = async (id: string, changes: Partial<Week>) => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    const { error } = await sb
      .from("programme_weeks")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", id);
    setMessage(error ? error.message : "Week updated.");
    if (!error) await loadProgramme();
  };
  const startNewProgramme = async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !canCoach || !programme) return;
    const { error } = await sb
      .from("programmes")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", programme.id);
    setMessage(
      error
        ? error.message
        : "Previous programme archived. Choose the length of the new programme.",
    );
    if (!error) await loadProgramme();
  };
  const deleteProgramme = async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !canCoach || !deleteTarget) return;
    const { error } = await sb
      .from("programmes")
      .delete()
      .eq("id", deleteTarget.id);
    setMessage(
      error
        ? error.message
        : `${deleteTarget.title} and its associated programme records were permanently deleted.`,
    );
    if (!error) {
      setDeleteTarget(null);
      await loadProgramme();
    }
  };
  const totalGolf = useMemo(
      () => weeks.reduce((sum, week) => sum + week.golf_minutes, 0),
      [weeks],
    ),
    totalVector = useMemo(
      () => weeks.reduce((sum, week) => sum + week.vector_minutes, 0),
      [weeks],
    );
  return (
    <AppShell active="programme">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Data-led programme planning</p>
          <h1>Build the right programme.</h1>
          <p>
            Vector ranks the player’s evidence, proposes the most suitable
            drills and exercises, and keeps every recommendation editable.
          </p>
        </div>
      </header>
      {message && (
        <div className="success-banner" role="status">
          {message}
        </div>
      )}
      {canCoach && (
        <section className="programme-player">
          <label>
            Programme player
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="">Choose linked player</option>
              {players.map((player) => (
                <option value={player.id} key={player.id}>
                  {player.display_name || player.email}
                </option>
              ))}
            </select>
          </label>
          <span>
            {programme ? `${programme.status} programme` : "No programme yet"}
          </span>
        </section>
      )}
      {targetId && intake && !canCoach && (
        <form className="intake-card" onSubmit={saveIntake}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Player questionnaire</p>
              <h2>Make the plan fit real life.</h2>
            </div>
          </div>
          <div className="intake-grid">
            <label>
              Primary goal
              <input
                value={intake.primary_goal}
                onChange={(event) =>
                  setIntake({ ...intake, primary_goal: event.target.value })
                }
                required
              />
            </label>
            <label>
              Programme outcome target
              <input
                value={intake.outcome_target}
                onChange={(event) =>
                  setIntake({ ...intake, outcome_target: event.target.value })
                }
              />
            </label>
            <label>
              Golf practice minutes per week
              <input
                type="number"
                min="0"
                value={intake.weekly_golf_minutes}
                onChange={(event) =>
                  setIntake({
                    ...intake,
                    weekly_golf_minutes: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Vector minutes per week
              <input
                type="number"
                min="0"
                value={intake.weekly_vector_minutes}
                onChange={(event) =>
                  setIntake({
                    ...intake,
                    weekly_vector_minutes: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Sessions per week
              <input
                type="number"
                min="1"
                max="7"
                value={intake.sessions_per_week}
                onChange={(event) =>
                  setIntake({
                    ...intake,
                    sessions_per_week: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Competition dates
              <textarea
                value={intake.competition_dates}
                onChange={(event) =>
                  setIntake({
                    ...intake,
                    competition_dates: event.target.value,
                  })
                }
              />
            </label>
            <label className="wide">
              Recovery, pain or schedule constraints
              <textarea
                value={intake.recovery_constraints}
                onChange={(event) =>
                  setIntake({
                    ...intake,
                    recovery_constraints: event.target.value,
                  })
                }
              />
            </label>
          </div>
          <fieldset>
            <legend>Available days</legend>
            {days.map((day) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={intake.available_days.includes(day)}
                  onChange={() =>
                    setIntake({
                      ...intake,
                      available_days: intake.available_days.includes(day)
                        ? intake.available_days.filter((item) => item !== day)
                        : [...intake.available_days, day],
                    })
                  }
                />
                {day.slice(0, 3)}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Facilities available</legend>
            {facilities.map((item) => (
              <label key={item}>
                <input
                  type="checkbox"
                  checked={intake.facilities.includes(item)}
                  onChange={() =>
                    setIntake({
                      ...intake,
                      facilities: intake.facilities.includes(item)
                        ? intake.facilities.filter((value) => value !== item)
                        : [...intake.facilities, item],
                    })
                  }
                />
                {item}
              </label>
            ))}
          </fieldset>
          <label className="consent">
            <input
              type="checkbox"
              checked={intake.consent_confirmed}
              onChange={(event) =>
                setIntake({
                  ...intake,
                  consent_confirmed: event.target.checked,
                })
              }
              required
            />
            I confirm this information can be used to generate and adjust my
            programme.
          </label>
          <button className="primary-action">Save questionnaire</button>
        </form>
      )}
      {canCoach && targetId && intake && !programme && (
        <section className="programme-empty">
          <p className="eyebrow">Vector recommendation ready</p>
          <h2>{intake.primary_goal || "Player questionnaire not completed"}</h2>
          <p>
            {intake.weekly_golf_minutes} golf minutes +{" "}
            {intake.weekly_vector_minutes} Vector minutes per week ·{" "}
            {intake.sessions_per_week} sessions
          </p>
          <label className={styles.lengthPicker}>
            Programme length
            <select
              value={programmeLength}
              onChange={(event) =>
                setProgrammeLength(
                  Number(event.target.value) as ProgrammeLength,
                )
              }
            >
              <option value={4}>4 weeks · focused intervention</option>
              <option value={8}>8 weeks · development block</option>
              <option value={12}>12 weeks · complete programme</option>
            </select>
          </label>
          <button
            className="primary-action"
            onClick={createProgramme}
            disabled={!intake.primary_goal}
          >
            Create data-led {programmeLength}-week draft
          </button>
        </section>
      )}
      {!canCoach &&
        targetId &&
        intake &&
        !programme &&
        !hasCoach &&
        intake.consent_confirmed && (
          <section className="programme-empty">
            <p className="eyebrow">Self-directed Vector plan</p>
            <h2>Let Vector produce your next 12 weeks</h2>
            <p>
              The plan will use your recorded performance data, available
              facilities and practice time. Every drill remains changeable.
            </p>
            <button
              className="primary-action"
              onClick={createProgramme}
              disabled={!intake.primary_goal}
            >
              Generate my 12-week plan
            </button>
          </section>
        )}
      {!canCoach && hasCoach && !programme && (
        <section className="programme-empty">
          <p className="eyebrow">Coach-led programme</p>
          <h2>Your coach will review Vector’s suggestions</h2>
          <p>
            Your data is ready for your coach to generate, amend and release the
            plan.
          </p>
        </section>
      )}
      {programme && (
        <>
          <section className="programme-summary">
            <div>
              <span>Status</span>
              <strong>{programme.status}</strong>
            </div>
            <div>
              <span>Length</span>
              <strong>{weeks.length} weeks</strong>
            </div>
            <div>
              <span>Golf allocation</span>
              <strong>{totalGolf} min</strong>
            </div>
            <div>
              <span>Vector allocation</span>
              <strong>{totalVector} min</strong>
            </div>
            <div>
              <span>Start</span>
              <strong>
                {new Date(
                  programme.start_date + "T12:00:00",
                ).toLocaleDateString("en-GB")}
              </strong>
            </div>
            {canCoach && (
              <button
                className="primary-action"
                onClick={() =>
                  updateProgramme({
                    status:
                      programme.status === "published" ? "draft" : "published",
                  })
                }
              >
                {programme.status === "published"
                  ? "Return to draft"
                  : "Publish programme"}
              </button>
            )}
          </section>
          {canCoach && (
            <section className={styles.managementBar}>
              <div>
                <span>Programme management</span>
                <strong>Ready to begin a new coaching cycle?</strong>
                <small>
                  Starting a new programme archives this one and keeps its
                  records in programme history.
                </small>
              </div>
              <button className="secondary-action" onClick={startNewProgramme}>
                Start new programme
              </button>
              <button
                className={styles.deleteButton}
                onClick={() => setDeleteTarget(programme)}
              >
                Delete programme
              </button>
            </section>
          )}
          <section className="programme-timeline">
            {weeks.map((week) => (
              <article
                className={`programme-week phase-${week.phase.toLowerCase()}`}
                key={week.id}
              >
                <header>
                  <span>Week {String(week.week_number).padStart(2, "0")}</span>
                  <b>{week.phase}</b>
                  {week.review_type && <small>{week.review_type}</small>}
                </header>
                <div>
                  <h2>{week.focus}</h2>
                  {canCoach ? (
                    <>
                      <label>
                        Weekly focus
                        <input
                          value={week.focus}
                          onChange={(event) =>
                            setWeeks((current) =>
                              current.map((item) =>
                                item.id === week.id
                                  ? { ...item, focus: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          onBlur={(event) =>
                            updateWeek(week.id, { focus: event.target.value })
                          }
                        />
                      </label>
                      <div className="minute-fields">
                        <label>
                          Golf minutes
                          <input
                            type="number"
                            min="0"
                            value={week.golf_minutes}
                            onChange={(event) =>
                              setWeeks((current) =>
                                current.map((item) =>
                                  item.id === week.id
                                    ? {
                                        ...item,
                                        golf_minutes: Number(
                                          event.target.value,
                                        ),
                                      }
                                    : item,
                                ),
                              )
                            }
                            onBlur={(event) =>
                              updateWeek(week.id, {
                                golf_minutes: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Vector minutes
                          <input
                            type="number"
                            min="0"
                            value={week.vector_minutes}
                            onChange={(event) =>
                              setWeeks((current) =>
                                current.map((item) =>
                                  item.id === week.id
                                    ? {
                                        ...item,
                                        vector_minutes: Number(
                                          event.target.value,
                                        ),
                                      }
                                    : item,
                                ),
                              )
                            }
                            onBlur={(event) =>
                              updateWeek(week.id, {
                                vector_minutes: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                      </div>
                      <label>
                        Coach note
                        <textarea
                          defaultValue={week.coach_notes || ""}
                          onBlur={(event) =>
                            updateWeek(week.id, {
                              coach_notes: event.target.value,
                            })
                          }
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <p>
                        {week.golf_minutes} golf minutes · {week.vector_minutes}{" "}
                        Vector minutes
                      </p>
                      {week.coach_notes && (
                        <blockquote>{week.coach_notes}</blockquote>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}
          </section>
        </>
      )}
      {canCoach && targetId && programmeHistory.length > 0 && (
        <section className={styles.history}>
          <header>
            <div>
              <p className="eyebrow">Programme history</p>
              <h2>Previous coaching cycles</h2>
            </div>
            <span>{programmeHistory.length} programmes</span>
          </header>
          <div>
            {programmeHistory.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    Started{" "}
                    {new Date(item.start_date + "T12:00:00").toLocaleDateString(
                      "en-GB",
                    )}{" "}
                    · {item.status}
                    {item.id === programme?.id ? " · current" : ""}
                  </span>
                </div>
                <button onClick={() => setDeleteTarget(item)}>Delete</button>
              </article>
            ))}
          </div>
        </section>
      )}
      {!targetId && (
        <div className="empty-state compact">
          <h2>Select a linked player</h2>
          <p>Choose a player to build or edit their programme.</p>
        </div>
      )}
      {deleteTarget && (
        <div
          className={styles.confirmScrim}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDeleteTarget(null);
          }}
        >
          <section
            className={styles.confirmDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-programme-title"
          >
            <p className="eyebrow">Permanent deletion</p>
            <h2 id="delete-programme-title">Delete this programme?</h2>
            <p>
              <strong>{deleteTarget.title}</strong> and all of its programme
              weeks, sessions, completion records, reviews and retests will be
              permanently removed. Round and TrackMan performance data will not
              be deleted.
            </p>
            <div>
              <button onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className={styles.confirmDelete}
                onClick={deleteProgramme}
              >
                Permanently delete
              </button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
