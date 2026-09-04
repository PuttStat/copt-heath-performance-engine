export type Coordinate = { latitude: number; longitude: number };
export type CourseFeature = { id: string; hole_id?: string | null; feature_type: string; geometry: Coordinate[] };
export type CourseHole = {
  id: string;
  hole_number: number;
  par: number | null;
  yardage: number | null;
  tee_latitude: number | null;
  tee_longitude: number | null;
  green_front_latitude: number | null;
  green_front_longitude: number | null;
  green_center_latitude: number | null;
  green_center_longitude: number | null;
  green_back_latitude: number | null;
  green_back_longitude: number | null;
};

export type MappedShot = {
  id: string;
  courseHoleId: string;
  holeNumber: number;
  sequence: number;
  club: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  startLie: string;
  endLie: string;
  distanceYards: number;
  distanceToGreenYards: number;
  success: boolean;
  penalty: boolean;
};

const EARTH_METRES = 6_371_008.8;
export function distanceYards(a: Coordinate, b: Coordinate) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_METRES * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav)) * 1.0936133;
}

export function pointInPolygon(point: Coordinate, polygon: Coordinate[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude, yi = polygon[i].latitude;
    const xj = polygon[j].longitude, yj = polygon[j].latitude;
    const crosses = yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function lieForPoint(point: Coordinate, features: CourseFeature[]) {
  const priority: Array<[RegExp, string]> = [
    [/Green/i, "green"], [/Bunker/i, "bunker"], [/Water|Hazard|Penalty/i, "penalty_area"],
    [/Fairway|ShortGrass/i, "fairway"], [/Teebox/i, "tee"],
  ];
  for (const [pattern, lie] of priority) {
    if (features.some((feature) => pattern.test(feature.feature_type) && pointInPolygon(point, feature.geometry))) return lie;
  }
  return "rough";
}

export function shotBand(shot: MappedShot) {
  if (shot.startLie === "tee") return "Tee shot";
  if (shot.startLie === "bunker") return "Bunker";
  if (shot.startLie === "green") return shot.distanceToGreenYards <= 2 ? "Putting 0–6 ft" : "Putting 6 ft+";
  const distance = shot.distanceToGreenYards;
  if (distance > 200) return "Over 200 yd";
  if (distance > 150) return "150–200 yd";
  if (distance > 125) return "125–150 yd";
  if (distance > 100) return "100–125 yd";
  if (distance > 50) return "50–100 yd";
  return "Under 50 yd";
}

export function vectorBands(shots: MappedShot[]) {
  const labels = ["Tee shot","Over 200 yd","150–200 yd","125–150 yd","100–125 yd","50–100 yd","Under 50 yd","Bunker","Putting 0–6 ft","Putting 6 ft+"];
  return labels.map((label, index) => {
    const matching = shots.filter((shot) => shotBand(shot) === label);
    return { id: `band-${index}`, label, opportunities: matching.length || null, successes: matching.length ? matching.filter((shot) => shot.success).length : null };
  });
}

export function traditionalMetrics(shots: MappedShot[], holes: CourseHole[]) {
  const holeById = new Map(holes.map((hole) => [hole.id, hole]));
  const drives = shots.filter((shot) => shot.sequence === 1 && shot.club.toLowerCase() === "driver");
  const fairwayShots = shots.filter((shot) => shot.sequence === 1 && [4,5].includes(holeById.get(shot.courseHoleId)?.par || 0));
  const gir = new Set(shots.filter((shot) => {
    const par = holeById.get(shot.courseHoleId)?.par || 0;
    return ["green","in_hole"].includes(shot.endLie) && shot.sequence <= par - 2;
  }).map((shot) => shot.holeNumber)).size;
  return {
    fairwaysHit: fairwayShots.filter((shot) => shot.endLie === "fairway").length,
    fairwayOpportunities: fairwayShots.length,
    greensInRegulation: gir,
    putts: shots.filter((shot) => shot.startLie === "green" || shot.club.toLowerCase() === "putter").length,
    averageDrive: drives.length ? Math.round(drives.reduce((total, shot) => total + shot.distanceYards, 0) / drives.length) : null,
    successRate: shots.length ? Math.round(100 * shots.filter((shot) => shot.success).length / shots.length) : null,
    penalties: shots.filter((shot) => shot.penalty).length,
  };
}
