"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase/client";
export type PlayerProfile = { id: string; display_name: string | null; email: string; role: "player" | "coach" | "admin" };
export type BandAggregate = { shot_band: string; opportunities: number; successes: number };
export function usePlayerData() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [rounds, setRounds] = useState<Array<{ id: string; played_at: string; course_name: string }>>([]);
  const [results, setResults] = useState<Array<{ shot_band: string; opportunities: number | null; successes: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient(); if (!supabase) { setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const [profileResult, roundsResult, resultsResult] = await Promise.all([
      supabase.from("profiles").select("id,display_name,email,role").eq("id", user.id).single(),
      supabase.from("rounds").select("id,played_at,course_name").eq("player_id", user.id).order("played_at", { ascending: false }),
      supabase.from("shot_band_results").select("shot_band,opportunities,successes").eq("player_id", user.id),
    ]);
    setProfile(profileResult.data); setRounds(roundsResult.data || []); setResults(resultsResult.data || []); setLoading(false);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  const aggregates = useMemo(() => Object.values(results.reduce<Record<string, BandAggregate>>((map, row) => { const item = map[row.shot_band] ||= { shot_band: row.shot_band, opportunities: 0, successes: 0 }; item.opportunities += row.opportunities ?? 0; item.successes += row.successes ?? 0; return map; }, {})), [results]);
  return { profile, rounds, results, aggregates, loading, refresh };
}
