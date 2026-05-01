/**
 * Tool definitions for the OpenAI tool-calling chat assistant.
 *
 * This module exposes a small set of composable PRIMITIVES — filter, list,
 * compute stats, find hotspots, find nearby areas, geocode — and lets the
 * LLM decide which to call based on the user's question. Adding a new
 * question shape now means asking the LLM a new way to compose existing
 * tools, not writing a new regex/intent branch.
 *
 * Each ToolDefinition has:
 *   - name        : the function name the LLM will reference
 *   - description : what the tool does + when to call it (read by LLM)
 *   - parameters  : JSON Schema for OpenAI's strict tool validation
 *   - execute     : the actual TypeScript handler
 */

import type { CrimeAnalytics, CrimeRecord, Hotspot } from "./types";
import { createHotspotGrid } from "./analytics";
import { formatOffense } from "./format";
import {
  classifyArea,
  geocodeMilwaukeeStreet,
  haversineDistanceMiles,
} from "./chat";

// ---------------------------------------------------------------------------
// Tool execution context
// ---------------------------------------------------------------------------

export interface ToolContext {
  records: CrimeRecord[];
  analytics: CrimeAnalytics;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: object; // JSON Schema
  execute: (params: any, ctx: ToolContext) => Promise<unknown> | unknown;
}

// ---------------------------------------------------------------------------
// Shared filter primitive — every record-scoped tool accepts this shape so
// the LLM can express "robberies in 53206 last 30 days with a firearm" by
// composing fields, instead of needing a dedicated tool per filter combo.
// ---------------------------------------------------------------------------

export interface RecordFilter {
  /** Exact 5-digit ZIP match against record.raw.ZIP. */
  zip?: string;
  /**
   * Multiple ZIPs — record matches if its ZIP is in this list. Use this for
   * cross-area comparisons or aggregate analysis spanning several ZIPs
   * (e.g. 'crime in 53206, 53210, and 53216 combined'). Combined with `zip`,
   * the union is taken (record matches if it matches either).
   */
  zips?: string[];
  /** Exact police district match against record.district. */
  district?: string;
  /**
   * Multiple police districts — record matches if its district is in this
   * list. Combined with `district`, the union is taken.
   */
  districts?: string[];
  /**
   * Milwaukee region tag, computed from each record's lat/lon via
   * classifyArea. One of 'north side', 'south side', 'east side',
   * 'west side', 'northwest side', 'southwest side', 'downtown'.
   * Records without lat/lon are excluded when this filter is set.
   */
  region?: string;
  /**
   * Offense substring match (case-insensitive). Examples: 'robbery',
   * 'theft', 'homicide', 'assault'. Matches across the canonical offense
   * categories: Arson, Assault Offense, Burglary, Criminal Damage,
   * Homicide, Robbery, Sex Offense, Theft, Vehicle Theft.
   */
  offense?: string;
  /** WeaponUsed substring match (case-insensitive). E.g. 'firearm', 'knife'. */
  weapon?: string;
  /** Address substring match (case-insensitive). */
  addressContains?: string;
  /** ISO date (YYYY-MM-DD). Inclusive lower bound. */
  dateStart?: string;
  /** ISO date (YYYY-MM-DD). Inclusive upper bound. */
  dateEnd?: string;
  /** Latitude of a center point. Combine with radiusMiles. */
  centerLat?: number;
  /** Longitude of a center point. */
  centerLon?: number;
  /** Radius in miles around the center point. */
  radiusMiles?: number;
}

const FILTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    zip: { type: "string", description: "Exact 5-digit ZIP code (e.g. '53206'). For multiple ZIPs, use `zips` instead." },
    zips: {
      type: "array",
      items: { type: "string" },
      description:
        "Multiple ZIP codes — record matches if its ZIP is in this list. Use for cross-ZIP comparisons or aggregate analysis spanning several ZIPs (e.g. 'crime in 53206, 53210, and 53216 combined'). Combined with `zip`, the union is taken.",
    },
    district: { type: "string", description: "Police district number as string (e.g. '5'). For multiple districts, use `districts` instead." },
    districts: {
      type: "array",
      items: { type: "string" },
      description:
        "Multiple police districts — record matches if its district is in this list (e.g. ['2','5','7']). Use for cross-district analysis. Combined with `district`, the union is taken.",
    },
    region: {
      type: "string",
      enum: [
        "north side",
        "south side",
        "east side",
        "west side",
        "northwest side",
        "southwest side",
        "downtown",
      ],
      description:
        "Milwaukee region tag, computed from record lat/lon. Use this to scope a filter to one side of the city (e.g. 'crime on the south side', 'list north-side homicides'). Records without lat/lon are excluded when set.",
    },
    offense: {
      type: "string",
      description:
        "Substring match against offense type (case-insensitive). E.g. 'robbery', 'theft', 'homicide'.",
    },
    weapon: {
      type: "string",
      description:
        "Substring match against WeaponUsed (case-insensitive). E.g. 'firearm', 'knife', 'blunt'.",
    },
    addressContains: {
      type: "string",
      description: "Substring match against address (case-insensitive). Use for street names.",
    },
    dateStart: { type: "string", description: "ISO date YYYY-MM-DD, inclusive lower bound." },
    dateEnd: { type: "string", description: "ISO date YYYY-MM-DD, inclusive upper bound." },
    centerLat: { type: "number" },
    centerLon: { type: "number" },
    radiusMiles: { type: "number" },
  },
} as const;

/**
 * Normalize an address string for fuzzy substring matching: lowercase,
 * strip punctuation, collapse whitespace, and canonicalize common street
 * suffixes ("Avenue" / "Ave" / "Av" → "av") and directionals ("North" → "n").
 * This lets a query like "2950 S Chase Ave" match a CSV value of
 * "2950 S CHASE AV" — without normalization the trailing "e" in "ave" makes
 * the substring check fail.
 */
function normalizeAddressForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\b(?:avenue|ave|av)\b/g, "av")
    .replace(/\b(?:street|st)\b/g, "st")
    .replace(/\b(?:road|rd)\b/g, "rd")
    .replace(/\b(?:drive|dr)\b/g, "dr")
    .replace(/\b(?:boulevard|blvd|bl)\b/g, "bl")
    .replace(/\b(?:place|pl)\b/g, "pl")
    .replace(/\b(?:court|ct)\b/g, "ct")
    .replace(/\b(?:lane|ln|la)\b/g, "ln")
    .replace(/\b(?:terrace|ter|tr)\b/g, "tr")
    .replace(/\b(?:parkway|pkwy|pk)\b/g, "pk")
    .replace(/\b(?:highway|hwy)\b/g, "hwy")
    .replace(/\b(?:circle|cir|cr)\b/g, "cr")
    .replace(/\b(?:trail|trl)\b/g, "tr")
    .replace(/\bnorth\b/g, "n")
    .replace(/\bsouth\b/g, "s")
    .replace(/\beast\b/g, "e")
    .replace(/\bwest\b/g, "w")
    .trim();
}

function applyFilter(records: CrimeRecord[], filter: RecordFilter | undefined): CrimeRecord[] {
  if (!filter) return records;
  const offenseLower = filter.offense?.toLowerCase();
  const weaponLower = filter.weapon?.toLowerCase();
  const addressNeedle = filter.addressContains
    ? normalizeAddressForMatch(filter.addressContains)
    : null;
  const dateStart = filter.dateStart ? new Date(filter.dateStart) : null;
  const dateEnd = filter.dateEnd ? new Date(`${filter.dateEnd}T23:59:59`) : null;
  const useRadius =
    typeof filter.centerLat === "number" &&
    typeof filter.centerLon === "number" &&
    typeof filter.radiusMiles === "number";

  // Pre-compute membership sets for the multi-value filters. A record passes
  // the ZIP gate if it matches `zip` OR is in `zips` (union semantics); same
  // for district. If neither singular nor plural is set, the gate is open.
  const zipSet =
    filter.zip || (filter.zips && filter.zips.length > 0)
      ? new Set<string>([
          ...(filter.zip ? [filter.zip] : []),
          ...(filter.zips ?? []),
        ])
      : null;
  const districtSet =
    filter.district || (filter.districts && filter.districts.length > 0)
      ? new Set<string>([
          ...(filter.district ? [filter.district] : []),
          ...(filter.districts ?? []),
        ])
      : null;

  return records.filter((r) => {
    if (zipSet && !zipSet.has((r.raw.ZIP?.trim() ?? ""))) return false;
    if (districtSet && !districtSet.has(r.district)) return false;
    if (filter.region) {
      if (r.latitude === null || r.longitude === null) return false;
      if (classifyArea(r.latitude, r.longitude) !== filter.region) return false;
    }
    if (offenseLower && !r.offense.toLowerCase().includes(offenseLower)) return false;
    if (weaponLower) {
      const w = r.raw.WeaponUsed?.trim().toLowerCase();
      if (!w || !w.includes(weaponLower)) return false;
    }
    if (addressNeedle && !normalizeAddressForMatch(r.address).includes(addressNeedle)) return false;
    if (dateStart && r.date < dateStart) return false;
    if (dateEnd && r.date > dateEnd) return false;
    if (useRadius) {
      if (r.latitude === null || r.longitude === null) return false;
      const d = haversineDistanceMiles(
        filter.centerLat as number,
        filter.centerLon as number,
        r.latitude,
        r.longitude,
      );
      if (d > (filter.radiusMiles as number)) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Helpers used by multiple tools
// ---------------------------------------------------------------------------

function formatRecordSummary(r: CrimeRecord): {
  date: string;
  offense: string;
  address: string;
  zip: string;
  district: string;
  weapon: string | null;
  hour: number | null;
  lat: number | null;
  lon: number | null;
} {
  return {
    date: r.date.toISOString(),
    offense: formatOffense(r.offense),
    address: r.address || "unknown",
    zip: r.raw.ZIP?.trim() || "",
    district: r.district || "",
    weapon: r.raw.WeaponUsed?.trim() || null,
    hour: r.hour,
    lat: r.latitude,
    lon: r.longitude,
  };
}

/**
 * Build a human-readable label for a hotspot — the closest record's
 * address + district + ZIP — so the LLM has something concrete to quote
 * instead of raw lat/lon. Mirrors the chat.ts describeHotspot output but
 * returns structured fields the model can use independently.
 */

function hotspotLabel(
  hotspot: { lat: number; lon: number },
  records: CrimeRecord[],
): { label: string; address: string; district: string; zip: string } {
  let best: { record: CrimeRecord; distSq: number } | null = null;
  for (const r of records) {
    if (r.latitude === null || r.longitude === null) continue;
    if (r.offense === "LockedVehicle") continue;
    const distSq =
      (r.latitude - hotspot.lat) ** 2 + (r.longitude - hotspot.lon) ** 2;
    if (!best || distSq < best.distSq) best = { record: r, distSq };
  }
  if (!best) {
    return { label: "unmapped area (no nearby record)", address: "", district: "", zip: "" };
  }
  const r = best.record;
  const address = r.address || "";
  const district = r.district || "";
  const zip = r.raw.ZIP?.trim() || "";
  const parts: string[] = [];
  if (address) parts.push(address);
  if (district) parts.push(`District ${district}`);
  if (zip) parts.push(`ZIP ${zip}`);
  return {
    label: parts.join(", ") || "unknown street",
    address,
    district,
    zip,
  };
}

function topNCounts(map: Map<string, number>, n: number): Array<{ name: string; count: number }> {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

// ---------------------------------------------------------------------------
// TOOL: get_dataset_summary — high-level overview of the loaded dataset.
// LLM should call this once early in the conversation to ground itself.
// ---------------------------------------------------------------------------

const getDatasetSummaryTool: ToolDefinition = {
  name: "get_dataset_summary",
  description:
    "Returns a high-level overview of the loaded WIBR crime dataset: total record count, date range, top offenses, top ZIPs, top districts, weapon breakdown, and the top hotspots. Call this FIRST when you need orientation about what's in the dataset, especially for broad questions ('what's the overall crime picture', 'where are the worst areas'). Cheap to call.",
  parameters: { type: "object", additionalProperties: false, properties: {} },
  execute: (_params, ctx) => {
    const { records, analytics } = ctx;
    if (records.length === 0) {
      return { totalIncidents: 0, message: "No records loaded." };
    }
    const dates = records.map((r) => r.date.getTime());
    const minDate = new Date(Math.min(...dates)).toISOString();
    const maxDate = new Date(Math.max(...dates)).toISOString();
    return {
      totalIncidents: analytics.totalIncidents,
      mappedIncidents: analytics.mappedIncidents,
      dateRange: { start: minDate, end: maxDate },
      trendDirection: analytics.trendDirection,
      topOffenses: analytics.offenseDistribution.slice(0, 8).map((o) => ({
        offense: formatOffense(o.name),
        count: o.count,
      })),
      topZips: analytics.zipDistribution.slice(0, 8),
      topDistricts: analytics.districtDistribution.slice(0, 8),
      topWeapons: analytics.weaponDistribution.slice(0, 8),
      topHotspots: analytics.topHotspots.slice(0, 10).map((h) => ({
        ...hotspotLabel(h, records),
        lat: h.lat,
        lon: h.lon,
        totalIncidents: h.count,
        recentCount: h.recentCount,
        previousCount: h.previousCount,
        growth: h.growth,
        region: classifyArea(h.lat, h.lon),
      })),
      topRisingAreas: analytics.topRisingAreas.slice(0, 10).map((h) => ({
        ...hotspotLabel(h, records),
        lat: h.lat,
        lon: h.lon,
        totalIncidents: h.count,
        recentCount: h.recentCount,
        previousCount: h.previousCount,
        growth: h.growth,
        region: classifyArea(h.lat, h.lon),
      })),
    };
  },
};

// ---------------------------------------------------------------------------
// TOOL: filter_records — count + sample records matching a filter.
// Use this to discover how many records meet a condition before deciding
// whether to drill into them or aggregate them. The sample shows the 5 most
// recent records so the LLM can narrate concrete examples.
// ---------------------------------------------------------------------------

const filterRecordsTool: ToolDefinition = {
  name: "filter_records",
  description:
    "Filter the dataset by ZIP, district, offense, weapon, address substring, date range, or geographic radius. Returns the matching record COUNT, the date range of matches, and a small SAMPLE of the 5 most-recent matching records (with date, offense, address, weapon). Use this to scope a question ('how many robberies in 53206 last 30 days?') before drilling deeper. Pair with compute_stats for aggregates or list_records for full record listings.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: { filter: FILTER_SCHEMA },
    required: ["filter"],
  },
  execute: (params: { filter: RecordFilter }, ctx) => {
    const matched = applyFilter(ctx.records, params.filter);
    const sorted = [...matched].sort((a, b) => b.date.getTime() - a.date.getTime());
    const sample = sorted.slice(0, 5).map(formatRecordSummary);
    const dateRange =
      matched.length > 0
        ? {
            start: new Date(Math.min(...matched.map((r) => r.date.getTime()))).toISOString(),
            end: new Date(Math.max(...matched.map((r) => r.date.getTime()))).toISOString(),
          }
        : null;
    return {
      count: matched.length,
      dateRange,
      sample,
    };
  },
};

// ---------------------------------------------------------------------------
// TOOL: list_records — return up to N records matching a filter, with full
// detail. Use when the user asks 'list the incidents', 'show me the
// records', 'what happened on X date', 'pick a few examples'. Capped at 50
// records per call to keep prompt size bounded.
// ---------------------------------------------------------------------------

const listRecordsTool: ToolDefinition = {
  name: "list_records",
  description:
    "Return the actual records matching a filter, sorted newest-first by default. Use when the user asks to LIST, SHOW, or DESCRIBE specific incidents — e.g. 'list the robberies in district 5', 'show me the most recent thefts at 35th and Wisconsin', 'what happened on April 12 in 53206'. Each record includes date, offense, address, ZIP, district, weapon, hour, and lat/lon. Capped at 50 records per call; if more match, the response includes 'totalMatching' so you can tell the user there are more and offer to filter further.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      filter: FILTER_SCHEMA,
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Max records to return (default 20, max 50).",
      },
      sort: {
        type: "string",
        enum: ["newest", "oldest"],
        description: "Sort order. Default 'newest'.",
      },
    },
    required: ["filter"],
  },
  execute: (
    params: { filter: RecordFilter; limit?: number; sort?: "newest" | "oldest" },
    ctx,
  ) => {
    const matched = applyFilter(ctx.records, params.filter);
    const limit = Math.min(params.limit ?? 20, 50);
    const sorted = [...matched].sort((a, b) =>
      params.sort === "oldest"
        ? a.date.getTime() - b.date.getTime()
        : b.date.getTime() - a.date.getTime(),
    );
    return {
      totalMatching: matched.length,
      returned: Math.min(limit, matched.length),
      records: sorted.slice(0, limit).map(formatRecordSummary),
    };
  },
};

// ---------------------------------------------------------------------------
// TOOL: compute_stats — aggregate dimensions over a filtered record set.
// The LLM can request only the dimensions it needs to keep the response
// small. Returns nulls for dimensions not requested.
// ---------------------------------------------------------------------------

type StatDimension =
  | "topOffenses"
  | "peakHours"
  | "peakDays"
  | "monthlyTrend"
  | "weapons"
  | "recentVsPrior"
  | "topStreets"
  | "topZips"
  | "topDistricts"
  | "milwaukeeSideBreakdown";

const computeStatsTool: ToolDefinition = {
  name: "compute_stats",
  description:
    "Compute aggregate statistics over records matching a filter. Specify which DIMENSIONS you need to keep the response compact: 'topOffenses', 'peakHours', 'peakDays', 'monthlyTrend', 'weapons', 'recentVsPrior' (30d vs prior 30d delta per offense), 'topStreets', 'topZips', 'topDistricts', 'milwaukeeSideBreakdown'. Use this for 'when does X happen?', 'what crimes are most common in X?', 'is X getting worse?', 'which side of the city has the most Y?'.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      filter: FILTER_SCHEMA,
      dimensions: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "topOffenses",
            "peakHours",
            "peakDays",
            "monthlyTrend",
            "weapons",
            "recentVsPrior",
            "topStreets",
            "topZips",
            "topDistricts",
            "milwaukeeSideBreakdown",
          ],
        },
        description: "Which aggregate dimensions to compute. Pick only what you need.",
      },
    },
    required: ["filter", "dimensions"],
  },
  execute: (params: { filter: RecordFilter; dimensions: StatDimension[] }, ctx) => {
    const matched = applyFilter(ctx.records, params.filter);
    const total = matched.length;
    const result: Record<string, unknown> = { totalMatching: total };
    if (total === 0) return result;

    const wanted = new Set(params.dimensions);

    if (wanted.has("topOffenses")) {
      const m = new Map<string, number>();
      for (const r of matched) m.set(r.offense, (m.get(r.offense) ?? 0) + 1);
      result.topOffenses = topNCounts(m, 8).map((e) => ({
        offense: formatOffense(e.name),
        count: e.count,
      }));
    }
    if (wanted.has("peakHours")) {
      const buckets = new Array<number>(24).fill(0);
      let timestamped = 0;
      for (const r of matched) {
        if (r.hour !== null) {
          buckets[r.hour] += 1;
          timestamped += 1;
        }
      }
      result.peakHours = {
        timestampedRecords: timestamped,
        perHour: buckets.map((count, hour) => ({ hour, count })),
        topHours: buckets
          .map((count, hour) => ({ hour, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      };
    }
    if (wanted.has("peakDays")) {
      const m = new Map<string, number>();
      for (const r of matched) m.set(r.dayOfWeek, (m.get(r.dayOfWeek) ?? 0) + 1);
      result.peakDays = topNCounts(m, 7);
    }
    if (wanted.has("monthlyTrend")) {
      const m = new Map<string, number>();
      for (const r of matched) m.set(r.monthKey, (m.get(r.monthKey) ?? 0) + 1);
      result.monthlyTrend = [...m.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([monthKey, count]) => ({ monthKey, count }));
    }
    if (wanted.has("weapons")) {
      const m = new Map<string, number>();
      let armed = 0;
      for (const r of matched) {
        const w = r.raw.WeaponUsed?.trim();
        if (w) {
          m.set(w, (m.get(w) ?? 0) + 1);
          armed += 1;
        }
      }
      result.weapons = {
        armedCount: armed,
        unarmedCount: total - armed,
        topWeapons: topNCounts(m, 8),
      };
    }
    if (wanted.has("recentVsPrior")) {
      const mostRecent = Math.max(...matched.map((r) => r.date.getTime()));
      const recentStart = mostRecent - 30 * 24 * 60 * 60 * 1000;
      const previousStart = mostRecent - 60 * 24 * 60 * 60 * 1000;
      const recent = new Map<string, number>();
      const previous = new Map<string, number>();
      for (const r of matched) {
        const ts = r.date.getTime();
        if (ts >= recentStart) recent.set(r.offense, (recent.get(r.offense) ?? 0) + 1);
        else if (ts >= previousStart)
          previous.set(r.offense, (previous.get(r.offense) ?? 0) + 1);
      }
      const offenses = new Set([...recent.keys(), ...previous.keys()]);
      result.recentVsPrior = {
        windowEnd: new Date(mostRecent).toISOString(),
        recent30dStart: new Date(recentStart).toISOString(),
        prior30dStart: new Date(previousStart).toISOString(),
        deltas: [...offenses]
          .map((offense) => ({
            offense: formatOffense(offense),
            recent: recent.get(offense) ?? 0,
            previous: previous.get(offense) ?? 0,
            delta: (recent.get(offense) ?? 0) - (previous.get(offense) ?? 0),
          }))
          .sort((a, b) => b.delta - a.delta),
      };
    }
    if (wanted.has("topStreets")) {
      const m = new Map<string, number>();
      for (const r of matched) {
        const street = r.address.replace(/^\d+\s+/, "").trim();
        if (street) m.set(street, (m.get(street) ?? 0) + 1);
      }
      result.topStreets = topNCounts(m, 8);
    }
    if (wanted.has("topZips")) {
      const m = new Map<string, number>();
      for (const r of matched) {
        const z = r.raw.ZIP?.trim();
        if (z) m.set(z, (m.get(z) ?? 0) + 1);
      }
      result.topZips = topNCounts(m, 8);
    }
    if (wanted.has("topDistricts")) {
      const m = new Map<string, number>();
      for (const r of matched) {
        if (r.district) m.set(r.district, (m.get(r.district) ?? 0) + 1);
      }
      result.topDistricts = topNCounts(m, 8);
    }
    if (wanted.has("milwaukeeSideBreakdown")) {
      const sides = new Map<string, number>();
      let unmapped = 0;
      for (const r of matched) {
        if (r.latitude === null || r.longitude === null) {
          unmapped += 1;
          continue;
        }
        const side = classifyArea(r.latitude, r.longitude);
        sides.set(side, (sides.get(side) ?? 0) + 1);
      }
      result.milwaukeeSideBreakdown = {
        bySide: topNCounts(sides, 10),
        unmappedRecords: unmapped,
      };
    }

    return result;
  },
};

// ---------------------------------------------------------------------------
// TOOL: find_hotspots — return hotspot clusters, optionally filtered.
// ---------------------------------------------------------------------------

const findHotspotsTool: ToolDefinition = {
  name: "find_hotspots",
  description:
    "Find hotspot clusters (each ~330m wide, computed from record lat/lon). Optionally filter the records first by ZIP/offense/date/etc, then cluster the filtered records. Sort by 'volume' (total incidents — for 'where is the most crime') or 'recent_growth' (recent 30d minus previous 30d — for 'where is crime rising / getting worse / trending up'). Optionally restrict to a Milwaukee region. Each returned hotspot includes a `label` (closest street address + district + ZIP) — ALWAYS reference the hotspot by this label in your reply, NEVER by raw lat/lon coordinates.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      filter: FILTER_SCHEMA,
      sortBy: {
        type: "string",
        enum: ["volume", "recent_growth"],
        description:
          "'volume' = total incident count (top hotspots). 'recent_growth' = recent 30d minus prior 30d (rising areas). Default 'volume'.",
      },
      region: {
        type: "string",
        enum: [
          "north side",
          "south side",
          "east side",
          "west side",
          "northwest side",
          "southwest side",
          "downtown",
        ],
        description: "Restrict to clusters within this Milwaukee region.",
      },
      limit: { type: "integer", minimum: 1, maximum: 20, description: "Max clusters (default 8)." },
      minRecentCount: {
        type: "integer",
        minimum: 0,
        description:
          "When sortBy='recent_growth', require at least this many recent-30d incidents to qualify (default 3).",
      },
    },
  },
  execute: (
    params: {
      filter?: RecordFilter;
      sortBy?: "volume" | "recent_growth";
      region?: string;
      limit?: number;
      minRecentCount?: number;
    },
    ctx,
  ) => {
    const records = applyFilter(ctx.records, params.filter);
    if (records.length === 0) return { hotspots: [] };

    let hotspots: Hotspot[] = createHotspotGrid(records);

    if (params.region) {
      hotspots = hotspots.filter((h) => classifyArea(h.lat, h.lon) === params.region);
    }

    const sortBy = params.sortBy ?? "volume";
    if (sortBy === "recent_growth") {
      const minRecent = params.minRecentCount ?? 3;
      hotspots = hotspots
        .filter((h) => h.recentCount >= minRecent && h.growth > 0)
        .sort((a, b) => b.growth - a.growth);
    } else {
      hotspots = hotspots.sort((a, b) => b.count - a.count);
    }

    const limit = Math.min(params.limit ?? 8, 20);
    return {
      sortBy,
      totalClusters: hotspots.length,
      hotspots: hotspots.slice(0, limit).map((h) => ({
        ...hotspotLabel(h, ctx.records),
        lat: h.lat,
        lon: h.lon,
        totalIncidents: h.count,
        recent30dCount: h.recentCount,
        previous30dCount: h.previousCount,
        growth: h.growth,
        region: classifyArea(h.lat, h.lon),
      })),
    };
  },
};

// ---------------------------------------------------------------------------
// TOOL: find_nearby_areas — geographically nearest ZIPs or districts.
// ---------------------------------------------------------------------------

const findNearbyAreasTool: ToolDefinition = {
  name: "find_nearby_areas",
  description:
    "Find the K geographically nearest ZIP codes or police districts to a target value, computed by record-centroid distance. Use this to resolve 'nearby ZIPs', 'surrounding districts', 'adjacent areas' phrasings into concrete neighbors so you can compare them. Returns each neighbor's value, distance in miles, and record count.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      kind: { type: "string", enum: ["zip", "district"], description: "Which administrative dimension." },
      value: { type: "string", description: "The target ZIP (e.g. '53202') or district (e.g. '5')." },
      k: { type: "integer", minimum: 1, maximum: 10, description: "How many neighbors (default 4)." },
      minRecordCount: {
        type: "integer",
        minimum: 1,
        description:
          "Skip peers with fewer than this many records to avoid noise (default 5).",
      },
    },
    required: ["kind", "value"],
  },
  execute: (
    params: { kind: "zip" | "district"; value: string; k?: number; minRecordCount?: number },
    ctx,
  ) => {
    const valueOf = (r: CrimeRecord): string | null =>
      params.kind === "zip" ? r.raw.ZIP?.trim() || null : r.district?.trim() || null;

    let targetLatSum = 0;
    let targetLonSum = 0;
    let targetCount = 0;
    const groups = new Map<string, { latSum: number; lonSum: number; count: number }>();

    for (const r of ctx.records) {
      if (r.latitude === null || r.longitude === null) continue;
      const v = valueOf(r);
      if (!v) continue;
      if (v === params.value) {
        targetLatSum += r.latitude;
        targetLonSum += r.longitude;
        targetCount += 1;
        continue;
      }
      const g = groups.get(v) ?? { latSum: 0, lonSum: 0, count: 0 };
      g.latSum += r.latitude;
      g.lonSum += r.longitude;
      g.count += 1;
      groups.set(v, g);
    }

    if (targetCount === 0) {
      return {
        target: { kind: params.kind, value: params.value, recordCount: 0 },
        neighbors: [],
        message:
          "Target has no mapped records in the dataset; cannot compute geographic neighbors.",
      };
    }

    const targetLat = targetLatSum / targetCount;
    const targetLon = targetLonSum / targetCount;
    const minRecord = params.minRecordCount ?? 5;
    const k = Math.min(params.k ?? 4, 10);

    const neighbors = [...groups.entries()]
      .filter(([, g]) => g.count >= minRecord)
      .map(([value, g]) => ({
        value,
        distanceMiles: haversineDistanceMiles(
          targetLat,
          targetLon,
          g.latSum / g.count,
          g.lonSum / g.count,
        ),
        recordCount: g.count,
      }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, k);

    return {
      target: {
        kind: params.kind,
        value: params.value,
        recordCount: targetCount,
        centroid: { lat: targetLat, lon: targetLon },
      },
      neighbors,
    };
  },
};

// ---------------------------------------------------------------------------
// TOOL: geocode_milwaukee — resolve a free-text place reference (street,
// landmark, intersection) to lat/lon via Nominatim, scoped to Milwaukee.
// ---------------------------------------------------------------------------

const geocodeMilwaukeeTool: ToolDefinition = {
  name: "geocode_milwaukee",
  description:
    "Resolve a Milwaukee street name, landmark, or intersection to lat/lon coordinates via OpenStreetMap. Use this when the user mentions a place by name (e.g. 'Atkinson Ave', 'Mitchell Park', '27th and Wisconsin', 'Brewers Stadium') and you need coordinates to call find_records_near_point or to locate it on the map. Returns null if the place cannot be resolved within Milwaukee. Cached in-memory.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: {
        type: "string",
        description:
          "The place description as the user phrased it. Can be a street, landmark, or intersection.",
      },
    },
    required: ["query"],
  },
  execute: async (params: { query: string }) => {
    const result = await geocodeMilwaukeeStreet(params.query);
    if (!result) {
      return { resolved: false, query: params.query };
    }
    return {
      resolved: true,
      query: params.query,
      lat: result.lat,
      lon: result.lon,
      region: classifyArea(result.lat, result.lon),
    };
  },
};

// ---------------------------------------------------------------------------
// TOOL: emit_map_focus — programmatic instruction to fly the map to a
// location. The frontend listens for this and animates the map there. Use
// when the user explicitly asks to 'show on map', 'zoom to', 'take me to'.
// ---------------------------------------------------------------------------

const emitMapFocusTool: ToolDefinition = {
  name: "emit_map_focus",
  description:
    "Emit a programmatic map-focus instruction so the UI flies the user's map to this location. Call ONLY when the user explicitly asks to see something on the map ('show me on the map', 'zoom to', 'take me there', 'where is this').\n\nCRITICAL — coordinate sourcing: NEVER invent or recall lat/lon from your training data. The lat/lon you pass MUST come from one of these tool results in the SAME conversation turn:\n  • geocode_milwaukee (for a street, intersection, landmark) — use returned lat/lon, zoom 15-17.\n  • find_hotspots (for a specific hotspot the user is asking about) — use that hotspot's lat/lon, zoom 15-16.\n  • find_nearby_areas with kind='zip' or 'district' (for a ZIP or police district) — use the target.centroid lat/lon from the response, zoom 13. You can call find_nearby_areas just to get the centroid even if you don't need neighbors.\n  • A record's lat/lon from list_records / filter_records sample (for an exact incident address) — zoom 17.\n\nIf you cannot resolve a location via one of the above, do NOT call this tool — instead ask the user to clarify (e.g. 'Could you tell me the street, ZIP, or district you'd like me to zoom to?').\n\nZoom level guidance: 17 for an exact address, 15-16 for a hotspot/cluster, 13 for a broader neighborhood/ZIP/district, 11-12 for a whole side of the city.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      lat: { type: "number" },
      lon: { type: "number" },
      zoom: { type: "integer", minimum: 10, maximum: 18, description: "Map zoom level." },
      label: {
        type: "string",
        description: "Short human-readable label for what the map is focusing on.",
      },
    },
    required: ["lat", "lon", "zoom", "label"],
  },
  execute: (params: { lat: number; lon: number; zoom: number; label: string }) => {
    // The actual side-effect is captured by the chat loop, which records
    // this tool's params and passes them to the UI as MapFocus. The tool's
    // own response is acknowledgement so the model knows the focus was set.
    return { acknowledged: true, focus: params };
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const TOOLS: ToolDefinition[] = [
  getDatasetSummaryTool,
  filterRecordsTool,
  listRecordsTool,
  computeStatsTool,
  findHotspotsTool,
  findNearbyAreasTool,
  geocodeMilwaukeeTool,
  emitMapFocusTool,
];

export const TOOL_BY_NAME: Map<string, ToolDefinition> = new Map(
  TOOLS.map((t) => [t.name, t]),
);

/**
 * OpenAI tool schema array format. Pass directly as the `tools` field on
 * a chat-completions request.
 */
export const OPENAI_TOOL_SCHEMAS = TOOLS.map((t) => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  },
}));
