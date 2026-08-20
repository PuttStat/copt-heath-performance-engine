"use client";
import { useEffect, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "../../lib/supabase/client";
export function AuthGate({ children }: { children: ReactNode }) { const [ready, setReady] = useState(!hasSupabaseConfig()); useEffect(() => { const supabase = getSupabaseBrowserClient(); if (!supabase) return; supabase.auth.getSession().then(({ data }) => { if (!data.session) window.location.replace("/auth/login"); else setReady(true); }); const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (!session) window.location.replace("/auth/login"); }); return () => data.subscription.unsubscribe(); }, []); return ready ? children : <main className="auth-page"><p>Loading your programme…</p></main>; }
