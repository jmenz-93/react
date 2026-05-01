import Papa from "papaparse";
import proj4 from "proj4";
import type { ColumnMapping, CrimeRecord, ParsedCsvResult } from "./types";

const WIBR_OFFENSES = [
  "Arson", "AssaultOffense", "Burglary", "CriminalDamage", 
  "Homicide", "LockedVehicle", "Robbery", "SexOffense", 
  "Theft", "VehicleTheft"
];

const COLUMN_CANDIDATES = {
  date: ["date", "reporteddatetime", "reported_date", "occurred_date", "incident_date", "datetime", "reported"],
  offense: ["offense", "offense_type", "crime", "crime_type", "category", "ucr"],
  description: ["description", "weaponused", "offense_description", "details", "incident_description"],
  district: ["district", "police_district", "police", "beat", "ward", "area"],
  address: ["address", "location", "block", "street", "premise"],
  latitude: ["latitude", "lat", "ycoord", "y_coordinate"],
  longitude: ["longitude", "lon", "lng", "xcoord", "x_coordinate"],
  hour: ["hour", "time", "incident_time", "occurrence_time"],
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const WGS84 = "EPSG:4326";

const ROUGH_COORD_CANDIDATES = [
  {
    name: "NAD83 / Wisconsin South (ftUS, MPD calibrated)",
    // MPD RoughX/RoughY aligns best with this tuned false easting.
    def: "+proj=lcc +lat_1=42.73333333333333 +lat_2=44.06666666666667 +lat_0=42 +lon_0=-90 +x_0=609600 +y_0=0 +datum=NAD83 +units=us-ft +no_defs",
  },
  {
    name: "NAD27 / Wisconsin South (ftUS)",
    def: "+proj=lcc +lat_1=42.73333333333333 +lat_2=44.06666666666667 +lat_0=42 +lon_0=-90 +x_0=2000000 +y_0=0 +datum=NAD27 +units=us-ft +no_defs",
  },
  {
    name: "NAD83 / Wisconsin South (ftUS)",
    def: "+proj=lcc +lat_1=42.73333333333333 +lat_2=44.06666666666667 +lat_0=42 +lon_0=-90 +x_0=600000 +y_0=0 +datum=NAD83 +units=us-ft +no_defs",
  },
  {
    name: "NAD83 / Wisconsin South (m)",
    def: "+proj=lcc +lat_1=42.73333333333333 +lat_2=44.06666666666667 +lat_0=42 +lon_0=-90 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
  },
  {
    name: "NAD83(HARN) / Wisconsin TM (m)",
    def: "+proj=tmerc +lat_0=0 +lon_0=-90 +k=0.9996 +x_0=520000 +y_0=-4480000 +ellps=GRS80 +units=m +no_defs",
  },
];

const MILWAUKEE_BOUNDS = {
  latMin: 42.85,
  latMax: 43.25,
  lonMin: -88.15,
  lonMax: -87.75,
};

type LatLon = { latitude: number; longitude: number };

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findColumn(headers: string[], candidates: string[]): string | null {
  const normalizedHeaders = headers.map((h) => ({ original: h, normalized: normalize(h) }));

  for (const candidate of candidates) {
    const candidateNormalized = normalize(candidate);
    const exact = normalizedHeaders.find((h) => h.normalized === candidateNormalized);
    if (exact) {
      return exact.original;
    }
  }

  for (const candidate of candidates) {
    const candidateNormalized = normalize(candidate);
    const partial = normalizedHeaders.find((h) => h.normalized.includes(candidateNormalized));
    if (partial) {
      return partial.original;
    }
  }

  return null;
}

// Returns the parsed date plus whether the source string actually included
// a time-of-day component. Without this flag, callers can't distinguish a
// real midnight incident from a date-only record that defaulted to 00:00,
// which causes the 'peak hour = midnight' artifact in hourly analytics.
function parseDate(raw: string | undefined): { date: Date; hasTime: boolean } | null {
  if (!raw) {
    return null;
  }

  const text = raw.trim();
  if (!text) {
    return null;
  }

  // A real time component looks like '14:30', '2:30 PM', 'T14:30:00Z', etc.
  // We do not treat a bare 'T00:00:00' as a time — some WIBR exports use
  // that as a date-only placeholder.
  const hasTimeRaw =
    /\d{1,2}:\d{2}/.test(text) && !/T?00:00:00(?:\.0+)?Z?$/.test(text);

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return { date: parsed, hasTime: hasTimeRaw };
  }

  const fallback = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(text);
  if (!fallback) {
    return null;
  }

  const month = Number(fallback[1]) - 1;
  const day = Number(fallback[2]);
  const yearValue = Number(fallback[3]);
  const year = yearValue < 100 ? 2000 + yearValue : yearValue;
  const value = new Date(year, month, day);
  // Date-only fallback path — by definition no time component.
  return Number.isNaN(value.getTime()) ? null : { date: value, hasTime: false };
}

function parseNumeric(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseBinaryFlag(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }

  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseLatLon(rawLat: string | undefined, rawLon: string | undefined): { latitude: number | null; longitude: number | null } {
  const latitude = parseNumeric(rawLat);
  const longitude = parseNumeric(rawLon);

  if (latitude === null || longitude === null) {
    return { latitude: null, longitude: null };
  }

  // Filter out projected/local coordinate systems when true lat/lon values are expected.
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { latitude: null, longitude: null };
  }

  return { latitude, longitude };
}

function inMilwaukeeBounds(latitude: number, longitude: number): boolean {
  return (
    latitude >= MILWAUKEE_BOUNDS.latMin &&
    latitude <= MILWAUKEE_BOUNDS.latMax &&
    longitude >= MILWAUKEE_BOUNDS.lonMin &&
    longitude <= MILWAUKEE_BOUNDS.lonMax
  );
}

function collectRoughSamples(rows: Record<string, string>[]): Array<{ x: number; y: number }> {
  return rows
    .map((row) => {
      const x = parseNumeric(row.RoughX);
      const y = parseNumeric(row.RoughY);
      return x !== null && y !== null ? { x, y } : null;
    })
    .filter((sample): sample is { x: number; y: number } => sample !== null)
    .slice(0, 400);
}

function projectToLatLon(definition: string, x: number, y: number): LatLon | null {
  try {
    const [longitude, latitude] = proj4(definition, WGS84, [x, y]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    return { latitude, longitude };
  } catch {
    return null;
  }
}

function scoreProjectionCandidate(definition: string, samples: Array<{ x: number; y: number }>): number {
  let score = 0;

  for (const sample of samples) {
    const projected = projectToLatLon(definition, sample.x, sample.y);
    if (projected && inMilwaukeeBounds(projected.latitude, projected.longitude)) {
      score += 1;
    }
  }

  return score;
}

function buildRoughCoordinateConverter(definition: string): (x: number, y: number) => LatLon | null {
  return (x: number, y: number): LatLon | null => {
    const projected = projectToLatLon(definition, x, y);
    if (!projected) {
      return null;
    }

    if (!inMilwaukeeBounds(projected.latitude, projected.longitude)) {
      return null;
    }

    return projected;
  };
}

function resolveRoughCoordinateConverter(rows: Record<string, string>[]): ((x: number, y: number) => LatLon | null) | null {
  const samples = collectRoughSamples(rows);

  if (samples.length === 0) {
    return null;
  }

  let best: { def: string; score: number } | null = null;

  for (const candidate of ROUGH_COORD_CANDIDATES) {
    const score = scoreProjectionCandidate(candidate.def, samples);

    if (!best || score > best.score) {
      best = { def: candidate.def, score };
    }
  }

  if (!best || best.score < Math.max(8, Math.floor(samples.length * 0.2))) {
    return null;
  }

  return buildRoughCoordinateConverter(best.def);
}

function parseHour(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const exactNumber = Number(trimmed);
  if (Number.isFinite(exactNumber) && exactNumber >= 0 && exactNumber <= 23) {
    return Math.floor(exactNumber);
  }

  const timeMatch = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(trimmed);
  if (!timeMatch) {
    return null;
  }

  let hour = Number(timeMatch[1]);
  const meridiem = timeMatch[3]?.toLowerCase();

  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }

  if (hour < 0 || hour > 23) {
    return null;
  }

  return hour;
}

function mapColumns(headers: string[]): ColumnMapping {
  const detectedOffenseColumn = findColumn(headers, COLUMN_CANDIDATES.offense);
  const offenseColumn = detectedOffenseColumn && WIBR_OFFENSES.includes(detectedOffenseColumn)
    ? null
    : detectedOffenseColumn;

  return {
    dateColumn: findColumn(headers, COLUMN_CANDIDATES.date),
    offenseColumn,
    descriptionColumn: findColumn(headers, COLUMN_CANDIDATES.description),
    districtColumn: findColumn(headers, COLUMN_CANDIDATES.district),
    addressColumn: findColumn(headers, COLUMN_CANDIDATES.address),
    latitudeColumn: findColumn(headers, COLUMN_CANDIDATES.latitude),
    longitudeColumn: findColumn(headers, COLUMN_CANDIDATES.longitude),
    hourColumn: findColumn(headers, COLUMN_CANDIDATES.hour),
  };
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function rowValue(row: Record<string, string>, key: string | null): string | undefined {
  if (!key) {
    return undefined;
  }
  return row[key];
}

export async function parseCrimeCsv(file: File): Promise<ParsedCsvResult> {
  const data = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: resolve,
      error: reject,
    });
  });

  const headers = data.meta.fields ?? [];
  const mapping = mapColumns(headers);
  const warnings: string[] = [];

  if (!mapping.dateColumn) {
    warnings.push("Could not auto-detect a date column. Some trend analysis may be incomplete.");
  }
  const hasWibrColumns = headers.some(h => WIBR_OFFENSES.includes(h));
  const hasProjectedCoordinates = headers.includes("RoughX") && headers.includes("RoughY");
  const roughCoordinateConverter = hasProjectedCoordinates ? resolveRoughCoordinateConverter(data.data) : null;
  const hasUsableCoordinates =
    (!!mapping.latitudeColumn && !!mapping.longitudeColumn) || !!roughCoordinateConverter;
  if (!hasUsableCoordinates) {
    warnings.push("Could not detect map coordinates in this file. Map overlays will be limited.");
  }

  if (!mapping.offenseColumn && !hasWibrColumns) {
    warnings.push("Could not auto-detect an offense category column. Offense charts may be generic.");
  }
  if (hasProjectedCoordinates && (!mapping.latitudeColumn || !mapping.longitudeColumn) && !roughCoordinateConverter) {
    warnings.push("Could not infer map projection from the file. Map overlays may be limited.");
  }

  const records: CrimeRecord[] = [];
  let ignoredRows = 0;

  data.data.forEach((row: Record<string, string>, index: number) => {
    const dateResult = parseDate(rowValue(row, mapping.dateColumn));
    if (!dateResult) {
      ignoredRows += 1;
      return;
    }

    let { latitude, longitude } = parseLatLon(
      rowValue(row, mapping.latitudeColumn),
      rowValue(row, mapping.longitudeColumn)
    );

    if ((latitude === null || longitude === null) && roughCoordinateConverter) {
      const roughX = parseNumeric(row.RoughX);
      const roughY = parseNumeric(row.RoughY);
      if (roughX !== null && roughY !== null) {
        const converted = roughCoordinateConverter(roughX, roughY);
        if (converted) {
          latitude = converted.latitude;
          longitude = converted.longitude;
        }
      }
    }
    
    let offense = rowValue(row, mapping.offenseColumn)?.trim();
    const isBinaryFlagValue = offense === "0" || offense === "1" || offense?.toLowerCase() === "true" || offense?.toLowerCase() === "false";
    if (!offense || (isBinaryFlagValue && hasWibrColumns)) {
      offense = WIBR_OFFENSES.find((name) => parseBinaryFlag(row[name])) || "Unknown Offense";
    }

    const description = rowValue(row, mapping.descriptionColumn)?.trim() || "";
    const district = rowValue(row, mapping.districtColumn)?.trim() || "Unknown District";
    const address = rowValue(row, mapping.addressColumn)?.trim() || "Unknown Address";
    const { date, hasTime } = dateResult;
    // Only fall back to date.getHours() when the original date string actually
    // had a time component. Otherwise leave hour null so hourly analytics
    // don't treat a date-only record as a midnight incident.
    const parsedHour = parseHour(rowValue(row, mapping.hourColumn));
    const hour = parsedHour ?? (hasTime ? date.getHours() : null);

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    records.push({
      id: `${index + 1}`,
      date,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      monthKey,
      dayOfWeek: DAY_NAMES[date.getDay()],
      hour,
      offense,
      description,
      district,
      address,
      latitude,
      longitude,
      raw: row,
    });
  });

  records.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (records.length === 0) {
    warnings.push("No rows with parseable dates were found in this CSV.");
  }

  if (records.length > 0 && !records[0].monthKey) {
    warnings.push(`Month labels may be malformed. Example row date: ${formatMonthLabel(records[0].date)}`);
  }

  return {
    records,
    mapping,
    warnings,
    ignoredRows,
  };
}
