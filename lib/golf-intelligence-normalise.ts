export type Coordinate = { latitude?: number; longitude?: number };
export type RawHole = { holeId?: number; holeNumber?: number; par?: number; yardage?: number; teeGPSCoordinate?: Coordinate; greenGPSCoordinate?: Coordinate };
export type RawTee = { teeId?: number; courseTeeType?: string | number; isTeeActive?: boolean; holes?: RawHole[] };
export type RawCourse = { courseId?: number; tees?: RawTee[] };
export type RawGps = { holeId?: number; gpsType?: string; gpsCoordinate?: Coordinate; shapes?: Coordinate[][] };
export type GolfIntelligenceCourse = { publicId?: string; name?: string; updatedOn?: string; holes?: RawHole[]; gpsItems?: RawGps[]; facility?: unknown; courses?: RawCourse[]; data?: string | GolfIntelligenceCourse; [key:string]:unknown };

function populated<T>(preferred:T[]|undefined,fallback:T[]|undefined){return preferred?.length?preferred:fallback||[]}
function expanded(data:GolfIntelligenceCourse):GolfIntelligenceCourse{
  let nested:GolfIntelligenceCourse={};
  if(typeof data.data==="string"){try{const parsed=JSON.parse(data.data);if(parsed&&typeof parsed==="object")nested=parsed as GolfIntelligenceCourse}catch{/* Some responses use data as an opaque string. */}}
  else if(data.data&&typeof data.data==="object")nested=data.data;
  return {...nested,...data,courses:populated(data.courses,nested.courses),holes:populated(data.holes,nested.holes),gpsItems:populated(data.gpsItems,nested.gpsItems)};
}
export function mergeCourseParts(scorecard:GolfIntelligenceCourse,gps:GolfIntelligenceCourse):GolfIntelligenceCourse{const scoring=expanded(scorecard),mapping=expanded(gps);return {...scoring,...mapping,name:mapping.name||scoring.name,facility:mapping.facility||scoring.facility,courses:populated(scoring.courses,mapping.courses),holes:populated(mapping.holes,scoring.holes),gpsItems:populated(mapping.gpsItems,scoring.gpsItems)}}
function marker(items:RawGps[],holeId:number,type:string){return items.find(item=>item.holeId===holeId&&item.gpsType?.toLowerCase()===type.toLowerCase())?.gpsCoordinate}
function positive(...values:(number|undefined)[]){return values.find(value=>typeof value==="number"&&Number.isFinite(value)&&value>0)??null}

export function normaliseCourseDetail(data:GolfIntelligenceCourse){
  data=expanded(data);
  const gps=data.gpsItems||[];
  const activeTees=(data.courses||[]).flatMap(course=>course.tees||[]).filter(tee=>tee.isTeeActive!==false);
  const scoringHoles=activeTees.flatMap(tee=>tee.holes||[]);
  const seen=new Set<string>();
  const sourceHoles=[...(data.holes||[]),...scoringHoles].filter(hole=>{if(!hole.holeId||!hole.holeNumber)return false;const key=String(hole.holeNumber);if(seen.has(key))return false;seen.add(key);return true});
  const holes=sourceHoles.map(hole=>{const holeId=hole.holeId!,matches=scoringHoles.filter(item=>item.holeId===holeId||item.holeNumber===hole.holeNumber),score=matches.find(item=>positive(item.par)!==null)||matches[0],front=marker(gps,holeId,"FrontMarker"),center=marker(gps,holeId,"CenterMarker")||hole.greenGPSCoordinate||score?.greenGPSCoordinate,back=marker(gps,holeId,"BackMarker"),tee=hole.teeGPSCoordinate||score?.teeGPSCoordinate||marker(gps,holeId,"TeeboxMarker");return {provider_hole_id:holeId,hole_number:hole.holeNumber!,par:positive(hole.par,score?.par),yardage:positive(hole.yardage,score?.yardage),tee_latitude:tee?.latitude??null,tee_longitude:tee?.longitude??null,green_front_latitude:front?.latitude??null,green_front_longitude:front?.longitude??null,green_center_latitude:center?.latitude??null,green_center_longitude:center?.longitude??null,green_back_latitude:back?.latitude??null,green_back_longitude:back?.longitude??null}});
  const features=gps.flatMap(item=>(item.shapes||[]).filter(shape=>shape.length>1).map(shape=>({provider_hole_id:item.holeId||null,feature_type:item.gpsType||"GenericTrace",geometry:shape.filter(point=>Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)).map(point=>({latitude:point.latitude!,longitude:point.longitude!}))}))).filter(feature=>feature.geometry.length>1);
  return {holes,features,scorecardRecords:scoringHoles.length,parHoles:holes.filter(hole=>hole.par!==null).length};
}
