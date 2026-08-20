"use client";
import { useMemo, useState } from "react";
import { AppShell } from "./ui/app-shell";
import { MetricCard } from "./ui/metric-card";
const focusAreas = [{ name: "Approach 125–150", score: 52, change: "+4", tone: "amber" }, { name: "Putting 6–15 ft", score: 64, change: "+7", tone: "green" }, { name: "Tee shots", score: 71, change: "+2", tone: "blue" }];
export default function Home() {
  const [sessions, setSessions] = useState(2);
  const progress = useMemo(() => Math.min(100, Math.round((sessions / 3) * 100)), [sessions]);
  return <AppShell active="today">
    <section className="hero-panel"><div><p className="eyebrow">Thursday · Week 1 of 12</p><h1>Good afternoon, Alex.</h1><p className="hero-copy">Your clearest route to lower scores is sharper distance control from 125–150 yards.</p></div><a className="primary-action" href="/rounds/new">Log a round <span aria-hidden="true">→</span></a></section>
    <section className="metric-grid" aria-label="Performance overview"><MetricCard label="Performance score" value="67" detail="+5 over last 5 rounds" accent="green" /><MetricCard label="Rounds recorded" value="8" detail="Enough data for a reliable trend" accent="blue" /><MetricCard label="Practice consistency" value={`${progress}%`} detail={`${sessions} of 3 sessions this week`} accent="amber" /></section>
    <div className="content-grid"><section className="panel priority-panel"><div className="section-heading"><div><p className="eyebrow">Engine priority</p><h2>Where gains are waiting</h2></div><a href="/performance">Full analysis</a></div><div className="priority-list">{focusAreas.map((area, index) => <article className="priority-row" key={area.name}><span className="rank">0{index + 1}</span><div className="priority-copy"><strong>{area.name}</strong><span>{index === 0 ? "High frequency · 48% successful" : "Improving over recent rounds"}</span></div><div className={`score-ring ${area.tone}`}><strong>{area.score}</strong><span>{area.change}</span></div></article>)}</div></section>
    <aside className="panel practice-panel"><div className="section-heading"><div><p className="eyebrow">Today</p><h2>Practice prescription</h2></div><span className="duration">28 min</span></div><div className="practice-block"><span>01</span><div><strong>Calibrate</strong><p>10 balls · three targets</p></div><b>8 min</b></div><div className="practice-block"><span>02</span><div><strong>Random ladder</strong><p>125 / 140 / 150 yards</p></div><b>12 min</b></div><div className="practice-block"><span>03</span><div><strong>Vector movement</strong><p>Lead-side pressure sequence</p></div><b>8 min</b></div><button className="complete-button" onClick={() => setSessions((value) => Math.min(3, value + 1))}>Mark session complete</button></aside></div>
    <section className="insight-strip"><div className="insight-mark">V</div><div><p className="eyebrow">Coach insight</p><h2>Your miss is becoming predictable.</h2><p>Six of your last nine failures from 125–150 yards finished short. The next session combines strike feedback with a pressure-shift movement block.</p></div><a href="/practice">Open session <span aria-hidden="true">→</span></a></section>
  </AppShell>;
}
