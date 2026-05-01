import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { MapPin, Target, X } from "lucide-react";
import { createHotspotGrid } from "../lib/analytics";
import { formatOffense } from "../lib/format";
import type { CrimeAnalytics, CrimeRecord, Hotspot, MapBubbleSelection, MapFocus, MapVisibleState } from "../lib/types";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MapPanelProps {
  records: CrimeRecord[];
  analytics: CrimeAnalytics | null;
  selectedBubble: MapBubbleSelection | null;
  onBubbleSelect: (selection: MapBubbleSelection | null) => void;
  /** When the chat assistant emits a zoom-to-area instruction, the map flies to it. */
  mapFocus: MapFocus | null;
  /**
   * Pushed up whenever the visible hotspot list or in-map filters change,
   * so the chat assistant can answer "what's hotspot 1 on the map" against
   * the EXACT list the user is looking at — instead of re-computing a
   * parallel hotspot list that may disagree with what's on screen.
   */
  onVisibleStateChange?: (state: MapVisibleState) => void;
}

/**
 * Smoothly recenters and zooms the map whenever a new MapFocus is emitted.
 * Uses the focus.nonce as the dependency key so consecutive identical focuses
 * (same lat/lon/zoom) still re-trigger the flyTo (e.g. user re-asks 'show on
 * the map' after panning around manually).
 */
function FlyToFocus({ focus }: Readonly<{ focus: MapFocus | null }>): null {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lon], focus.zoom, { duration: 1.2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);
  return null;
}

const MILWAUKEE_CENTER: [number, number] = [43.0389, -87.9065];

// Offense color palette — matches the trends/insights view so users learn
// the mapping in one place and recognize it across map + charts.
const OFFENSE_COLORS: Record<string, string> = {
  Arson: "#ef4444",
  AssaultOffense: "#f97316",
  Burglary: "#eab308",
  CriminalDamage: "#84cc16",
  Homicide: "#ec4899",
  Robbery: "#06b6d4",
  SexOffense: "#8b5cf6",
  Theft: "#3b82f6",
  VehicleTheft: "#14b8a6",
};
function offenseColor(name: string): string {
  return OFFENSE_COLORS[name] ?? "#64748b";
}

function FitToRecords({ points }: Readonly<{ points: Array<[number, number]> }>): null {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    const lats = points.map((point) => point[0]);
    const lons = points.map((point) => point[1]);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    map.fitBounds(
      [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      { padding: [24, 24], maxZoom: 15 }
    );
  }, [map, points]);

  return null;
}

export function MapPanel({ records, analytics, selectedBubble, onBubbleSelect, mapFocus, onVisibleStateChange }: Readonly<MapPanelProps>): JSX.Element {
  const [showIncidents, setShowIncidents] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [enabledOffenses, setEnabledOffenses] = useState<Set<string> | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const mappedRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          record.latitude !== null &&
          record.longitude !== null &&
          record.offense !== "LockedVehicle"
      ),
    [records]
  );

  const center = useMemo<[number, number]>(() => {
    if (mappedRecords.length === 0) {
      return MILWAUKEE_CENTER;
    }

    const sample = mappedRecords.slice(0, Math.min(2000, mappedRecords.length));
    const latAvg = sample.reduce((acc, curr) => acc + (curr.latitude as number), 0) / sample.length;
    const lonAvg = sample.reduce((acc, curr) => acc + (curr.longitude as number), 0) / sample.length;
    return [latAvg, lonAvg];
  }, [mappedRecords]);

  // All distinct offense categories with counts, computed before any in-map
  // filters are applied. Drives the legend chip list (so chips don't vanish
  // when toggled off).
  const offenseCounts = useMemo<Array<[string, number]>>(() => {
    const counts = new Map<string, number>();
    for (const record of mappedRecords) {
      counts.set(record.offense, (counts.get(record.offense) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [mappedRecords]);
  const presentOffenses = useMemo<string[]>(
    () => offenseCounts.map(([name]) => name),
    [offenseCounts],
  );

  // Available months in the data, sorted newest first, for the month select.
  const availableMonths = useMemo<Array<{ key: string; label: string }>>(() => {
    const seen = new Map<string, string>();
    for (const record of mappedRecords) {
      if (!seen.has(record.monthKey)) {
        const [year, month] = record.monthKey.split("-").map(Number);
        const date = new Date(year, month - 1, 1);
        seen.set(
          record.monthKey,
          date.toLocaleString("en-US", { month: "short", year: "2-digit" }),
        );
      }
    }
    return [...seen.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, label]) => ({ key, label }));
  }, [mappedRecords]);

  // Default enabled set = everything currently in the data. Re-syncs when
  // categories appear/disappear (e.g. upstream area filter change).
  const presentKey = presentOffenses.join("|");
  useEffect(() => {
    setEnabledOffenses((prev) => {
      if (prev === null) return new Set(presentOffenses);
      const filtered = new Set([...prev].filter((n) => presentOffenses.includes(n)));
      if (filtered.size === 0) return new Set(presentOffenses);
      return filtered;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentKey]);

  // Reset month selection if the chosen month no longer exists.
  const monthKeys = availableMonths.map((m) => m.key).join("|");
  useEffect(() => {
    if (selectedMonth !== "all" && !availableMonths.some((m) => m.key === selectedMonth)) {
      setSelectedMonth("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKeys]);

  // Apply the in-map filters (category + month) to derive the records that
  // will actually be drawn. Hotspots are recomputed from the same filtered
  // set so a hotspot circle never contains zero visible incidents.
  const filteredMappedRecords = useMemo<CrimeRecord[]>(() => {
    return mappedRecords.filter((r) => {
      if (enabledOffenses && !enabledOffenses.has(r.offense)) return false;
      if (selectedMonth !== "all" && r.monthKey !== selectedMonth) return false;
      return true;
    });
  }, [mappedRecords, enabledOffenses, selectedMonth]);

  const incidentSlice = useMemo(
    () => filteredMappedRecords.slice(-10000),
    [filteredMappedRecords],
  );

  // Hotspots: when the user has applied any in-map filters (specific month or
  // toggled categories), recompute against the filtered set. Otherwise reuse
  // the upstream analytics version unchanged.
  const filteredHotspots = useMemo<Hotspot[]>(() => {
    const isFiltered =
      selectedMonth !== "all" ||
      (enabledOffenses !== null && enabledOffenses.size !== presentOffenses.length);
    
    if (!isFiltered) {
      return analytics?.topHotspots ?? [];
    }
    
    // Calculate the grid for the filtered map points
    const mapHotspots = createHotspotGrid(filteredMappedRecords);
    if (mapHotspots.length === 0) return [];
    
    // Apply Standard Deviation 
    const mean = mapHotspots.reduce((sum, h) => sum + h.count, 0) / mapHotspots.length;
    const varianceSum = mapHotspots.reduce((sum, h) => sum + Math.pow(h.count - mean, 2), 0);
    const stdDev = Math.sqrt(varianceSum / mapHotspots.length);
    
    // Lowered from 2 to 1 standard deviation
    const threshold = mean + (1 * stdDev);
    
    const significantHotspots = mapHotspots.filter(h => h.count >= threshold);
    
    // Safety catch so the map never goes completely blank from being too strict
    if (significantHotspots.length === 0) {
      return mapHotspots.slice(0, 5);  
    }
    
    return significantHotspots.slice(0, 20);
  }, [analytics, filteredMappedRecords, enabledOffenses, presentOffenses.length, selectedMonth]);

  // Push the current visible-map state up whenever the displayed hotspot
  // list or the in-map filters change. ChatPanel consumes this so the LLM
  // can ground 'tell me about hotspot 1 on the map' answers in the exact
  // list the user sees.
  const selectedMonthLabel =
    selectedMonth === "all"
      ? "All months"
      : availableMonths.find((m) => m.key === selectedMonth)?.label ?? selectedMonth;
  const enabledOffensesList = useMemo<string[] | null>(() => {
    if (enabledOffenses === null) return null;
    if (enabledOffenses.size === presentOffenses.length) return null;
    return [...enabledOffenses];
  }, [enabledOffenses, presentOffenses.length]);
  useEffect(() => {
    if (!onVisibleStateChange) return;
    onVisibleStateChange({
      hotspots: filteredHotspots,
      selectedMonth,
      selectedMonthLabel,
      enabledOffenses: enabledOffensesList,
      totalOffenseCategories: presentOffenses.length,
    });
  }, [
    onVisibleStateChange,
    filteredHotspots,
    selectedMonth,
    selectedMonthLabel,
    enabledOffensesList,
    presentOffenses.length,
  ]);
  const fitPoints = useMemo(
    () =>
      incidentSlice.map(
        (record) => [record.latitude as number, record.longitude as number] as [number, number]
      ),
    [incidentSlice]
  );

  // Bucket every mapped record by its hotspot grid cell so a click on a
  // hotspot circle can show ALL incidents in that cluster, not just the
  // closest one. The grid step (0.003° ≈ 330m) MUST match analytics.ts
  // createHotspotGrid so the cell keys line up.
  const recordsByHotspot = useMemo(() => {
    const HOTSPOT_GRID_STEP = 0.003;
    const mapByKey = new Map<string, CrimeRecord[]>();
    for (const record of filteredMappedRecords) {
      const lat = record.latitude as number;
      const lon = record.longitude as number;
      const cellLat = Math.round(lat / HOTSPOT_GRID_STEP) * HOTSPOT_GRID_STEP;
      const cellLon = Math.round(lon / HOTSPOT_GRID_STEP) * HOTSPOT_GRID_STEP;
      const key = `${cellLat.toFixed(3)},${cellLon.toFixed(3)}`;
      const list = mapByKey.get(key);
      if (list) list.push(record);
      else mapByKey.set(key, [record]);
    }
    // Sort each cluster newest-first so the list reads from most recent down.
    for (const list of mapByKey.values()) {
      list.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
    return mapByKey;
  }, [filteredMappedRecords]);

  return (
    <section className="panel map-panel">
      <header className="panel-header split">
        <div>
          <h2>Crime Map</h2>
          <p>Incidents and hotspot clusters across Milwaukee.</p>
        </div>

        <div className="toggle-row">
          {availableMonths.length > 1 ? (
            <select
              className="map-month-select"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              aria-label="Filter by month"
            >
              <option value="all">All months</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          ) : null}
          <label>
            <input
              type="checkbox"
              checked={showIncidents}
              onChange={(event) => setShowIncidents(event.target.checked)}
            />
            <span>Incidents</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={showHotspots}
              onChange={(event) => setShowHotspots(event.target.checked)}
            />
            <span>Hotspots</span>
          </label>
        </div>
      </header>

      {showIncidents && presentOffenses.length > 0 ? (
        <div className="map-legend" aria-label="Offense color key">
          {offenseCounts.map(([name, count]) => {
            const isOn = enabledOffenses?.has(name) ?? true;
            return (
              <button
                key={name}
                type="button"
                className={`map-legend-chip ${isOn ? "on" : "off"}`}
                aria-pressed={isOn}
                onClick={() =>
                  setEnabledOffenses((prev) => {
                    const base = prev ?? new Set(presentOffenses);
                    const next = new Set(base);
                    if (next.has(name)) {
                      next.delete(name);
                    } else {
                      next.add(name);
                    }
                    return next;
                  })
                }
              >
                <span
                  className="map-legend-dot"
                  style={{ background: isOn ? offenseColor(name) : "#94a3b8" }}
                />
                <span className="map-legend-name">{formatOffense(name)}</span>
                <span className="map-legend-count">{count.toLocaleString()}</span>
              </button>
            );
          })}
          {enabledOffenses && enabledOffenses.size !== presentOffenses.length ? (
            <button
              type="button"
              className="map-legend-reset"
              onClick={() => setEnabledOffenses(new Set(presentOffenses))}
            >
              Show all
            </button>
          ) : null}
        </div>
      ) : null}

      {selectedBubble ? (
        <div className={`selection-card ${selectedBubble.source}`}>
          <div className="selection-card-header">
            <div className="selection-card-title">
              {selectedBubble.source === "hotspot" ? (
                <Target size={14} />
              ) : (
                <MapPin size={14} />
              )}
              <span>
                {selectedBubble.source === "hotspot"
                  ? "Hotspot Cluster"
                  : "Incident Detail"}
              </span>
            </div>
            <button
              type="button"
              className="selection-close"
              onClick={() => onBubbleSelect(null)}
              aria-label="Close selection"
            >
              <X size={14} />
            </button>
          </div>

          <div className="selection-card-grid">
            <div>
              <span className="label">Offense</span>
              <span className="value">{selectedBubble.offense || "—"}</span>
            </div>
            <div>
              <span className="label">Address</span>
              <span className="value">{selectedBubble.address || "—"}</span>
            </div>
            <div>
              <span className="label">Date</span>
              <span className="value">{selectedBubble.date || "—"}</span>
            </div>
            <div>
              <span className="label">District</span>
              <span className="value">
                {selectedBubble.policeDistrict || selectedBubble.district || "—"}
              </span>
            </div>
            <div>
              <span className="label">ZIP</span>
              <span className="value">{selectedBubble.zip || "—"}</span>
            </div>
            {selectedBubble.source === "hotspot" ? (
              <>
                <div>
                  <span className="label">Cluster Size</span>
                  <span className="value">{selectedBubble.hotspotCount ?? "—"}</span>
                </div>
                <div>
                  <span className="label">Trend</span>
                  <span
                    className={`value ${
                      typeof selectedBubble.growth === "number" && selectedBubble.growth > 2
                        ? "value-up"
                        : typeof selectedBubble.growth === "number" && selectedBubble.growth < -2
                        ? "value-down"
                        : ""
                    }`}
                  >
                    {typeof selectedBubble.growth !== "number"
                      ? "—"
                      : selectedBubble.growth > 2
                      ? "Rising"
                      : selectedBubble.growth < -2
                      ? "Cooling"
                      : "Stable"}
                  </span>
                </div>
              </>
            ) : null}
          </div>
          {selectedBubble.source === "hotspot" &&
          selectedBubble.clusterRecords &&
          selectedBubble.clusterRecords.length > 0 ? (
            <div className="cluster-incidents">
              <div className="cluster-incidents-header">
                Incidents in this cluster ({selectedBubble.clusterRecords.length})
              </div>
              <ul className="cluster-incidents-list">
                {selectedBubble.clusterRecords.map((record, idx) => (
                  <li key={`${record.address}-${record.date.getTime()}-${idx}`}>
                    <span className="cluster-incidents-offense">
                      {formatOffense(record.offense)}
                    </span>
                    <span className="cluster-incidents-meta">
                      {record.address || "Unknown address"} · {record.date.toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="map-wrapper">
        <MapContainer center={center} zoom={11} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <FitToRecords points={fitPoints} />
          <FlyToFocus focus={mapFocus} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {showIncidents
            ? incidentSlice.map((record) => (
                <CircleMarker
                  key={record.id}
                  center={[record.latitude as number, record.longitude as number]}
                  radius={2.8}
                  pathOptions={{
                    color: offenseColor(record.offense),
                    fillColor: offenseColor(record.offense),
                    fillOpacity: 0.45,
                    weight: 0.5,
                  }}
                  eventHandlers={{
                    click: () => {
                      onBubbleSelect({
                        source: "incident",
                        title: "Incident point",
                        latitude: record.latitude as number,
                        longitude: record.longitude as number,
                        offense: formatOffense(record.offense),
                        address: record.address,
                        date: record.date.toLocaleString(),
                        zip: record.raw.ZIP?.trim() || "None",
                        policeDistrict: record.raw.POLICE?.trim() || "None",
                        district: record.district || "None",
                        hotspotCount: null,
                        growth: null,
                      });
                    },
                  }}
                >
                  <Popup>
                    <strong>{formatOffense(record.offense)}</strong>
                    <div>{record.date.toLocaleDateString()}</div>
                    <div>{record.address}</div>
                    <div>{record.district}</div>
                  </Popup>
                </CircleMarker>
              ))
            : null}

          {showHotspots && filteredHotspots.length > 0
            ? filteredHotspots.map((hotspot) => (
                <Circle
                  key={hotspot.key}
                  center={[hotspot.lat, hotspot.lon]}
                  radius={Math.min(360, Math.max(45, Math.sqrt(hotspot.count) * 36))}
                  pathOptions={(() => {
                    // Color matches the Rising/Cooling/Stable chip thresholds
                    // shown in the side overlay and circle popup. Keep these
                    // in sync if you ever change the dead-zone.
                    const color =
                      hotspot.growth > 2
                        ? "#ef4444" // Rising — red
                        : hotspot.growth < -2
                        ? "#3b82f6" // Cooling — blue
                        : "#64748b"; // Stable — slate
                    return {
                      color,
                      fillColor: color,
                      fillOpacity: 0.18,
                      weight: 1.2,
                    };
                  })()}
                  eventHandlers={{
                    click: () => {
                      const cluster = recordsByHotspot.get(hotspot.key) ?? [];
                      const headline = cluster[0];
                      onBubbleSelect({
                        source: "hotspot",
                        title: "Hotspot bubble",
                        latitude: hotspot.lat,
                        longitude: hotspot.lon,
                        offense: headline ? formatOffense(headline.offense) : "Unknown Offense",
                        address: headline?.address || "None",
                        date: headline ? headline.date.toLocaleString() : "None",
                        zip: headline?.raw.ZIP?.trim() || "None",
                        policeDistrict: headline?.raw.POLICE?.trim() || "None",
                        district: headline?.district || "None",
                        hotspotCount: hotspot.count,
                        growth: hotspot.growth,
                        clusterRecords: cluster,
                      });
                    },
                  }}
                >
                  <Popup>
                    <strong>Hotspot cluster</strong>
                    <div>Total incidents: {hotspot.count}</div>
                    <div>Recent 30d: {hotspot.recentCount}</div>
                    <div>Previous 30d: {hotspot.previousCount}</div>
                    <div>
                      Trend:{" "}
                      {hotspot.growth > 2
                        ? "Rising"
                        : hotspot.growth < -2
                        ? "Cooling"
                        : "Stable"}
                    </div>
                  </Popup>
                </Circle>
              ))
            : null}
        </MapContainer>
      </div>

      {mappedRecords.length === 0 ? (
        <p className="muted">No geospatial coordinates detected. Confirm latitude and longitude fields in CSV.</p>
      ) : null}
    </section>
  );
}
