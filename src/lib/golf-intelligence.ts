import "server-only";

type Coordinate = { latitude?: number; longitude?: number };
type RawHole = { holeId?: number; holeNumber?: number; par?: number; yardage?: number; teeGPSCoordinate?: Coordinate; greenGPSCoordinate?: Coordinate };
type RawGps = { holeId?: number; gpsType?: string; gpsCoordinate?: Coordinate; shapes?: Coordinate[][] };
export type GolfIntelligenceCourse = { publicId?: string; name?: string; updatedOn?: string; holes?: RawHole[]; gpsItems?: RawGps[]; facility?: unknown; courses?: unknown[]; [key:string]:unknown };
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
function marker(items:RawGps[],holeId:number,type:string){return items.find(item=>item.holeId===holeId&&item.gpsType===type)?.gpsCoordinate}
export function normaliseCourseDetail(data:GolfIntelligenceCourse){
  const gps=data.gpsItems||[];
  const holes=(data.holes||[]).filter(hole=>hole.holeId&&hole.holeNumber).map(hole=>{const holeId=hole.holeId!;const front=marker(gps,holeId,"FrontMarker"),center=marker(gps,holeId,"CenterMarker")||hole.greenGPSCoordinate,back=marker(gps,holeId,"BackMarker");return {provider_hole_id:holeId,hole_number:hole.holeNumber!,par:hole.par||null,yardage:hole.yardage||null,tee_latitude:hole.teeGPSCoordinate?.latitude??null,tee_longitude:hole.teeGPSCoordinate?.longitude??null,green_front_latitude:front?.latitude??null,green_front_longitude:front?.longitude??null,green_center_latitude:center?.latitude??null,green_center_longitude:center?.longitude??null,green_back_latitude:back?.latitude??null,green_back_longitude:back?.longitude??null}});
  const features=gps.flatMap(item=>(item.shapes||[]).filter(shape=>shape.length>1).map(shape=>({provider_hole_id:item.holeId||null,feature_type:item.gpsType||"GenericTrace",geometry:shape.filter(point=>Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)).map(point=>({latitude:point.latitude!,longitude:point.longitude!}))}))).filter(feature=>feature.geometry.length>1);
  return {holes,features};
}
