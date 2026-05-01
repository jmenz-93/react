import type {
  ApiConfig,
  ChatMessage,
  CrimeAnalytics,
  CrimeRecord,
  MapFocus,
  OpenAIChatMessage,
  OpenAIToolCall,
} from "./types";

// In-memory geocode cache to avoid hammering Nominatim on repeat queries.
const geocodeCache = new Map<string, { lat: number; lon: number } | null>();

// Words that strongly signal a landmark/place name (vs a generic street).
// Used by geocodeMilwaukeeStreet to restore a possessive apostrophe before
// a landmark keyword (e.g. 'lukes hospital' -> 'luke's hospital') so that
// Nominatim resolves common Milwaukee landmarks reliably.
const LANDMARK_KEYWORDS = [
  "hospital", "medical center", "medical centre", "clinic",
  "university", "college", "campus",
  "school", "academy",
  "park", "parkway", "playground",
  "mall", "plaza", "market",
  "field", "stadium", "arena", "forum", "ballpark",
  "library", "museum", "zoo", "theater", "theatre",
  "airport",
  "cemetery", "church", "cathedral", "basilica", "mosque", "synagogue", "temple",
  "center", "centre",
  "bridge",
  "beach", "lake", "river", "harbor", "harbour",
  "station",
  "hall",
  // Milwaukee-flavor business landmarks (custard stands are de-facto
  // neighborhood landmarks here; supper clubs, breweries, bakeries similar).
  "custard", "frozen custard", "custard stand",
  "restaurant", "diner", "cafe", "café", "bistro", "grill", "steakhouse",
  "bar", "tavern", "pub", "brewery", "taproom", "winery", "distillery",
  "club", "supper club",
  "bakery", "deli", "butcher",
];
const LANDMARK_KEYWORD_PATTERN = LANDMARK_KEYWORDS
  .map((k) => k.replace(/\s+/g, "\\s+"))
  .join("|");

/**
 * Geocode a street reference to lat/lon using OpenStreetMap
 * Nominatim. Always scoped to Milwaukee, WI. Returns null on failure or if
 * the result lies outside a reasonable Milwaukee bounding box.
 */
export async function geocodeMilwaukeeStreet(
  display: string
): Promise<{ lat: number; lon: number } | null> {
  const key = display.trim().toLowerCase();
  if (!key) return null;
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;

  // Generate lexical variants of the input itself before tacking on geographic
  // suffixes. Handles common shorthand the user types but Nominatim doesn't
  // recognize: 'st lukes hospital' should resolve via 'Saint Lukes Hospital'
  // and 'St Luke's Hospital' (possessive apostrophe restored).
  const lexicalVariants = new Set<string>([display]);

  // Intersection-shaped queries ('X and Y') often fail at Nominatim without
  // street suffixes. Generate enhanced variants: numeric token gets 'St',
  // name token gets 'Ave', plus '&' and 'intersection of' phrasings.
  const intersectionMatch = /^(.+?)\s+and\s+(.+?)$/i.exec(display.trim());
  if (intersectionMatch) {
    const left = intersectionMatch[1].trim();
    const right = intersectionMatch[2].trim();
    const decorate = (token: string): string => {
      // Numeric/ordinal tokens like '27th', '103' are probably numbered streets.
      if (/^\d+(?:st|nd|rd|th)?$/i.test(token)) {
        return /(?:st|nd|rd|th)$/i.test(token) ? `${token} St` : `${token}th St`;
      }
      // Named tokens are probably named avenues — add 'Ave' as a best guess.
      return `${token} Ave`;
    };
    const decoratedLeft = decorate(left);
    const decoratedRight = decorate(right);
    lexicalVariants.add(`${left} & ${right}`);
    lexicalVariants.add(`intersection of ${left} and ${right}`);
    lexicalVariants.add(`${decoratedLeft} and ${decoratedRight}`);
    lexicalVariants.add(`${decoratedLeft} & ${decoratedRight}`);
    // Also try swapped suffixes in case our guess was wrong.
    if (!/^\d/.test(left)) {
      lexicalVariants.add(`${left} St and ${right} Ave`);
      lexicalVariants.add(`${left} Ave and ${right} St`);
    }
  }
  // 'St ' -> 'Saint ' (only when 'St' is a standalone word, not a suffix).
  if (/\bst\.?\s/i.test(display)) {
    lexicalVariants.add(display.replace(/\bst\.?\s/gi, "Saint "));
  }
  // Restore a possessive apostrophe to a name immediately before a keyword
  // (e.g. 'lukes hospital' -> 'luke's hospital'). Only for common name-like
  // words ending in 's' that aren't already possessive or plural-y.
  const possRegex = new RegExp(
    `\\b([A-Za-z]{3,})s\\s+(${LANDMARK_KEYWORD_PATTERN})\\b`,
    "i"
  );
  if (possRegex.test(display)) {
    lexicalVariants.add(display.replace(possRegex, "$1's $2"));
    // Also try Saint+possessive together if applicable.
    const saintFirst = display.replace(/\bst\.?\s/gi, "Saint ");
    if (possRegex.test(saintFirst)) {
      lexicalVariants.add(saintFirst.replace(possRegex, "$1's $2"));
    }
  }

  // For each lexical variant, try a few geographic phrasings.
  const queries: string[] = [];
  for (const v of lexicalVariants) {
    queries.push(`${v}, Milwaukee, WI, USA`);
    queries.push(`${v}, Milwaukee, Wisconsin`);
    queries.push(`${v} Milwaukee`);
  }

  // Milwaukee bounding box. We pass it to Nominatim as viewbox+bounded so the
  // API itself only returns results inside Milwaukee — without this, ambiguous
  // queries like "florida street" can return the US state of Florida (top-rank
  // result) and never let our local check see Milwaukee's actual Florida St.
  const VIEWBOX = "-88.2,43.3,-87.7,42.8"; // left,top,right,bottom

  for (const q of queries) {
    try {
      const url =
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(q)}` +
        `&format=json&limit=5&countrycodes=us` +
        `&viewbox=${encodeURIComponent(VIEWBOX)}&bounded=1`;
      // eslint-disable-next-line no-console
      console.debug("[geocode] trying", q);
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn("[geocode] HTTP", res.status, "for", q);
        continue;
      }
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (Array.isArray(data) && data.length > 0) {
        // Walk the candidates and take the first one inside our local bbox
        // sanity check — bounded=1 should already enforce this, but the
        // double-check keeps us safe if Nominatim ever returns near-boundary
        // results from a slightly larger search radius.
        for (const candidate of data) {
          const lat = parseFloat(candidate.lat);
          const lon = parseFloat(candidate.lon);
          if (
            Number.isFinite(lat) && Number.isFinite(lon) &&
            lat > 42.8 && lat < 43.3 && lon > -88.2 && lon < -87.7
          ) {
            const result = { lat, lon };
            // eslint-disable-next-line no-console
            console.debug("[geocode] resolved", display, "->", result);
            geocodeCache.set(key, result);
            return result;
          }
        }
        // eslint-disable-next-line no-console
        console.warn("[geocode] no in-bbox candidate among", data.length, "for", q);
      } else {
        // eslint-disable-next-line no-console
        console.debug("[geocode] no results for", q);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[geocode] error for", q, err);
    }
  }

  geocodeCache.set(key, null);
  return null;
}

export function haversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Milwaukee neighborhood boundaries — approximate but tuned for the real
// city geography so hotspots get pre-tagged with the side users actually
// mean ("east side", "south side", "southwest side", "northwest side", etc).
//
//   North/South split:   I-94's east-west segment runs at ~lat 43.02.
//                        Lat < 43.02 → south of I-94.
//   N 35th St divider:   ~lon -87.965. North of I-94, west of this is the
//                        west side / northwest side.
//   S 27th St divider:   ~lon -87.948. South of I-94, west of this is the
//                        southwest side. (The southwest side colloquially
//                        extends further east than the north-half west
//                        side, picking up Forest Home, Layton Park, and
//                        the 27th–35th St corridor.)
//   Capitol Drive:       ~lat 43.078. Splits the western half into
//                        west side (south of Capitol) and northwest side
//                        (north of Capitol).
//   East side:           East of the Milwaukee River corridor
//                        (~lon -87.905), north of I-94, north of downtown.
//                        Includes UWM, Riverwest, North Point, etc.
//   Southwest side:      South of I-94 AND west of S 27th St. Includes
//                        Forest Home Hills, Layton Park, Jackson Park,
//                        Polonia, near-southwest corridor toward
//                        Greenfield/West Allis border (53215 west of 27th,
//                        53219/53220/53221/53227/53228).
//   South side:          South of I-94 east of S 27th St (53204/53207
//                        and 53215 east of 27th — Walker's Point, Lincoln
//                        Village, Bay View).
//   West side:           North of I-94, west of N 35th St, south of
//                        Capitol Drive (Washington Park, Concordia,
//                        Mid-Town, Story Hill).
//   Northwest side:      North of I-94, west of N 35th St, north of
//                        Capitol Drive (53216/53218/53222/53223/53224/
//                        53225 — Capitol Heights, Silver Spring, Granville,
//                        Old North Milwaukee).
//   Downtown:            Small central lakefront core around the Marquette
//                        interchange (lat 43.025–43.05, lon -87.93 to -87.88).
//   North side:          The remaining central-northern area between
//                        downtown, the east side, and the west side.
const I94_DIVIDER_LAT = 43.02;
const RIVER_DIVIDER_LON = -87.905;
const WEST_DIVIDER_LON = -87.965;       // N 35th St — north-half west/NW split
const SOUTH_WEST_DIVIDER_LON = -87.948; // S 27th St — south-half SW split
const CAPITOL_DRIVE_LAT = 43.078;
const DOWNTOWN_LAT_MIN = 43.025;
const DOWNTOWN_LAT_MAX = 43.05;
const DOWNTOWN_LON_MIN = -87.93;
const DOWNTOWN_LON_MAX = -87.88;

type MilwaukeeArea =
  | "north side"
  | "south side"
  | "east side"
  | "west side"
  | "northwest side"
  | "southwest side"
  | "downtown";

export function classifyArea(lat: number, lon: number): MilwaukeeArea {
  // Downtown core takes precedence — it sits north of I-94 along the lake
  // but is its own named region in conversation.
  if (
    lat >= DOWNTOWN_LAT_MIN &&
    lat <= DOWNTOWN_LAT_MAX &&
    lon >= DOWNTOWN_LON_MIN &&
    lon <= DOWNTOWN_LON_MAX
  ) {
    return "downtown";
  }
  // South of I-94: split into south side vs southwest side along ~27th St.
  if (lat < I94_DIVIDER_LAT) {
    return lon <= SOUTH_WEST_DIVIDER_LON ? "southwest side" : "south side";
  }
  // North of I-94: subdivide by longitude (and by Capitol Dr on the west).
  if (lon >= RIVER_DIVIDER_LON) {
    return "east side";
  }
  if (lon <= WEST_DIVIDER_LON) {
    // West of 35th St: split west side vs northwest side along Capitol Dr.
    return lat >= CAPITOL_DRIVE_LAT ? "northwest side" : "west side";
  }
  return "north side";
}

export interface AssistantReply {
  answer: string;
  mapFocus: MapFocus | null;
  /** Up to 3 follow-up question strings the user can click to send. */
  suggestions: string[];
  /**
   * Full sequence of OpenAI messages produced during this assistant turn —
   * the user message, every assistant tool_calls round, every tool result,
   * and the final assistant text. ChatPanel stores this on the assistant
   * ChatMessage so the next turn can replay the model's prior tool exchange
   * verbatim (preserves geocoded lat/lon and filter args across follow-ups).
   * Empty on error replies that never reached the model loop.
   */
  internalMessages: OpenAIChatMessage[];
}

// Parses an assistant reply for the trailing 'FOLLOWUPS:' block (see system
// prompt rule). Returns the cleaned answer (FOLLOWUPS stripped) plus an
// array of up to 3 question strings. Tolerant of variations in casing,
// trailing punctuation, and bullet formatting (- * • numbered).
function parseFollowups(raw: string): { answer: string; suggestions: string[] } {
  // Match the last FOLLOWUPS / FOLLOW-UPS / FOLLOW UPS marker (case-insensitive)
  // optionally on its own line, optionally with surrounding markdown bold/heading.
  const marker = /\n\s*\**#*\s*FOLLOW[\s-]?UPS\s*:?\s*\**\s*\n/i;
  const match = marker.exec(raw);
  if (!match) return { answer: raw, suggestions: [] };
  const before = raw.slice(0, match.index).trimEnd();
  const after = raw.slice(match.index + match[0].length);
  const lines = after
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•–]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0 && line.length < 240);
  return { answer: before, suggestions: lines.slice(0, 3) };
}

// ---------------------------------------------------------------------------
//
// Multi-turn loop:
//   1. Send user question + tool schemas.
//   2. If the model responds with tool_calls, execute each in parallel,
//      append results as 'tool' messages, and loop.
//   3. If the model responds with content, parse FOLLOWUPS, capture any
//      emit_map_focus side-effect, and return.
//
// Capped at MAX_TOOL_ITERATIONS to bound runtime.
// ---------------------------------------------------------------------------

const MAX_TOOL_ITERATIONS = 8;

function buildToolSystemPrompt(
  analytics: CrimeAnalytics,
  records: CrimeRecord[],
): string {
  const dates = records.map((r) => r.date.getTime()).filter((t) => Number.isFinite(t));
  const minDate = dates.length ? new Date(Math.min(...dates)).toLocaleDateString() : "unknown";
  const maxDate = dates.length ? new Date(Math.max(...dates)).toLocaleDateString() : "unknown";
  return [
    "You are an urban safety analytics assistant focused on Milwaukee crime trends using WIBR (Wisconsin Incident Based Reporting) data.",
    `Loaded dataset: ${analytics.totalIncidents} incidents (${analytics.mappedIncidents} with lat/lon), date range ${minDate} → ${maxDate}, overall trend direction '${analytics.trendDirection}'. The dataset tracks these major offense categories: Arson, Assault Offense, Burglary, Criminal Damage, Homicide, Robbery, Sex Offense, Theft, Vehicle Theft. Operational dimensions include WeaponUsed, POLICE district, ALD, WARD, ZIP, and Location.`,
    "",
    "TOOL-CALLING DISCIPLINE: You answer crime-data questions by CALLING TOOLS, not by guessing. The tools query the live dataset directly. Do not state crime statistics, counts, addresses, dates, hotspot locations, or trends without first having a tool return them. If a question is purely conceptual (e.g. 'what is hot-spot policing'), you may answer from general knowledge.",
    "",
    "SCOPE: You ONLY discuss Milwaukee crime analytics, safety strategy, and topics directly tied to the loaded WIBR dataset (e.g. policing strategies, community partnerships, CPTED, demographic context for trust-building). For ANY off-topic request — recipes, sports, weather, coding help, general trivia, personal advice, other cities' crime data, etc. — respond with a single short sentence such as: 'That's outside the scope of this tool — I can only help with Milwaukee crime data and safety analysis. What would you like to know about the dataset?' Do NOT suggest external websites, apps, search engines, or alternative resources. Do NOT attempt the off-topic task even partially. Do NOT include a FOLLOWUPS block on a refusal.",
    "",
    "AVAILABLE TOOLS (compose these — they are PRIMITIVES, not pre-canned answers):",
    "- get_dataset_summary: high-level overview (call once early if you need orientation).",
    "- filter_records: count + 5-record sample matching a filter (zip/district/offense/weapon/address/date/radius).",
    "- list_records: up to 50 actual records matching a filter (use for 'list/show/describe specific incidents').",
    "- compute_stats: aggregate dimensions over a filter (topOffenses, peakHours, peakDays, monthlyTrend, weapons, recentVsPrior, topStreets, topZips, topDistricts, milwaukeeSideBreakdown).",
    "- find_hotspots: top clusters by volume OR by recent_growth, optionally filtered/region-restricted.",
    "- find_nearby_areas: K geographically nearest ZIPs or districts to a target (use for 'nearby ZIPs', 'surrounding districts', 'compare to neighbors').",
    "- geocode_milwaukee: resolve a street/landmark/intersection to lat/lon.",
    "- emit_map_focus: programmatically zoom the user's map. Call ONLY when the user explicitly asks to 'show on map', 'zoom to', 'take me there', etc.",
    "",
    "QUERY COMPOSITION PATTERNS:",
    "- 'crimes near 35th and Morgan' → geocode_milwaukee then filter_records with centerLat/centerLon and radiusMiles ~0.5.",
    "- 'compare district 5 to nearby districts' → find_nearby_areas (kind='district', value='5'), then compute_stats once per neighbor.",
    "- 'where is robbery rising' → find_hotspots with sortBy='recent_growth' and filter.offense='robbery'.",
    "- 'list the homicides in 53206 this year' → list_records with filter.offense='homicide', filter.zip='53206', filter.dateStart='YYYY-01-01'.",
    "- 'when do thefts happen on the south side' → compute_stats with filter.offense='theft', filter.region='south side', dimensions=['peakHours','peakDays'].",
    "- 'compare crime on the north side vs the south side' → call compute_stats TWICE: once with filter.region='north side' dimensions=['topOffenses','recentVsPrior','peakHours'], then again with filter.region='south side' same dimensions. Then narrate side-by-side. (Alternative: a single compute_stats call with no region and dimensions=['milwaukeeSideBreakdown'] gives every side's count in one shot — use that for a high-level total comparison.)",
    "- 'list robberies on the east side' → list_records with filter.offense='robbery' filter.region='east side'.",
    "- 'crime in 53206, 53210, and 53216 combined' / 'aggregate stats for those ZIPs' → use filter.zips=['53206','53210','53216'] (multi-value) instead of calling the tool three times. compute_stats with that filter returns combined totals. To compare them rather than aggregate, call compute_stats once per ZIP using filter.zip='53206', then '53210', then '53216'.",
    "- 'compare districts 2, 5, and 7' → compute_stats once per district (filter.district='2', then '5', then '7') so you can narrate side-by-side. Use filter.districts=['2','5','7'] when the user wants the COMBINED total or list across them, not a comparison.",
    "- 'show me X on the map' / 'zoom to X' → FIRST resolve X to coordinates via a tool, THEN call emit_map_focus with those coords. Resolution rules: (a) street/intersection/landmark → geocode_milwaukee (zoom 15-17); (b) ZIP code → find_nearby_areas with kind='zip', value=ZIP — pass target.centroid.lat/lon to emit_map_focus (zoom 13); (c) police district → find_nearby_areas with kind='district', value=DISTRICT — pass target.centroid.lat/lon (zoom 13); (d) a specific hotspot from a previous find_hotspots result → reuse that hotspot's lat/lon (zoom 15-16). NEVER pass lat/lon you remember from training data — Milwaukee coordinates you recall are likely wrong. If geocode_milwaukee returns resolved=false, tell the user you couldn't find that location instead of guessing.",
    "- Follow-up questions: prior turns' tool_calls and tool results ARE visible to you in this conversation — you can see the exact lat/lon you geocoded, the exact filter you passed, and the records each tool returned. REUSE those same arguments for follow-ups unless the user changed the area/offense/time-window. If the prior turn called geocode_milwaukee('St Lukes Hospital') and got lat/lon, this turn should reuse that same lat/lon (and ~0.5 mile radius) when the user says 'these incidents', 'that area', 'near there', etc. — do not re-geocode unless geocode_milwaukee's cache might be stale or the location reference changed. If the prior turn used filter.zip / filter.district / filter.region, re-pass the same value. Demonstrative pronouns ('these', 'those', 'that area') bind to the prior filter arguments, not just to your prior reply text.",
    "",
    "MILWAUKEE REGION RULES: The classifyArea function tags every lat/lon as one of: 'north side', 'south side', 'east side', 'west side', 'northwest side', 'southwest side', 'downtown'. Boundaries: I-94 (lat 43.02) splits north/south; Milwaukee River (lon -87.905) splits north-side from east-side; ~N 35th St (lon -87.965) splits east/west on the north half; Capitol Dr (lat 43.078) splits west side (south) from northwest side (north); ~S 27th St (lon -87.948) splits south side (east) from southwest side (west); downtown is the lakefront box lat 43.025-43.05, lon -87.93 to -87.88. Address-grid prefixes ('N', 'S', 'E', 'W' on a street name) refer to the city's STREET GRID and are NOT the same as these region tags. When the user asks about a specific side, pass it as the `region` argument to find_hotspots, or filter compute_stats results to that side via milwaukeeSideBreakdown. NEVER substitute a different side because zero results came back — say so explicitly.",
    "",
    "GROUNDING RULES:",
    "- Refer to areas by street/district/ZIP/neighborhood, NEVER by raw lat/lon coordinates. Hotspot tool results include a `label` field (e.g. '5833 N 91ST ST, District 7, ZIP 53225') AND a `lat`/`lon` field. ALWAYS quote the `label` in your reply and NEVER write the lat/lon numbers — they exist only so other tools (emit_map_focus, filter_records radius search) can use them programmatically. Format hotspots in your reply like: 'Hotspot 1 — near 5833 N 91ST ST (District 7, ZIP 53225): 21 incidents, recent 30d 0, prior 30d 13, cooling.' Numbers like 'Latitude 43.0281, Longitude -87.9093' must NEVER appear in your user-visible answer.",
    "- Weapon data IS available (WeaponUsed column) — never claim it isn't. WIBR populates weapons primarily for violent offenses; if compute_stats returns zero armed incidents for the filter, say 'no weapons were recorded for these incidents' (and note WIBR only logs weapons for certain offense types) rather than claiming the data is missing.",
    "- Time-of-day data IS available (parsed from ReportedDateTime) — never claim it isn't.",
    "- When you list specific incidents from list_records, quote the date, offense, and address verbatim.",
    "- For area-scoped questions, your answer MUST include BOTH (a) the data summary AND (b) tailored evidence-based recommendations grounded in the SPECIFIC offense mix, time-of-day, day-of-week, and weapons patterns. Cite named strategies (hot-spot policing, problem-oriented policing/SARA, focused deterrence/Operation Ceasefire, CPTED, procedural justice) and Milwaukee-specific community partners (414Life, Office of Violence Prevention, Running Rebels, COA Youth & Family Centers, UMOS, Hispanic Collaborative, Pastors United, BIDs) where relevant. Never default to canned 'increase patrols / install cameras' boilerplate.",
    "- Never present causal claims without uncertainty language. Forecasts are risk signals, not certainties.",
    "",
    "OUTPUT FORMATTING:",
    "- Region tag brackets like '[north side]' are for your INTERNAL reasoning only when reading tool output. NEVER write bracketed region tags in your reply to the user — write 'the north side', 'downtown', etc. as plain prose.",
    "- After your main answer, append EXACTLY this trailing block (the application parses it programmatically):",
    "",
    "FOLLOWUPS:",
    "- <question 1>",
    "- <question 2>",
    "- <question 3>",
    "",
    "Rules for FOLLOWUPS: exactly 3 items, each a complete first-person question under 100 chars, specific to what was just discussed (same area/offense/window or a clear pivot), genuinely useful next steps a Milwaukee crime analyst would actually ask. Do not repeat the user's question. The 'FOLLOWUPS:' marker is on its own line preceded by a blank line, no markdown bold/heading.",
  ].join("\n");
}

/**
 * Reconstruct the prior conversation as the model originally saw it. For
 * each assistant message that has stored internalMessages, we splice those
 * in verbatim — preserving its tool_calls and tool results so the model
 * retains visibility into earlier geocode lookups, filter arguments, and
 * tool-returned data on follow-up turns. Falls back to plain {role,content}
 * for older messages saved before this feature existed.
 *
 * Token budget: kept bounded by REPLAY_MESSAGE_BUDGET. We walk backward
 * from the most recent turn and stop accumulating once we exceed the cap;
 * older turns are dropped wholesale (we never split a turn in half because
 * orphaned tool messages without their parent assistant message break the
 * OpenAI API contract).
 */
const REPLAY_MESSAGE_BUDGET = 60;

function replayHistoryAsOpenAI(history: ChatMessage[]): OpenAIChatMessage[] {
  // Group history into (user, assistant) turn pairs starting from the end.
  // Each turn's effective message list is either the assistant's stored
  // internalMessages (which already includes the user message) or a plain
  // [{user}, {assistant}] pair when internalMessages is absent.
  const turns: OpenAIChatMessage[][] = [];

  let i = history.length - 1;
  while (i >= 0) {
    const m = history[i];
    if (m.role === "assistant") {
      const userMsg = i > 0 && history[i - 1].role === "user" ? history[i - 1] : null;
      if (m.internalMessages?.length) {
        turns.unshift([...m.internalMessages]);
      } else if (userMsg) {
        turns.unshift([
          { role: "user", content: userMsg.content },
          { role: "assistant", content: m.content },
        ]);
      } else {
        turns.unshift([{ role: "assistant", content: m.content }]);
      }
      i = userMsg ? i - 2 : i - 1;
    } else {
      // Trailing user message with no assistant reply yet (shouldn't happen
      // given our chat panel flow, but be defensive).
      turns.unshift([{ role: "user", content: m.content }]);
      i -= 1;
    }
  }

  // Concatenate from newest backward until we exceed the budget, then drop
  // older turns. We accumulate forward (oldest → newest) only after deciding
  // which turns survive.
  const surviving: OpenAIChatMessage[][] = [];
  let total = 0;
  for (let t = turns.length - 1; t >= 0; t--) {
    const turn = turns[t];
    if (total + turn.length > REPLAY_MESSAGE_BUDGET && surviving.length > 0) break;
    surviving.unshift(turn);
    total += turn.length;
  }
  return surviving.flat();
}

export async function askCrimeAssistantWithTools(params: {
  question: string;
  history: ChatMessage[];
  analytics: CrimeAnalytics;
  records: CrimeRecord[];
  apiConfig: ApiConfig;
}): Promise<AssistantReply> {
  const { question, history, analytics, records, apiConfig } = params;

  if (!apiConfig.apiKey?.trim()) {
    return {
      answer:
        "An OpenAI API key is required to use this assistant. Open the API Settings panel and paste your key to begin.",
      mapFocus: null,
      suggestions: [],
      internalMessages: [],
    };
  }

  // Lazy import to avoid a top-of-file circular ref; tools.ts imports from
  // chat.ts (classifyArea, geocodeMilwaukeeStreet, haversineDistanceMiles).
  const { TOOLS, TOOL_BY_NAME, OPENAI_TOOL_SCHEMAS } = await import("./tools");
  void TOOLS; // referenced via TOOL_BY_NAME

  const ctx = { records, analytics };
  const systemPrompt = buildToolSystemPrompt(analytics, records);

  // Note: history excludes the message we're about to add. The user message
  // for this turn is the first entry of turnMessages (added below) and will
  // be persisted on the resulting assistant ChatMessage.
  const replayed = replayHistoryAsOpenAI(history);
  const turnMessages: OpenAIChatMessage[] = [{ role: "user", content: question }];

  const messages: OpenAIChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...replayed,
    ...turnMessages,
  ];

  const endpoint = `${apiConfig.baseUrl.replace(/\/$/, "")}/chat/completions`;
  let capturedMapFocus: MapFocus | null = null;

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: apiConfig.model,
          temperature: 0.2,
          messages,
          tools: OPENAI_TOOL_SCHEMAS,
          tool_choice: "auto",
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        answer: `Could not reach the model endpoint. Check your network connection and API base URL. (${message})`,
        mapFocus: null,
        suggestions: [],
        internalMessages: [],
      };
    }
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text();
      return {
        answer: `The model call failed (HTTP ${response.status}). Verify your API key, base URL, and model. Details: ${body.slice(0, 300)}`,
        mapFocus: null,
        suggestions: [],
        internalMessages: [],
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          role?: string;
          content?: string | null;
          tool_calls?: OpenAIToolCall[];
        };
        finish_reason?: string;
      }>;
    };

    const choice = data.choices?.[0]?.message;
    if (!choice) {
      return {
        answer:
          "The model returned an empty response. Try rephrasing your question or check your API/model configuration.",
        mapFocus: null,
        suggestions: [],
        internalMessages: [],
      };
    }

    // No tool calls → final answer.
    if (!choice.tool_calls || choice.tool_calls.length === 0) {
      const content = (choice.content ?? "").trim();
      if (!content) {
        return {
          answer:
            "The model returned an empty response. Try rephrasing your question or check your API/model configuration.",
          mapFocus: null,
          suggestions: [],
          internalMessages: [],
        };
      }
      // Persist the final assistant message into the turn record.
      turnMessages.push({ role: "assistant", content });
      const { answer, suggestions } = parseFollowups(content);
      return {
        answer,
        mapFocus: capturedMapFocus,
        suggestions,
        internalMessages: turnMessages,
      };
    }

    // Append assistant message verbatim so OpenAI can match tool_call_id on
    // the follow-up tool messages. Mirror into turnMessages so the next
    // turn can replay the full tool exchange.
    const assistantToolMsg: OpenAIChatMessage = {
      role: "assistant",
      content: choice.content ?? null,
      tool_calls: choice.tool_calls,
    };
    messages.push(assistantToolMsg);
    turnMessages.push(assistantToolMsg);

    // Execute each tool call. Tools are individually fast; run sequentially
    // for simplicity (geocode is the only async one and is in-memory cached).
    for (const call of choice.tool_calls) {
      const tool = TOOL_BY_NAME.get(call.function.name);
      let resultPayload: unknown;
      if (!tool) {
        resultPayload = {
          error: `Unknown tool '${call.function.name}'. Available: ${[...TOOL_BY_NAME.keys()].join(", ")}.`,
        };
      } else {
        let parsedArgs: unknown = {};
        try {
          parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch (err) {
          resultPayload = {
            error: `Failed to parse arguments JSON: ${(err as Error).message}. Raw: ${call.function.arguments?.slice(0, 200)}`,
          };
        }
        if (resultPayload === undefined) {
          try {
            resultPayload = await tool.execute(parsedArgs as never, ctx);
            // Capture map-focus side-effect.
            if (
              tool.name === "emit_map_focus" &&
              resultPayload &&
              typeof resultPayload === "object" &&
              "focus" in (resultPayload as Record<string, unknown>)
            ) {
              const focus = (resultPayload as { focus: { lat: number; lon: number; zoom: number; label: string } }).focus;
              capturedMapFocus = {
                lat: focus.lat,
                lon: focus.lon,
                zoom: focus.zoom,
                label: focus.label,
                nonce: Date.now(),
              };
            }
          } catch (err) {
            resultPayload = {
              error: `Tool '${tool.name}' threw: ${(err as Error).message}`,
            };
          }
        }
      }

      const toolMsg: OpenAIChatMessage = {
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(resultPayload),
      };
      messages.push(toolMsg);
      turnMessages.push(toolMsg);
    }
  }

  // Hit the iteration cap without a final assistant message.
  return {
    answer:
      "I wasn't able to compose a complete answer within the tool-call budget. Could you narrow the question (e.g. specify a single area, offense, or time window) and try again?",
    mapFocus: capturedMapFocus,
    suggestions: [],
    internalMessages: turnMessages,
  };
}
