import type { CategoryCount, CrimeAnalytics, CrimeRecord, Hotspot, MonthlyCount } from "./types";

const EXCLUDED_OFFENSES = new Set(["LockedVehicle"]);

function toCountList(map: Map<string, number>, limit = 10): CategoryCount[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function calculateTrend(monthlyCounts: MonthlyCount[]): { direction: "up" | "down" | "flat"; slope: number } {
  if (monthlyCounts.length < 3) {
    return { direction: "flat", slope: 0 };
  }

  const points = monthlyCounts.map((entry, idx) => ({ x: idx, y: entry.incidents }));
  const n = points.length;
  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumXX = points.reduce((acc, p) => acc + p.x * p.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return { direction: "flat", slope: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const normalizedSlope = slope / Math.max(1, sumY / n);

  if (normalizedSlope > 0.03) {
    return { direction: "up", slope: normalizedSlope };
  }
  if (normalizedSlope < -0.03) {
    return { direction: "down", slope: normalizedSlope };
  }

  return { direction: "flat", slope: normalizedSlope };
}

export function createHotspotGrid(records: CrimeRecord[]): Hotspot[] {
  const mapped = records.filter((r) => r.latitude !== null && r.longitude !== null);
  if (mapped.length === 0) {
    return [];
  }

  const mostRecentTimestamp = Math.max(...mapped.map((r) => r.date.getTime()));
  const recentThreshold = mostRecentTimestamp - 30 * 24 * 60 * 60 * 1000;
  const previousThreshold = mostRecentTimestamp - 60 * 24 * 60 * 60 * 1000;

  // Coarser grid (~0.003° ≈ 330m, a few city blocks) so multiple nearby
  // incidents aggregate into one area-level hotspot. The previous 0.0001°
  // resolution (~11m) only clustered incidents at the exact same address.
  const GRID_STEP = 0.003;
  const cellMap = new Map<string, { latSum: number; lonSum: number; count: number; recent: number; previous: number }>();

  for (const record of mapped) {
    const lat = record.latitude as number;
    const lon = record.longitude as number;

    const cellLat = Math.round(lat / GRID_STEP) * GRID_STEP;
    const cellLon = Math.round(lon / GRID_STEP) * GRID_STEP;
    const key = `${cellLat.toFixed(3)},${cellLon.toFixed(3)}`;
    const existing = cellMap.get(key) ?? { latSum: 0, lonSum: 0, count: 0, recent: 0, previous: 0 };

    existing.latSum += lat;
    existing.lonSum += lon;
    existing.count += 1;

    const ts = record.date.getTime();
    if (ts >= recentThreshold) {
      existing.recent += 1;
    } else if (ts >= previousThreshold) {
      existing.previous += 1;
    }

    cellMap.set(key, existing);
  }

  // 1. Convert the map into an array of objects
  const allCells = [...cellMap.entries()].map(([key, value]) => ({
    key,
    lat: value.latSum / value.count,
    lon: value.lonSum / value.count,
    count: value.count,
    recentCount: value.recent,
    previousCount: value.previous,
    growth: value.recent - value.previous,
  }));

  return allCells.sort((a, b) => b.count - a.count);
}

export function analyzeCrimeData(records: CrimeRecord[]): CrimeAnalytics {
  const monthlyMap = new Map<string, number>();
  const monthlyOffenseMap = new Map<string, Map<string, number>>();
  const offenseMap = new Map<string, number>();
  const districtMap = new Map<string, number>();
  const dayMap = new Map<string, number>();
  const hourMap = new Map<string, number>();
  const weaponMap = new Map<string, number>();
  const zipMap = new Map<string, number>();
  const wardMap = new Map<string, number>();
  const aldMap = new Map<string, number>();

  for (const record of records) {
    monthlyMap.set(record.monthKey, (monthlyMap.get(record.monthKey) ?? 0) + 1);
    if (!EXCLUDED_OFFENSES.has(record.offense)) {
      offenseMap.set(record.offense, (offenseMap.get(record.offense) ?? 0) + 1);
      const monthOffense = monthlyOffenseMap.get(record.monthKey) ?? new Map<string, number>();
      monthOffense.set(record.offense, (monthOffense.get(record.offense) ?? 0) + 1);
      monthlyOffenseMap.set(record.monthKey, monthOffense);
    }
    districtMap.set(record.district, (districtMap.get(record.district) ?? 0) + 1);
    dayMap.set(record.dayOfWeek, (dayMap.get(record.dayOfWeek) ?? 0) + 1);

    if (record.hour !== null) {
      const key = String(record.hour);
      hourMap.set(key, (hourMap.get(key) ?? 0) + 1);
    }

    const weaponUsed = record.raw.WeaponUsed?.trim();
    if (weaponUsed) {
      weaponMap.set(weaponUsed, (weaponMap.get(weaponUsed) ?? 0) + 1);
    }

    const zip = record.raw.ZIP?.trim();
    if (zip) {
      zipMap.set(zip, (zipMap.get(zip) ?? 0) + 1);
    }

    const ward = record.raw.WARD?.trim();
    if (ward) {
      wardMap.set(ward, (wardMap.get(ward) ?? 0) + 1);
    }

    const ald = record.raw.ALD?.trim();
    if (ald) {
      aldMap.set(ald, (aldMap.get(ald) ?? 0) + 1);
    }
  }

  const monthlyCounts = [...monthlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([monthKey, incidents]) => {
      const [year, month] = monthKey.split("-").map(Number);
      const date = new Date(year, month - 1, 1);
      return {
        monthKey,
        incidents,
        label: date.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      };
    });

  // Per-month breakdown by offense category. Each entry is { monthKey, label,
  // <offenseName>: count, ... } so it can be plotted directly as a stacked
  // area chart in the trends view.
  const allOffenses = [...offenseMap.keys()];
  const monthlyByOffense = monthlyCounts.map((entry) => {
    const perOffense = monthlyOffenseMap.get(entry.monthKey) ?? new Map<string, number>();
    const row: Record<string, string | number> = {
      monthKey: entry.monthKey,
      label: entry.label,
    };
    for (const offense of allOffenses) {
      row[offense] = perOffense.get(offense) ?? 0;
    }
    return row;
  });

  const trend = calculateTrend(monthlyCounts);
  const hotspots = createHotspotGrid(records);

  const likelyNextHotspot =
    hotspots
      .filter((h) => h.recentCount >= 3)
      .sort((a, b) => b.growth - a.growth || b.recentCount - a.recentCount)[0] ?? null;

  // Calculate threshold for Top Hotspots only
  let topHotspots = hotspots.slice(0, 20); // Fallback to raw Top 20

  if (hotspots.length > 0) {
    const mean = hotspots.reduce((sum, h) => sum + h.count, 0) / hotspots.length;
    const varianceSum = hotspots.reduce((sum, h) => sum + Math.pow(h.count - mean, 2), 0);
    const stdDev = Math.sqrt(varianceSum / hotspots.length);
    
    // Lowered to 1 Standard Deviation (Above Average Density)
    const threshold = mean + (1 * stdDev);
    
    const significantHotspots = hotspots.filter(h => h.count >= threshold);
    
    // Safety check: if the math filters out everything, just show the biggest 5
    if (significantHotspots.length === 0) {
      topHotspots = hotspots.slice(0, 5); 
    } else {
      topHotspots = significantHotspots.slice(0, 20);
    }
  }

  // 'Rising areas' still get to look at the FULL list
  const topRisingAreas = hotspots
    .filter((h) => h.recentCount >= 3 && h.growth > 0)
    .sort((a, b) => b.growth - a.growth || b.recentCount - a.recentCount)
    .slice(0, 10);

  return {
    totalIncidents: records.length,
    mappedIncidents: records.filter((r) => r.latitude !== null && r.longitude !== null).length,
    monthlyCounts,
    monthlyByOffense,
    offenseDistribution: toCountList(offenseMap, 12),
    districtDistribution: toCountList(districtMap, 12),
    weaponDistribution: toCountList(weaponMap, 8),
    zipDistribution: toCountList(zipMap, 10),
    wardDistribution: toCountList(wardMap, 10),
    aldDistribution: toCountList(aldMap, 10),
    dayOfWeekDistribution: toCountList(dayMap, 7),
    hourDistribution: Array.from({ length: 24 }, (_, h) => ({
      name: String(h),
      count: hourMap.get(String(h)) ?? 0,
    })),
    topHotspots,
    topRisingAreas,
    likelyNextHotspot,
    trendDirection: trend.direction,
    trendSlope: trend.slope,
  };
}
