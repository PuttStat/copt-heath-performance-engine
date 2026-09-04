import Link from "next/link";
import { AppShell } from "../ui/app-shell";

const methods=[
  {number:"01",title:"Quick round",copy:"Fast success totals across Vector shot bands.",href:"/rounds/new",status:"Fastest"},
  {number:"02",title:"Detailed round",copy:"Hole-by-hole outcomes and miss patterns.",href:"/rounds/detailed",status:"More evidence"},
  {number:"03",title:"TrackMan import",copy:"Turn launch-monitor exports into diagnostics.",href:"/trackman",status:"File import"},
  {number:"04",title:"Map my shots",copy:"Plot every shot, measure yardage and build traditional statistics.",href:"/rounds/map",status:"New"},
];
export default function RoundsPage(){return <AppShell active="rounds"><header className="page-heading"><div><p className="eyebrow">Four ways to build the picture</p><h1>Record your game.</h1><p>Choose the level of detail that fits today. Every route feeds the same Vector performance engine.</p></div></header><section className="capture-grid">{methods.map(method=><Link className="capture-card" href={method.href} key={method.number}><span>{method.number}</span><div><small>{method.status}</small><h2>{method.title}</h2><p>{method.copy}</p></div><b aria-hidden="true">↗</b></Link>)}</section></AppShell>}
