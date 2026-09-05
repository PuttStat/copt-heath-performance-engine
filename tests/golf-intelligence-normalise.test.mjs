import test from "node:test";
import assert from "node:assert/strict";
import { mergeCourseParts,normaliseCourseDetail } from "../lib/golf-intelligence-normalise.ts";

test("separate Stracka scorecard and GPS payloads produce playable mapped holes",()=>{
  const scorecard={name:"Copt Heath Golf Club",courses:[{tees:[{courseTeeType:"Total",isTeeActive:true,holes:[{holeId:101,holeNumber:1,par:4,yardage:421}]}]}]};
  const gps={holes:[{holeId:101,holeNumber:1,teeGPSCoordinate:{latitude:52.4,longitude:-1.8},greenGPSCoordinate:{latitude:52.403,longitude:-1.8}}],gpsItems:[{holeId:101,gpsType:"FairwayTrace",shapes:[[{latitude:52.4,longitude:-1.8},{latitude:52.401,longitude:-1.801},{latitude:52.402,longitude:-1.8}]]},{holeId:101,gpsType:"CenterMarker",gpsCoordinate:{latitude:52.403,longitude:-1.8}}]};
  const result=normaliseCourseDetail(mergeCourseParts(scorecard,gps));
  assert.equal(result.holes[0].par,4);
  assert.equal(result.holes[0].yardage,421);
  assert.equal(result.holes[0].green_center_latitude,52.403);
  assert.equal(result.features.length,1);
  assert.equal(result.features[0].feature_type,"FairwayTrace");
});

test("empty or invalid GPS shapes are rejected by the normaliser",()=>{
  const result=normaliseCourseDetail({courses:[{tees:[{courseTeeType:"Total",isTeeActive:true,holes:[{holeId:1,holeNumber:1,par:4,yardage:410}]}]}],holes:[{holeId:1,holeNumber:1}],gpsItems:[{holeId:1,gpsType:"GreenTrace",shapes:[[{latitude:52.4,longitude:-1.8}]]}]});
  assert.equal(result.features.length,0);
  assert.equal(result.holes[0].par,4);
  assert.equal(result.holes[0].yardage,410);
});
