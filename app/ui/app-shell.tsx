"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AuthGate } from "./auth-gate";
import { usePlayerData } from "../../lib/use-player-data";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: "home" | "play" | "practice" | "progress" | "more" | "chart" | "plan" | "coach" | "settings" | "library" | "course" | "sync" | "trackman";
};

const desktopPrimary: NavItem[] = [
  { id: "today", label: "Today", href: "/", icon: "home" },
  { id: "rounds", label: "Play", href: "/rounds", icon: "play" },
  { id: "performance", label: "Performance", href: "/performance", icon: "chart" },
  { id: "programme", label: "Programme", href: "/programme", icon: "plan" },
  { id: "practice", label: "Practice", href: "/practice", icon: "practice" },
  { id: "progress", label: "Progress", href: "/progress", icon: "progress" },
];

const playerMore: NavItem[] = [
  { id: "diagnostics", label: "Evidence", href: "/diagnostics", icon: "chart" },
  { id: "trackman", label: "TrackMan", href: "/trackman", icon: "trackman" },
  { id: "pilot", label: "Beta feedback", href: "/pilot", icon: "practice" },
  { id: "settings", label: "Settings & data", href: "/settings", icon: "settings" },
  { id: "sync", label: "Offline sync", href: "/sync", icon: "sync" },
];

const coachMore: NavItem[] = [
  { id: "coach", label: "Coach overview", href: "/coach", icon: "coach" },
  { id: "players", label: "Players", href: "/players", icon: "coach" },
  { id: "sessions", label: "Session builder", href: "/sessions", icon: "plan" },
  { id: "library", label: "Drill library", href: "/library", icon: "library" },
  { id: "courses", label: "Course data", href: "/courses", icon: "course" },
  { id: "trackman", label: "TrackMan", href: "/trackman", icon: "trackman" },
  { id: "diagnostics", label: "Evidence", href: "/diagnostics", icon: "chart" },
  { id: "release", label: "Release controls", href: "/release", icon: "settings" },
  { id: "pilot", label: "Beta feedback", href: "/pilot", icon: "practice" },
  { id: "settings", label: "Settings & data", href: "/settings", icon: "settings" },
];

const roundEntries = [
  ["Quick", "/rounds/new"], ["Detailed", "/rounds/detailed"],
  ["TrackMan", "/trackman"], ["Map my shots", "/rounds/map"],
] as const;

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const paths: Record<NavItem["icon"], ReactNode> = {
    home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7"/></>,
    play: <><path d="M12 3v18M3 12h18"/></>,
    practice: <><path d="m4 13 5 5L20 6"/></>,
    progress: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    chart: <><path d="M4 19V5M4 19h16"/><path d="m7 15 4-5 3 2 5-7"/></>,
    plan: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    coach: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>,
    library: <><path d="M4 4h6v16H4zM14 4h6v16h-6z"/><path d="M7 8h1M17 8h1"/></>,
    course: <><path d="M5 21V3M5 4c6-3 8 3 14 0v9c-6 3-8-3-14 0"/></>,
    sync: <><path d="M20 7h-6V1"/><path d="M20 7a9 9 0 1 0 1 9"/></>,
    trackman: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3M23 12h-3"/></>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function AppShell({ active, children }: { active: string; children: ReactNode }) {
  const { profile } = usePlayerData();
  const [menuOpen, setMenuOpen] = useState(false);
  const name = profile?.display_name || profile?.email || "Selected player";
  const initials = name.split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const coach = profile?.role === "coach" || profile?.role === "admin";
  const moreItems = coach ? coachMore : playerMore;
  const moreActive = moreItems.some((item) => item.id === active);
  const signOut = async () => { await getSupabaseBrowserClient()?.auth.signOut(); window.location.replace("/auth/login"); };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menuOpen]);

  const mobilePrimary = [desktopPrimary[0], desktopPrimary[1], desktopPrimary[4], desktopPrimary[5]];

  return <AuthGate><div className="app-frame">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Vector Golf Performance home"><span className="brand-mark" aria-hidden="true">V</span><span>VECTOR <small>GOLF PERFORMANCE</small></span></Link>
      <nav className="desktop-nav" aria-label="Primary navigation">{desktopPrimary.map((item) => <Link aria-current={active === item.id ? "page" : undefined} className={active === item.id ? "active" : ""} href={item.href} key={item.id}>{item.label}</Link>)}<button className={moreActive ? "active" : ""} onClick={() => setMenuOpen(true)} aria-haspopup="dialog">More</button></nav>
      <button className="profile profile-button" onClick={signOut} title="Sign out"><span><strong>{name}</strong><small>{profile?.role || "Beta access"} · Sign out</small></span><b aria-hidden="true">{initials || "VG"}</b></button>
      <button className="mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation menu" aria-expanded={menuOpen}><NavIcon name="more" /></button>
    </header>
    <main id="main-content" tabIndex={-1} className="main-content">
      {active === "rounds" && <nav className="round-entry-nav" aria-label="Round entry methods">{roundEntries.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</nav>}
      {children}
    </main>
    <nav className="mobile-nav" aria-label="Primary navigation">{mobilePrimary.map((item) => <Link aria-current={active === item.id ? "page" : undefined} className={active === item.id ? "active" : ""} href={item.href} key={item.id}><NavIcon name={item.icon}/><span>{item.label}</span></Link>)}<button className={moreActive || menuOpen ? "active" : ""} onClick={() => setMenuOpen(true)} aria-label="Open more navigation"><NavIcon name="more"/><span>More</span></button></nav>
    {menuOpen && <div className="nav-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }}><section className="nav-sheet" role="dialog" aria-modal="true" aria-labelledby="nav-sheet-title">
      <header><div><p className="eyebrow">Vector navigation</p><h2 id="nav-sheet-title">{coach ? "Coach tools" : "More"}</h2></div><button onClick={() => setMenuOpen(false)} aria-label="Close navigation menu">×</button></header>
      <nav aria-label="Additional navigation">{moreItems.map((item) => <Link aria-current={active === item.id ? "page" : undefined} className={active === item.id ? "active" : ""} href={item.href} onClick={() => setMenuOpen(false)} key={item.id}><NavIcon name={item.icon}/><span>{item.label}</span><b aria-hidden="true">›</b></Link>)}</nav>
      <footer><span className="nav-avatar" aria-hidden="true">{initials || "VG"}</span><div><strong>{name}</strong><small>{profile?.role || "Beta access"}</small></div><button onClick={signOut}>Sign out</button></footer>
    </section></div>}
  </div></AuthGate>;
}
