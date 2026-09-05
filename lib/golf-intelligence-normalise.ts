export type Coordinate = { latitude?: number; longitude?: number };
export type RawHole = { holeId?: number; holeNumber?: number; par?: number; yardage?: number; teeGPSCoordinate?: Coordinate; greenGPSCoordinate?: Coordinate };
export type RawTee = { teeId?: number; courseTeeType?: string; isTeeActive?: boolean; holes?: RawHole[] };
export type RawCourse = { courseId?: number; tees?: RawTee[] };
export type RawGps = { holeId?: number; gpsType?: string; gpsCoordinate?: Coordinate; shapes?: Coordinate[][] };
export type GolfIntelligenceCourse = { publicId?: string; name?: string; updatedOn?: string; holes?: RawHole[]; gpsItems?: RawGps[]; facility?: unknown; courses?: RawCourse[]; [key:string]:unknown };

export function mergeCourseParts(scorecard:GolfIntelligenceCourse,gps:GolfIntelligenceCourse):GolfIntelligenceCourse{return {...scorecard,...gps,name:gps.name||scorecard.name,facility:gps.facility||scorecard.facility,courses:scorecard.courses||gps.courses||[],holes:gps.holes||scorecard.holes||[],gpsItems:gps.gpsItems||scorecard.gpsItems||[]}}
function marker(items:RawGps[],holeId:number,type:string){return items.find(item=>item.holeId===holeId&&item.gpsType?.toLowerCase()===type.toLowerCase())?.gpsCoordinate}

export function normaliseCourseDetail(data:GolfIntelligenceCourse){
  const gps=data.gpsItems||[];
  const activeTees=(data.courses||[]).flatMap(course=>course.tees||[]).filter(tee=>tee.isTeeActive!==false&&(!tee.courseTeeType||tee.courseTeeType==="Total"));
  const scoringHoles=activeTees.flatMap(tee=>tee.holes||[]);
  const sourceHoles=(data.holes?.length?data.holes:scoringHoles).filter(hole=>hole.holeId&&hole.holeNumber);
  const holes=sourceHoles.map(hole=>{const holeId=hole.holeId!,score=scoringHoles.find(item=>item.holeId===holeId)||scoringHoles.find(item=>item.holeNumber===hole.holeNumber),front=marker(gps,holeId,"FrontMarker"),center=marker(gps,holeId,"CenterMarker")||hole.greenGPSCoordinate||score?.greenGPSCoordinate,back=marker(gps,holeId,"BackMarker"),tee=hole.teeGPSCoordinate||score?.teeGPSCoordinate||marker(gps,holeId,"TeeboxMarker");return {provider_hole_id:holeId,hole_number:hole.holeNumber!,par:hole.par||score?.par||null,yardage:hole.yardage||score?.yardage||null,tee_latitude:tee?.latitude??null,tee_longitude:tee?.longitude??null,green_front_latitude:front?.latitude??null,green_front_longitude:front?.longitude??null,green_center_latitude:center?.latitude??null,green_center_longitude:center?.longitude??null,green_back_latitude:back?.latitude??null,green_back_longitude:back?.longitude??null}});
  const features=gps.flatMap(item=>(item.shapes||[]).filter(shape=>shape.length>1).map(shape=>({provider_hole_id:item.holeId||null,feature_type:item.gpsType||"GenericTrace",geometry:shape.filter(point=>Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)).map(point=>({latitude:point.latitude!,longitude:point.longitude!}))}))).filter(feature=>feature.geometry.length>1);
  return {holes,features};
}
