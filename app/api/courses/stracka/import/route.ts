import { NextResponse } from "next/server";
import { createClient } from "../../../../../src/lib/supabase/server";
import { createAdminClient } from "../../../../../src/lib/supabase/admin";
import { fetchCourseDetail,normaliseCourseDetail } from "../../../../../src/lib/golf-intelligence";

export async function POST(request:Request){
  try{
    const supabase=await createClient(),authorization=request.headers.get("authorization"),accessToken=authorization?.startsWith("Bearer ")?authorization.slice(7).trim():undefined;
    const{data:{user}}=accessToken?await supabase.auth.getUser(accessToken):await supabase.auth.getUser();
    if(!user)return NextResponse.json({error:"Please sign in."},{status:401});
    const admin=createAdminClient();
    const{data:profile}=await admin.from("profiles").select("role").eq("id",user.id).single();
    if(!profile||!["coach","admin"].includes(profile.role))return NextResponse.json({error:"Coach access is required."},{status:403});
    const body=await request.json() as {publicId?:string};const publicId=body.publicId?.trim();
    if(!publicId||publicId.length>120)return NextResponse.json({error:"Enter a valid Golf Intelligence public ID."},{status:400});
    const detail=await fetchCourseDetail(publicId),normalised=normaliseCourseDetail(detail);
    if(!normalised.holes.length)throw new Error("The course response did not contain any playable holes.");
    const{data:course,error:courseError}=await admin.from("course_catalog").upsert({provider:"golf_intelligence",provider_course_id:publicId,name:detail.name||"Imported golf course",updated_by_provider_at:detail.updatedOn||null,imported_at:new Date().toISOString(),raw_metadata:{facility:detail.facility,courses:detail.courses}},{onConflict:"provider,provider_course_id"}).select("id,name").single();
    if(courseError||!course)throw new Error(courseError?.message||"The course record could not be saved.");
    const{data:holes,error:holeError}=await admin.from("course_holes").upsert(normalised.holes.map(hole=>({...hole,course_id:course.id})),{onConflict:"course_id,provider_hole_id"}).select("id,provider_hole_id");
    if(holeError)throw new Error(holeError.message);
    const holeIds=new Map((holes||[]).map(hole=>[hole.provider_hole_id,hole.id]));await admin.from("course_features").delete().eq("course_id",course.id);
    const featureRows=normalised.features.map(feature=>({...feature,course_id:course.id,hole_id:feature.provider_hole_id?holeIds.get(feature.provider_hole_id)||null:null}));
    if(featureRows.length){const{error}=await admin.from("course_features").insert(featureRows);if(error)throw new Error(error.message)}
    return NextResponse.json({courseId:course.id,name:course.name,holes:normalised.holes.length,features:featureRows.length});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Course import failed."},{status:502})}
}
