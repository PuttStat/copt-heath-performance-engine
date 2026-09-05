"use client";
import { useEffect,useRef } from "react";
import mapboxgl,{type GeoJSONSource} from "mapbox-gl";
import type { Feature,FeatureCollection,Geometry,GeoJsonProperties,LineString,Point,Polygon } from "geojson";
import type { Coordinate,CourseFeature,CourseHole,MappedShot } from "../../../lib/course-mapping";

const fills:Array<[RegExp,string]>=[[/Green/i,"#7ed78b"],[/Fairway/i,"#4fa56f"],[/Teebox/i,"#76b98b"],[/Bunker/i,"#e9d39e"],[/Water|Hazard|Penalty/i,"#4d91b8"],[/Vegetation|Trees/i,"#245d43"],[/Cartpath/i,"#b8b4a8"],[/Boundry|Generic/i,"#315e49"]];
const colour=(type:string)=>fills.find(([pattern])=>pattern.test(type))?.[1]||"#356d50";
const lngLat=(point:Coordinate):[number,number]=>[point.longitude,point.latitude];

function featureData(features:CourseFeature[]):FeatureCollection<Polygon>{
  const polygons=features.flatMap(feature=>{if(feature.geometry.length<3)return[];const ring=feature.geometry.map(lngLat),first=ring[0],last=ring.at(-1)!;if(first[0]!==last[0]||first[1]!==last[1])ring.push(first);return[{type:"Feature",properties:{colour:colour(feature.feature_type),opacity:/Boundry|Generic/i.test(feature.feature_type)?.3:.48,type:feature.feature_type},geometry:{type:"Polygon",coordinates:[ring]}} as Feature<Polygon>]});
  return{type:"FeatureCollection",features:polygons};
}

function shotLineData(shots:MappedShot[]):FeatureCollection<LineString>{return{type:"FeatureCollection",features:shots.map(shot=>({type:"Feature",properties:{},geometry:{type:"LineString",coordinates:[[shot.startLongitude,shot.startLatitude],[shot.endLongitude,shot.endLatitude]]}}))}}

function pointData(hole:CourseHole,shots:MappedShot[]):FeatureCollection<Point>{
  const points:Feature<Point>[]=[];
  if(hole.tee_latitude!=null&&hole.tee_longitude!=null)points.push({type:"Feature",properties:{kind:"tee",label:"T"},geometry:{type:"Point",coordinates:[hole.tee_longitude,hole.tee_latitude]}});
  if(hole.green_center_latitude!=null&&hole.green_center_longitude!=null)points.push({type:"Feature",properties:{kind:"green",label:"G"},geometry:{type:"Point",coordinates:[hole.green_center_longitude,hole.green_center_latitude]}});
  shots.forEach((shot,index)=>points.push({type:"Feature",properties:{kind:shot.success?"success":"miss",label:String(index+1)},geometry:{type:"Point",coordinates:[shot.endLongitude,shot.endLatitude]}}));
  return{type:"FeatureCollection",features:points};
}

function setData(map:mapboxgl.Map,id:string,data:FeatureCollection<Geometry,GeoJsonProperties>){(map.getSource(id)as GeoJSONSource|undefined)?.setData(data)}

function SvgFallback({hole,features,shots,onSelect}:{hole:CourseHole;features:CourseFeature[];shots:MappedShot[];onSelect:(coordinate:Coordinate)=>void}){
  const all=features.flatMap(feature=>feature.geometry);
  if(hole.tee_latitude!=null&&hole.tee_longitude!=null)all.push({latitude:hole.tee_latitude,longitude:hole.tee_longitude});
  if(hole.green_center_latitude!=null&&hole.green_center_longitude!=null)all.push({latitude:hole.green_center_latitude,longitude:hole.green_center_longitude});
  if(!all.length)return <div className="map-empty">This hole has no mapped coordinates yet.</div>;
  const lats=all.map(point=>point.latitude),lons=all.map(point=>point.longitude),minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons);
  const latPad=Math.max((maxLat-minLat)*.08,.00003),lonPad=Math.max((maxLon-minLon)*.08,.00003),bounds={minLat:minLat-latPad,maxLat:maxLat+latPad,minLon:minLon-lonPad,maxLon:maxLon+lonPad};
  const project=(point:Coordinate)=>({x:((point.longitude-bounds.minLon)/(bounds.maxLon-bounds.minLon))*1000,y:(1-(point.latitude-bounds.minLat)/(bounds.maxLat-bounds.minLat))*700});
  const unproject=(x:number,y:number):Coordinate=>({longitude:bounds.minLon+(x/1000)*(bounds.maxLon-bounds.minLon),latitude:bounds.minLat+(1-y/700)*(bounds.maxLat-bounds.minLat)});
  const click=(event:React.MouseEvent<SVGSVGElement>)=>{const rect=event.currentTarget.getBoundingClientRect();onSelect(unproject(((event.clientX-rect.left)/rect.width)*1000,((event.clientY-rect.top)/rect.height)*700))};
  const ordered=[...features].sort((a,b)=>(/Boundry|Generic/i.test(a.feature_type)?-1:1)-(/Boundry|Generic/i.test(b.feature_type)?-1:1));
  const tee=hole.tee_latitude!=null&&hole.tee_longitude!=null?project({latitude:hole.tee_latitude,longitude:hole.tee_longitude}):null;
  return <svg className="course-map" viewBox="0 0 1000 700" role="img" aria-label={`Hole ${hole.hole_number} course map. Tap where the ball finished.`} onClick={click}>
    <defs><radialGradient id="terrain"><stop offset="0" stopColor="#234c3a"/><stop offset="1" stopColor="#102a24"/></radialGradient></defs><rect width="1000" height="700" fill="url(#terrain)"/>
    {ordered.filter(feature=>feature.geometry.length>1).map(feature=><polygon key={feature.id} points={feature.geometry.map(point=>{const p=project(point);return`${p.x},${p.y}`}).join(" ")} fill={colour(feature.feature_type)} fillOpacity={/Boundry|Generic/i.test(feature.feature_type)?.3:.92} stroke="rgba(255,255,255,.18)" strokeWidth="2"/>)}
    {shots.map(shot=>{const start=project({latitude:shot.startLatitude,longitude:shot.startLongitude}),end=project({latitude:shot.endLatitude,longitude:shot.endLongitude});return <line key={`${shot.id}-line`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#f7f2e8" strokeWidth="4" strokeDasharray="10 8" opacity=".85"/>})}
    {tee&&<g transform={`translate(${tee.x} ${tee.y})`}><circle r="12" fill="#f7f2e8" stroke="#102a24" strokeWidth="4"/><circle r="3" fill="#102a24"/></g>}
    {shots.map((shot,index)=>{const point=project({latitude:shot.endLatitude,longitude:shot.endLongitude});return <g key={shot.id} transform={`translate(${point.x} ${point.y})`}><circle r="17" fill={shot.success?"#e6b85c":"#fff"} stroke="#102a24" strokeWidth="4"/><text y="5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#102a24">{index+1}</text></g>})}
    {hole.green_center_latitude!=null&&hole.green_center_longitude!=null&&(()=>{const point=project({latitude:hole.green_center_latitude!,longitude:hole.green_center_longitude!});return <g transform={`translate(${point.x} ${point.y})`}><path d="M0 18V-26" stroke="white" strokeWidth="4"/><path d="M2 -25L35 -13L2 -2Z" fill="#e6b85c"/></g>})()}
  </svg>;
}

export function CourseMap({hole,features,shots,onSelect}:{hole:CourseHole;features:CourseFeature[];shots:MappedShot[];onSelect:(coordinate:Coordinate)=>void}){
  const containerRef=useRef<HTMLDivElement>(null),mapRef=useRef<mapboxgl.Map|null>(null),selectRef=useRef(onSelect),token=process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const coordinates=features.flatMap(feature=>feature.geometry);
  if(hole.tee_latitude!=null&&hole.tee_longitude!=null)coordinates.push({latitude:hole.tee_latitude,longitude:hole.tee_longitude});
  if(hole.green_center_latitude!=null&&hole.green_center_longitude!=null)coordinates.push({latitude:hole.green_center_latitude,longitude:hole.green_center_longitude});

  useEffect(()=>{selectRef.current=onSelect},[onSelect]);

  useEffect(()=>{
    if(!token||!containerRef.current||!coordinates.length)return;
    const first=coordinates[0],map=new mapboxgl.Map({container:containerRef.current,accessToken:token,style:"mapbox://styles/mapbox/standard-satellite",center:lngLat(first),zoom:16,pitch:0,bearing:0,attributionControl:true});
    mapRef.current=map;map.addControl(new mapboxgl.NavigationControl({showCompass:false}),"bottom-right");
    map.on("click",event=>selectRef.current({latitude:event.lngLat.lat,longitude:event.lngLat.lng}));
    map.on("load",()=>{
      map.addSource("vector-features",{type:"geojson",data:featureData(features)});map.addLayer({id:"vector-feature-fills",type:"fill",source:"vector-features",paint:{"fill-color":["get","colour"],"fill-opacity":["get","opacity"],"fill-outline-color":"rgba(255,255,255,.5)"}});
      map.addSource("vector-shot-lines",{type:"geojson",data:shotLineData(shots)});map.addLayer({id:"vector-shot-lines",type:"line",source:"vector-shot-lines",paint:{"line-color":"#fffaf0","line-width":3,"line-dasharray":[2,1.5]}});
      map.addSource("vector-points",{type:"geojson",data:pointData(hole,shots)});map.addLayer({id:"vector-points",type:"circle",source:"vector-points",paint:{"circle-radius":["match",["get","kind"],"green",10,"tee",8,12],"circle-color":["match",["get","kind"],"green","#e6b85c","tee","#fffaf0","miss","#fffaf0","#e6b85c"],"circle-stroke-color":"#102a24","circle-stroke-width":3}});map.addLayer({id:"vector-point-labels",type:"symbol",source:"vector-points",layout:{"text-field":["get","label"],"text-size":11,"text-font":["Open Sans Bold","Arial Unicode MS Bold"]},paint:{"text-color":"#102a24"}});
      if(coordinates.length>1){const bounds=new mapboxgl.LngLatBounds();coordinates.forEach(point=>bounds.extend(lngLat(point)));map.fitBounds(bounds,{padding:{top:50,bottom:50,left:42,right:42},maxZoom:18,duration:0})}
    });
    return()=>{map.remove();mapRef.current=null};
  // A new hole receives a newly framed map; live shot/source updates are handled below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[hole.id,token]);

  useEffect(()=>{const map=mapRef.current;if(!map?.isStyleLoaded())return;setData(map,"vector-features",featureData(features));setData(map,"vector-shot-lines",shotLineData(shots));setData(map,"vector-points",pointData(hole,shots))},[hole,features,shots]);

  if(!coordinates.length)return <div className="map-empty">This hole has no mapped coordinates yet.</div>;
  return <div className="course-map-shell">{token?<div ref={containerRef} className="course-map mapbox-course-map" role="application" aria-label={`Interactive satellite map of hole ${hole.hole_number}. Tap where the ball finished.`}/>:<SvgFallback hole={hole} features={features} shots={shots} onSelect={onSelect}/>}<span className="map-tap-hint">{token?"Satellite · tap the ball’s finishing position":"Add a Mapbox token to enable satellite imagery"}</span></div>;
}
