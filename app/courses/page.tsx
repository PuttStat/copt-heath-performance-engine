"use client";
import { useState } from "react";
import { AppShell } from "../ui/app-shell";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
export default function CoursesPage(){
  const[publicId,setPublicId]=useState(""),[working,setWorking]=useState(false),[message,setMessage]=useState(""),[mode,setMode]=useState<"full"|"scorecard">("scorecard");
  const importCourse=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const requestedMode=((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null)?.value==="full"?"full":"scorecard";setMode(requestedMode);setWorking(true);setMessage("");try{
    const supabase=getSupabaseBrowserClient();if(!supabase)throw new Error("Supabase is not configured for this deployment.");
    const{data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("Your session has expired. Please sign out and sign in again.");
    const response=await fetch("/api/courses/stracka/import",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({publicId,mode:requestedMode})});
    const body=await response.json();if(!response.ok)throw new Error(body.error||"Import failed.");
    const scorecard=`${body.parHoles}/${body.holes} holes with par (${body.scorecardRecords} tee-level records found)`;
    setMessage(body.mappingUpdated?`${body.name} ready: ${scorecard} and ${body.features} mapped features (${body.credits} credits used).`:`${body.name}: ${scorecard} (${body.credits} credit${body.credits===1?"":"s"} used). ${body.parHoles?"Scorecard saved.":"Stracka returned no recognised par values."} Existing map geometry was preserved.`);setPublicId("");
  }catch(error){setMessage(error instanceof Error?error.message:"Import failed.")}finally{setWorking(false)}};
  return <AppShell active="courses"><header className="page-heading"><div><p className="eyebrow">Coach tools · Course data</p><h1>Course importer</h1><p>Import a licensed Golf Intelligence course into Vector using its public ID. Credentials remain server-side.</p></div></header>{message&&<div className="success-banner" role="status">{message}</div>}<section className="course-import-card"><div><span>GI</span><h2>Golf Intelligence / StrackaGolf</h2><p>Refresh only the scorecard for one credit. Use the complete three-credit import when you also want to check for GPS polygons.</p></div><form onSubmit={importCourse}><label>Course public ID<input required value={publicId} onChange={event=>setPublicId(event.target.value)} placeholder="Paste publicId"/></label><button type="submit" value="scorecard" className="secondary-action" disabled={working}>{working&&mode==="scorecard"?"Importing…":"Refresh scorecard · 1 credit"}</button><button type="submit" value="full" className="primary-action" disabled={working}>{working&&mode==="full"?"Importing…":"Scorecard + GPS · 3 credits"}</button></form></section></AppShell>
}
