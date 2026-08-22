export type TrackmanValue = string | number | null;
export type TrackmanShot = {
  row_number: number;
  fingerprint: string;
  values: Record<string, TrackmanValue>;
  raw_values: Record<string, string>;
};

export type TrackmanParseResult = {
  headers: string[];
  shots: TrackmanShot[];
  rejected: { row: number; reason: string }[];
  headerRow: number;
  warnings: string[];
};

const aliases: Record<string, string> = {
  club: "club", clubtype: "club", date: "shot_date", time: "shot_time", datetime: "shot_time",
  ballspeed: "ball_speed", clubspeed: "club_speed", clubheadspeed: "club_speed", smashfactor: "smash_factor",
  carry: "carry", carrydistance: "carry", total: "total", totaldistance: "total", rolldistance: "roll",
  launchangle: "launch_angle", launchdirection: "launch_direction", spinrate: "spin_rate", spinaxis: "spin_axis",
  height: "height", maxheight: "height", apex: "height", landingangle: "landing_angle", descentangle: "landing_angle",
  hangtime: "hang_time", flighttime: "hang_time", curve: "curve", sidedistance: "side_distance", offline: "side_distance",
  faceangle: "face_angle", clubpath: "club_path", facetopath: "face_to_path", attackangle: "attack_angle",
  angleofattack: "attack_angle", dynamicloft: "dynamic_loft", spinloft: "spin_loft", lowpoint: "low_point",
  swingplane: "swing_plane", swingdirection: "swing_direction", swingradius: "swing_radius",
  impactheight: "impact_height", impactoffset: "impact_offset", impactlocationx: "impact_offset", impactlocationy: "impact_height",
  dplane: "d_plane", balltrajectory: "trajectory", temperature: "temperature", humidity: "humidity",
  airpressure: "air_pressure", windspeed: "wind_speed", winddirection: "wind_direction", targetdistance: "target_distance",
};

const numericFields = new Set(Object.values(aliases).filter(value => !["club", "shot_date", "shot_time", "trajectory"].includes(value)));

function normalise(value: string) { return value.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]/g, ""); }

function csvRows(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') { if (quoted && source[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && source[i + 1] === "\n") i++; row.push(cell); if (row.some(value => value.trim())) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function fileChecksum(file: File) { return digest(await file.text()); }

export async function parseTrackmanCsv(text: string): Promise<TrackmanParseResult> {
  const rows = csvRows(text);
  const headerIndex = rows.findIndex(row => row.map(normalise).some(key => ["club", "ballspeed", "clubspeed", "carry", "spinrate"].includes(key)));
  if (headerIndex < 0) throw new Error("No TrackMan data header was found. Export the shot table as CSV and try again.");
  const headers = rows[headerIndex].map((header, index) => header.trim() || `Column ${index + 1}`);
  const shots: TrackmanShot[] = []; const rejected: { row: number; reason: string }[] = [];
  for (let index = headerIndex + 1; index < rows.length; index++) {
    const cells = rows[index]; const raw: Record<string, string> = {}; const values: Record<string, TrackmanValue> = {};
    headers.forEach((header, column) => { const rawValue = (cells[column] || "").trim(); raw[header] = rawValue; const field = aliases[normalise(header)]; if (!field || values[field] !== undefined) return; if (!rawValue) values[field] = null; else if (numericFields.has(field)) { const parsed = Number(rawValue.replace(/,/g, "")); values[field] = Number.isFinite(parsed) ? parsed : null; } else values[field] = rawValue; });
    const populated = Object.values(raw).filter(Boolean).length;
    const measurable = ["ball_speed", "club_speed", "carry", "spin_rate", "launch_angle", "club_path"].some(field => typeof values[field] === "number");
    if (!populated) continue;
    if (!measurable) { rejected.push({ row: index + 1, reason: "No recognised shot measurement" }); continue; }
    const fingerprint = await digest(JSON.stringify({ values, raw }));
    shots.push({ row_number: index + 1, fingerprint, values, raw_values: raw });
  }
  const mapped = new Set(headers.map(header => aliases[normalise(header)]).filter(Boolean));
  return { headers, shots, rejected, headerRow: headerIndex + 1, warnings: ["ball_speed", "club_speed", "carry", "spin_rate"].filter(field => !mapped.has(field)).map(field => `${field.replaceAll("_", " ")} column is not present; values will remain blank.`) };
}
