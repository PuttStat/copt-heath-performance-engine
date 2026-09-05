import "server-only";
import type { GolfIntelligenceCourse } from "../../lib/golf-intelligence-normalise";
export { mergeCourseParts,normaliseCourseDetail,type GolfIntelligenceCourse } from "../../lib/golf-intelligence-normalise";
const api="https://api.golfintelligence.com";

async function accessToken(){
  const clientId=process.env.GOLF_INTELLIGENCE_CLIENT_ID,activeToken=process.env.GOLF_INTELLIGENCE_ACTIVE_TOKEN;
  if(!clientId||!activeToken)throw new Error("Golf Intelligence credentials are not configured.");
  const response=await fetch(`${api}/auth/authenticateToken`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"client_credentials",code:activeToken,client_id:clientId}),cache:"no-store"});
  if(!response.ok)throw new Error(`Golf Intelligence authentication failed (${response.status}).`);
  const body=await response.json() as {access_token?:string};
  if(!body.access_token)throw new Error("Golf Intelligence did not return an access token.");
  return body.access_token;
}
export async function fetchCourseDetail(publicId:string){
  const token=await accessToken();
  const response=await fetch(`${api}/courses/getCourseGroupDetail?PublicId=${encodeURIComponent(publicId)}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
  if(!response.ok)throw new Error(`Course download failed (${response.status}).`);
  return response.json() as Promise<GolfIntelligenceCourse>;
}
async function fetchCoursePart(publicId:string,path:string,label:string){
  const token=await accessToken();
  const response=await fetch(`${api}${path}?PublicId=${encodeURIComponent(publicId)}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
  if(!response.ok)throw new Error(`${label} download failed (${response.status}).`);
  return response.json() as Promise<GolfIntelligenceCourse>;
}
export const fetchCourseGps=(publicId:string)=>fetchCoursePart(publicId,"/courses/getCourseGroupGPS","Course GPS");
export const fetchCourseScorecard=(publicId:string)=>fetchCoursePart(publicId,"/courses/getCourseGroupScorecard","Course scorecard");
