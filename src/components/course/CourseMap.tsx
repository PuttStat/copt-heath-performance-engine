"use client";
import type { Coordinate, CourseFeature, CourseHole, MappedShot } from "../../../lib/course-mapping";

const fills: Array<[RegExp,string]> = [[/Green/i,"#7ed78b"],[/Fairway/i,"#4fa56f"],[/Teebox/i,"#76b98b"],[/Bunker/i,"#e9d39e"],[/Water|Hazard|Penalty/i,"#4d91b8"],[/Vegetation|Trees/i,"#245d43"],[/Cartpath/i,"#b8b4a8"],[/Boundry|Generic/i,"#315e49"]];
const colour = (type: string) => fills.find(([pattern]) => pattern.test(type))?.[1] || "#356d50";

export function CourseMap({ hole, features, shots, onSelect }: { hole: CourseHole; features: CourseFeature[]; shots: MappedShot[]; onSelect: (coordinate: Coordinate) => void }) {
  const all = features.flatMap((feature) => feature.geometry);
  if (hole.tee_latitude != null && hole.tee_longitude != null) all.push({latitude:hole.tee_latitude,longitude:hole.tee_longitude});
  if (hole.green_center_latitude != null && hole.green_center_longitude != null) all.push({latitude:hole.green_center_latitude,longitude:hole.green_center_longitude});
  if (!all.length) return <div className="map-empty">This hole has no mapped coordinates yet.</div>;
  const lats=all.map(p=>p.latitude),lons=all.map(p=>p.longitude),minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons);
  const latPad=Math.max((maxLat-minLat)*.08,.00003),lonPad=Math.max((maxLon-minLon)*.08,.00003);
  const bounds={minLat:minLat-latPad,maxLat:maxLat+latPad,minLon:minLon-lonPad,maxLon:maxLon+lonPad};
  const project=(p:Coordinate)=>({x:((p.longitude-bounds.minLon)/(bounds.maxLon-bounds.minLon))*1000,y:(1-(p.latitude-bounds.minLat)/(bounds.maxLat-bounds.minLat))*700});
  const unproject=(x:number,y:number):Coordinate=>({longitude:bounds.minLon+(x/1000)*(bounds.maxLon-bounds.minLon),latitude:bounds.minLat+(1-y/700)*(bounds.maxLat-bounds.minLat)});
  const click=(event:React.MouseEvent<SVGSVGElement>)=>{const rect=event.currentTarget.getBoundingClientRect();onSelect(unproject(((event.clientX-rect.left)/rect.width)*1000,((event.clientY-rect.top)/rect.height)*700));};
  return <div className="course-map-shell"><svg className="course-map" viewBox="0 0 1000 700" role="img" aria-label={`Hole ${hole.hole_number} course map. Tap where the ball finished.`} onClick={click}>
    <defs><radialGradient id="terrain"><stop offset="0" stopColor="#234c3a"/><stop offset="1" stopColor="#102a24"/></radialGradient></defs>
    <rect width="1000" height="700" fill="url(#terrain)"/>
    {features.filter(f=>f.geometry.length>1).map(feature=><polygon key={feature.id} points={feature.geometry.map(point=>{const p=project(point);return `${p.x},${p.y}`}).join(" ")} fill={colour(feature.feature_type)} fillOpacity={/Boundry/i.test(feature.feature_type)?.25:.92} stroke="rgba(255,255,255,.18)" strokeWidth="2"/>)}
    {shots.map((shot,index)=>{const p=project({latitude:shot.endLatitude,longitude:shot.endLongitude});return <g key={shot.id} transform={`translate(${p.x} ${p.y})`}><circle r="17" fill={shot.success?"#e6b85c":"#fff"} stroke="#102a24" strokeWidth="4"/><text y="5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#102a24">{index+1}</text></g>})}
    {hole.green_center_latitude!=null&&hole.green_center_longitude!=null&&(()=>{const p=project({latitude:hole.green_center_latitude!,longitude:hole.green_center_longitude!});return <g transform={`translate(${p.x} ${p.y})`}><path d="M0 18V-26" stroke="white" strokeWidth="4"/><path d="M2 -25L35 -13L2 -2Z" fill="#e6b85c"/></g>})()}
  </svg><span className="map-tap-hint">Tap the ball’s finishing position</span></div>;
}
