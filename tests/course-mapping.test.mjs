import test from "node:test";
import assert from "node:assert/strict";
import { distanceYards,lieForPoint,traditionalMetrics,vectorBands } from "../lib/course-mapping.ts";

test("distance and polygon classification support mapped shot capture",()=>{
  const start={latitude:52,longitude:-1.75},end={latitude:52.001,longitude:-1.75};
  assert.ok(distanceYards(start,end)>120&&distanceYards(start,end)<123);
  assert.equal(lieForPoint({latitude:1,longitude:1},[{id:"f",feature_type:"FairwayTrace",geometry:[{latitude:0,longitude:0},{latitude:0,longitude:2},{latitude:2,longitude:2},{latitude:2,longitude:0}]}]),"fairway");
});

test("mapping produces Vector bands and traditional metrics",()=>{
  const hole={id:"hole",hole_number:1,par:4,yardage:400,tee_latitude:0,tee_longitude:0,green_front_latitude:null,green_front_longitude:null,green_center_latitude:1,green_center_longitude:1,green_back_latitude:null,green_back_longitude:null};
  const shots=[{id:"shot",courseHoleId:"hole",holeNumber:1,sequence:1,club:"Driver",startLatitude:0,startLongitude:0,endLatitude:.1,endLongitude:.1,startLie:"tee",endLie:"fairway",distanceYards:250,distanceToGreenYards:150,success:true,penalty:false}];
  assert.equal(vectorBands(shots).find(row=>row.label==="Tee shot").successes,1);
  assert.deepEqual(traditionalMetrics(shots,[hole]),{fairwaysHit:1,fairwayOpportunities:1,greensInRegulation:0,putts:0,averageDrive:250,successRate:100,penalties:0});
});
