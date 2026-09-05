"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl, { type GeoJSONSource } from "mapbox-gl";
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties, LineString, Point, Polygon } from "geojson";
import type { Coordinate, CourseFeature, CourseHole, MappedShot } from "../../../lib/course-mapping";

type Props = {
  hole: CourseHole;
  features: CourseFeature[];
  shots: MappedShot[];
  teePosition: Coordinate;
  candidate: Coordinate | null;
  magnetToGreen: boolean;
  onCandidateChange: (coordinate: Coordinate) => void;
  onTeeChange: (coordinate: Coordinate) => void;
};

const fills: Array<[RegExp, string]> = [[/Green/i,"#7ed78b"],[/Fairway/i,"#4fa56f"],[/Teebox/i,"#76b98b"],[/Bunker/i,"#e9d39e"],[/Water|Hazard|Penalty/i,"#4d91b8"],[/Vegetation|Trees/i,"#245d43"],[/Cartpath/i,"#b8b4a8"],[/Boundry|Generic/i,"#315e49"]];
const colour = (type: string) => fills.find(([pattern]) => pattern.test(type))?.[1] || "#356d50";
const lngLat = (point: Coordinate): [number, number] => [point.longitude, point.latitude];
const coordinate = (point: mapboxgl.LngLat): Coordinate => ({ latitude: point.lat, longitude: point.lng });

function featureData(features: CourseFeature[]): FeatureCollection<Polygon> {
  const polygons = features.flatMap((feature) => {
    if (feature.geometry.length < 3) return [];
    const ring = feature.geometry.map(lngLat), first = ring[0], last = ring.at(-1)!;
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    return [{ type: "Feature", properties: { colour: colour(feature.feature_type), opacity: /Boundry|Generic/i.test(feature.feature_type) ? .3 : .48, type: feature.feature_type }, geometry: { type: "Polygon", coordinates: [ring] } } as Feature<Polygon>];
  });
  return { type: "FeatureCollection", features: polygons };
}

function shotLineData(shots: MappedShot[]): FeatureCollection<LineString> {
  return { type: "FeatureCollection", features: shots.map((shot) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[shot.startLongitude,shot.startLatitude],[shot.endLongitude,shot.endLatitude]] } })) };
}

function previewLineData(tee: Coordinate, shots: MappedShot[], candidate: Coordinate | null): FeatureCollection<LineString> {
  if (!candidate) return { type: "FeatureCollection", features: [] };
  const previous = shots.at(-1), start = previous ? { latitude: previous.endLatitude, longitude: previous.endLongitude } : tee;
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [lngLat(start),lngLat(candidate)] } }] };
}

function pointData(hole: CourseHole, shots: MappedShot[]): FeatureCollection<Point> {
  const points: Feature<Point>[] = [];
  if (hole.green_center_latitude != null && hole.green_center_longitude != null) points.push({ type: "Feature", properties: { kind: "green", label: "G" }, geometry: { type: "Point", coordinates: [hole.green_center_longitude,hole.green_center_latitude] } });
  shots.forEach((shot,index) => points.push({ type: "Feature", properties: { kind: shot.success ? "success" : "miss", label: String(index + 1) }, geometry: { type: "Point", coordinates: [shot.endLongitude,shot.endLatitude] } }));
  return { type: "FeatureCollection", features: points };
}

function setData(map: mapboxgl.Map, id: string, data: FeatureCollection<Geometry,GeoJsonProperties>) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

function teeToGreenBearing(tee: Coordinate, green: Coordinate | null) {
  if (!green) return 0;
  const radians = (value: number) => value * Math.PI / 180;
  const lat1 = radians(tee.latitude), lat2 = radians(green.latitude), deltaLongitude = radians(green.longitude - tee.longitude);
  const y = Math.sin(deltaLongitude) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLongitude);
  return Math.atan2(y,x) * 180 / Math.PI;
}

function snapToGreen(map: mapboxgl.Map, point: Coordinate, green: Coordinate | null, enabled: boolean) {
  if (!green || !enabled) return point;
  const selected = map.project(lngLat(point)), target = map.project(lngLat(green));
  return Math.hypot(selected.x - target.x, selected.y - target.y) <= 34 ? green : point;
}

function markerElement(className: string, text: string) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `map-drag-marker ${className}`;
  element.textContent = text;
  element.setAttribute("aria-label", className === "tee-marker" ? "Drag to adjust tee position" : "Drag to refine shot position");
  return element;
}

function SvgFallback({ hole, features, shots, teePosition, candidate, onCandidateChange }: Props) {
  const all = features.flatMap((feature) => feature.geometry);all.push(teePosition);
  if (hole.green_center_latitude != null && hole.green_center_longitude != null) all.push({ latitude: hole.green_center_latitude, longitude: hole.green_center_longitude });
  const lats = all.map((point) => point.latitude), lons = all.map((point) => point.longitude), minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const latPad = Math.max((maxLat-minLat)*.08,.00003), lonPad = Math.max((maxLon-minLon)*.08,.00003), bounds = { minLat:minLat-latPad,maxLat:maxLat+latPad,minLon:minLon-lonPad,maxLon:maxLon+lonPad };
  const project = (point: Coordinate) => ({ x: ((point.longitude-bounds.minLon)/(bounds.maxLon-bounds.minLon))*1000, y: (1-(point.latitude-bounds.minLat)/(bounds.maxLat-bounds.minLat))*700 });
  const unproject = (x: number,y: number): Coordinate => ({ longitude:bounds.minLon+(x/1000)*(bounds.maxLon-bounds.minLon),latitude:bounds.minLat+(1-y/700)*(bounds.maxLat-bounds.minLat) });
  const click = (event: React.MouseEvent<SVGSVGElement>) => { const rect = event.currentTarget.getBoundingClientRect(); onCandidateChange(unproject(((event.clientX-rect.left)/rect.width)*1000,((event.clientY-rect.top)/rect.height)*700)); };
  const ordered = [...features].sort((a,b) => (/Boundry|Generic/i.test(a.feature_type)?-1:1)-(/Boundry|Generic/i.test(b.feature_type)?-1:1));
  const tee = project(teePosition), last=shots.at(-1), previewStart = last ? project({ latitude:last.endLatitude,longitude:last.endLongitude }) : tee;
  return <svg className="course-map" viewBox="0 0 1000 700" role="img" aria-label={`Hole ${hole.hole_number} course map. Tap to position the next shot.`} onClick={click}>
    <defs><radialGradient id="terrain"><stop offset="0" stopColor="#234c3a"/><stop offset="1" stopColor="#102a24"/></radialGradient></defs><rect width="1000" height="700" fill="url(#terrain)"/>
    {ordered.filter((feature) => feature.geometry.length>1).map((feature) => <polygon key={feature.id} points={feature.geometry.map((point) => { const position=project(point); return `${position.x},${position.y}`; }).join(" ")} fill={colour(feature.feature_type)} fillOpacity={/Boundry|Generic/i.test(feature.feature_type)?.3:.92} stroke="rgba(255,255,255,.18)" strokeWidth="2"/>)}
    {shots.map((shot) => { const start=project({latitude:shot.startLatitude,longitude:shot.startLongitude}),end=project({latitude:shot.endLatitude,longitude:shot.endLongitude}); return <line key={`${shot.id}-line`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#f7f2e8" strokeWidth="4" strokeDasharray="10 8" opacity=".85"/>; })}
    {candidate && (() => { const end=project(candidate); return <line x1={previewStart.x} y1={previewStart.y} x2={end.x} y2={end.y} stroke="#e6b85c" strokeWidth="5" strokeDasharray="7 6"/>; })()}
    <g transform={`translate(${tee.x} ${tee.y})`}><circle r="16" fill="#fff" stroke="#102a24" strokeWidth="4"/><text y="5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#102a24">T</text></g>
    {shots.map((shot,index) => { const point=project({latitude:shot.endLatitude,longitude:shot.endLongitude}); return <g key={shot.id} transform={`translate(${point.x} ${point.y})`}><circle r="17" fill={shot.success?"#e6b85c":"#fff"} stroke="#102a24" strokeWidth="4"/><text y="5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#102a24">{index+1}</text></g>; })}
    {candidate && (() => { const point=project(candidate); return <g transform={`translate(${point.x} ${point.y})`}><circle r="22" fill="#e6b85c" stroke="white" strokeWidth="5"/><text y="6" textAnchor="middle" fontSize="18" fontWeight="800" fill="#102a24">+</text></g>; })()}
    {hole.green_center_latitude!=null&&hole.green_center_longitude!=null&&(() => { const point=project({latitude:hole.green_center_latitude!,longitude:hole.green_center_longitude!}); return <g transform={`translate(${point.x} ${point.y})`}><circle r="17" fill="#e6b85c" stroke="#102a24" strokeWidth="4"/><text y="5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#102a24">G</text></g>; })()}
  </svg>;
}

export function CourseMap(props: Props) {
  const { hole,features,shots,teePosition,candidate,magnetToGreen,onCandidateChange,onTeeChange } = props;
  const containerRef=useRef<HTMLDivElement>(null),mapRef=useRef<mapboxgl.Map|null>(null),teeMarkerRef=useRef<mapboxgl.Marker|null>(null),candidateMarkerRef=useRef<mapboxgl.Marker|null>(null);
  const candidateChangeRef=useRef(onCandidateChange),teeChangeRef=useRef(onTeeChange),magnetRef=useRef(magnetToGreen);
  const token=process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const green=useMemo(()=>hole.green_center_latitude!=null&&hole.green_center_longitude!=null?{latitude:hole.green_center_latitude,longitude:hole.green_center_longitude}:null,[hole.green_center_latitude,hole.green_center_longitude]);
  const coordinates=features.flatMap((feature)=>feature.geometry);coordinates.push(teePosition);if(green)coordinates.push(green);

  useEffect(()=>{candidateChangeRef.current=onCandidateChange},[onCandidateChange]);
  useEffect(()=>{teeChangeRef.current=onTeeChange},[onTeeChange]);
  useEffect(()=>{magnetRef.current=magnetToGreen},[magnetToGreen]);

  useEffect(()=>{
    if(!token||!containerRef.current||!coordinates.length)return;
    const map=new mapboxgl.Map({container:containerRef.current,accessToken:token,style:"mapbox://styles/mapbox/standard-satellite",center:lngLat(teePosition),zoom:16,pitch:0,bearing:teeToGreenBearing(teePosition,green),attributionControl:true});
    mapRef.current=map;map.addControl(new mapboxgl.NavigationControl({showCompass:false}),"bottom-right");
    map.on("click",(event)=>{if((event.originalEvent.target as HTMLElement).closest(".map-drag-marker"))return;candidateChangeRef.current(snapToGreen(map,coordinate(event.lngLat),green,magnetRef.current))});
    map.on("load",()=>{
      map.addSource("vector-features",{type:"geojson",data:featureData(features)});map.addLayer({id:"vector-feature-fills",type:"fill",source:"vector-features",paint:{"fill-color":["get","colour"],"fill-opacity":["get","opacity"],"fill-outline-color":"rgba(255,255,255,.5)"}});
      map.addSource("vector-shot-lines",{type:"geojson",data:shotLineData(shots)});map.addLayer({id:"vector-shot-lines",type:"line",source:"vector-shot-lines",paint:{"line-color":"#fffaf0","line-width":3,"line-dasharray":[2,1.5]}});
      map.addSource("vector-preview-line",{type:"geojson",data:previewLineData(teePosition,shots,candidate)});map.addLayer({id:"vector-preview-line",type:"line",source:"vector-preview-line",paint:{"line-color":"#e6b85c","line-width":4,"line-dasharray":[1.3,1.1]}});
      map.addSource("vector-points",{type:"geojson",data:pointData(hole,shots)});map.addLayer({id:"vector-points",type:"circle",source:"vector-points",paint:{"circle-radius":["match",["get","kind"],"green",13,12],"circle-color":["match",["get","kind"],"green","#e6b85c","miss","#fffaf0","#e6b85c"],"circle-stroke-color":"#102a24","circle-stroke-width":3}});map.addLayer({id:"vector-point-labels",type:"symbol",source:"vector-points",layout:{"text-field":["get","label"],"text-size":12,"text-font":["Open Sans Bold","Arial Unicode MS Bold"]},paint:{"text-color":"#102a24"}});
      const bearing=teeToGreenBearing(teePosition,green),bounds=new mapboxgl.LngLatBounds();coordinates.forEach((point)=>bounds.extend(lngLat(point)));map.fitBounds(bounds,{padding:{top:64,bottom:64,left:50,right:50},maxZoom:18,duration:0,bearing});
    });
    return()=>{teeMarkerRef.current?.remove();candidateMarkerRef.current?.remove();teeMarkerRef.current=null;candidateMarkerRef.current=null;map.remove();mapRef.current=null};
  // Each hole gets a newly oriented map. Live source and marker changes are handled below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[hole.id,token]);

  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    if(!teeMarkerRef.current){const marker=new mapboxgl.Marker({element:markerElement("tee-marker","T"),draggable:true}).setLngLat(lngLat(teePosition)).addTo(map);marker.on("drag",()=>teeChangeRef.current(coordinate(marker.getLngLat())));teeMarkerRef.current=marker}else teeMarkerRef.current.setLngLat(lngLat(teePosition));
    if(candidate){
      if(!candidateMarkerRef.current){const marker=new mapboxgl.Marker({element:markerElement("candidate-marker","+"),draggable:true}).setLngLat(lngLat(candidate)).addTo(map);marker.on("drag",()=>candidateChangeRef.current(coordinate(marker.getLngLat())));marker.on("dragend",()=>{const selected=snapToGreen(map,coordinate(marker.getLngLat()),green,magnetRef.current);marker.setLngLat(lngLat(selected));candidateChangeRef.current(selected)});candidateMarkerRef.current=marker}else candidateMarkerRef.current.setLngLat(lngLat(candidate));
    }else{candidateMarkerRef.current?.remove();candidateMarkerRef.current=null}
  },[candidate,green,teePosition]);

  useEffect(()=>{const map=mapRef.current;if(!map?.isStyleLoaded())return;setData(map,"vector-features",featureData(features));setData(map,"vector-shot-lines",shotLineData(shots));setData(map,"vector-preview-line",previewLineData(teePosition,shots,candidate));setData(map,"vector-points",pointData(hole,shots))},[candidate,features,hole,shots,teePosition]);

  return <div className="course-map-shell">{token?<div ref={containerRef} className="course-map mapbox-course-map" role="application" aria-label={`Interactive satellite map of hole ${hole.hole_number}. Tap to place a shot, then drag the marker to refine it.`}/>:<SvgFallback {...props}/>}<span className="map-tap-hint">{token?"Tap to place · drag + to refine · drag T to adjust tee":"Add a Mapbox token to enable satellite imagery"}</span></div>;
}
