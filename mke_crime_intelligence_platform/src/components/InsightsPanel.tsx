import { useEffect, useState, type CSSProperties } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatHour, formatOffense } from "../lib/format";
import type { CrimeAnalytics, CrimeRecord } from "../lib/types";
import { TrendChart } from "./TrendChart";

interface InsightsPanelProps {
  analytics: CrimeAnalytics | null;
  records: CrimeRecord[];
}

type ChartKey = "monthly" | "offenses" | "day" | "hour";

const CHART_OPTIONS: Array<{ key: ChartKey; label: string; description: string }> = [
  { key: "monthly", label: "Monthly", description: "Stacked by offense category" },
  { key: "offenses", label: "Offenses", description: "Top categories overall" },
  { key: "day", label: "Day of Week", description: "Distribution by weekday" },
  { key: "hour", label: "Time of Day", description: "Hour-by-hour incident curve" },
];

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
  "Unknown Offense": "#64748b",
};

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function offenseColor(name: string): string {
  return OFFENSE_COLORS[name] ?? "#334155";
}

/**
 * Trends view rendered inside the right-column workspace tabs. A segmented
 * selector at the top lets the user pick which chart to view; only one chart
 * is shown at a time so each gets full vertical space.
 */
export function InsightsPanel({ analytics, records }: Readonly<InsightsPanelProps>): JSX.Element {
  const [active, setActive] = useState<ChartKey>("monthly");

  if (!analytics) {
    return (
      <div className="trends-empty">
        <p>Upload a CSV to see trend breakdowns.</p>
      </div>
    );
  }

  const activeOption = CHART_OPTIONS.find((o) => o.key === active) ?? CHART_OPTIONS[0];

  return (
    <div className="trends-body">
      <div className="trends-selector" role="tablist" aria-label="Trend chart">
        {CHART_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active === option.key}
            className={`trends-segment ${active === option.key ? "active" : ""}`}
            onClick={() => setActive(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <p className="trends-description">{activeOption.description}</p>

      <div className="trends-chart-wrapper">
        {active === "monthly" ? <MonthlyView analytics={analytics} /> : null}

        {active === "offenses" ? <OffenseBars analytics={analytics} /> : null}

        {active === "day" ? (
          <DayRibbon records={records.filter((r) => r.offense !== "LockedVehicle")} />
        ) : null}

        {active === "hour" ? (
          <HourCurve records={records.filter((r) => r.offense !== "LockedVehicle")} />
        ) : null}
      </div>
    </div>
  );
}

function MonthlyView({ analytics }: { analytics: CrimeAnalytics }): JSX.Element {
  // Available categories (only those that actually appear in the data)
  const totals = new Map<string, number>();
  for (const row of analytics.monthlyByOffense) {
    for (const [key, value] of Object.entries(row)) {
      if (key === "monthKey" || key === "label") continue;
      if (typeof value === "number" && value > 0) {
        totals.set(key, (totals.get(key) ?? 0) + value);
      }
    }
  }
  const available = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(available));

  // Re-sync enabled set when the underlying categories change (e.g. when the
  // upstream area filter wipes some categories from the dataset). Using a
  // serialised key as the dependency avoids referential-equality misses.
  const availableKey = available.join("|");
  useEffect(() => {
    setEnabled((prev) => {
      // If user has deliberately deselected everything, leave it empty.
      if (prev.size === 0) return prev;
      const stillValid = [...prev].filter((name) => available.includes(name));
      if (stillValid.length === prev.size) return prev;
      // Some previously-enabled categories no longer exist; trim them. Only
      // refill to 'all' if every category they had selected disappeared.
      return new Set(stillValid.length > 0 ? stillValid : available);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableKey]);

  const toggle = (name: string): void => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Filtered data — keep only the columns the user has enabled.
  const filtered = analytics.monthlyByOffense.map((row) => {
    const next: Record<string, string | number> = {
      monthKey: row.monthKey,
      label: row.label,
    };
    for (const name of available) {
      if (enabled.has(name)) next[name] = row[name] ?? 0;
    }
    return next;
  });

  return (
    <>
      <div className="category-toggles" role="group" aria-label="Categories">
        {available.map((name) => {
          const isOn = enabled.has(name);
          const color = offenseColor(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              className={`category-chip ${isOn ? "on" : "off"}`}
              aria-pressed={isOn}
              style={
                isOn
                  ? ({ "--chip-color": color } as CSSProperties)
                  : undefined
              }
            >
              <span className="category-dot" style={{ background: color }} />
              {formatOffense(name)}
            </button>
          );
        })}
        {enabled.size !== available.length ? (
          <button
            type="button"
            className="category-toggles-reset"
            onClick={() => setEnabled(new Set(available))}
          >
            Show all
          </button>
        ) : null}
      </div>

      <TrendChart data={filtered} />
    </>
  );
}

function OffenseBars({ analytics }: { analytics: CrimeAnalytics }): JSX.Element {
  const offenseTop = analytics.offenseDistribution.slice(0, 8);
  const maxOffenseCount = offenseTop[0]?.count ?? 1;

  return (
    <ul className="offense-bars">
      {offenseTop.map((entry) => {
        const color = offenseColor(entry.name);
        const pct = (entry.count / maxOffenseCount) * 100;
        return (
          <li key={entry.name}>
            <div className="offense-bars-row">
              <span className="offense-name">{formatOffense(entry.name)}</span>
              <span className="offense-count">{entry.count.toLocaleString()}</span>
            </div>
            <div className="offense-track">
              <div
                className="offense-fill"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Shared category-chip control. Mirrors the Monthly view so users learn the
 * pattern once and recognize it across day-of-week and time-of-day.
 */
function CategoryToggles({
  available,
  enabled,
  onToggle,
  onShowAll,
}: Readonly<{
  available: string[];
  enabled: Set<string>;
  onToggle: (name: string) => void;
  onShowAll: () => void;
}>): JSX.Element {
  return (
    <div className="category-toggles" role="group" aria-label="Categories">
      {available.map((name) => {
        const isOn = enabled.has(name);
        const color = offenseColor(name);
        return (
          <button
            key={name}
            type="button"
            onClick={() => onToggle(name)}
            className={`category-chip ${isOn ? "on" : "off"}`}
            aria-pressed={isOn}
            style={isOn ? ({ "--chip-color": color } as CSSProperties) : undefined}
          >
            <span className="category-dot" style={{ background: color }} />
            {formatOffense(name)}
          </button>
        );
      })}
      {enabled.size !== available.length ? (
        <button
          type="button"
          className="category-toggles-reset"
          onClick={onShowAll}
        >
          Show all
        </button>
      ) : null}
    </div>
  );
}

/**
 * Hook that derives the set of offense categories present in the supplied
 * records, manages a 'currently enabled' set, and re-syncs when categories
 * appear/disappear (e.g. upstream area filter change). Same behavior as the
 * Monthly view's category state — extracted so day/hour views share it.
 */
function useFilteredCategories(records: CrimeRecord[]): {
  available: string[];
  enabled: Set<string>;
  toggle: (name: string) => void;
  reset: () => void;
} {
  const totals = new Map<string, number>();
  for (const r of records) {
    totals.set(r.offense, (totals.get(r.offense) ?? 0) + 1);
  }
  const available = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(available));
  const availableKey = available.join("|");
  useEffect(() => {
    setEnabled((prev) => {
      if (prev.size === 0) return prev;
      const stillValid = [...prev].filter((name) => available.includes(name));
      if (stillValid.length === prev.size) return prev;
      return new Set(stillValid.length > 0 ? stillValid : available);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableKey]);

  const toggle = (name: string): void => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const reset = (): void => setEnabled(new Set(available));

  return { available, enabled, toggle, reset };
}

function DayRibbon({ records }: { records: CrimeRecord[] }): JSX.Element {
  const { available, enabled, toggle, reset } = useFilteredCategories(records);

  // Per-day per-category counts. Sort categories by overall volume so the
  // dominant ones sit at the bottom of each stack (read first from the base).
  const totalsByCat = new Map<string, number>();
  for (const r of records) {
    if (!enabled.has(r.offense)) continue;
    totalsByCat.set(r.offense, (totalsByCat.get(r.offense) ?? 0) + 1);
  }
  const stackedKeys = [...totalsByCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  // Build per-day breakdown: { day, total, segs: [{ name, count }] }
  const days = DAY_ORDER.map((day) => {
    const segs: Array<{ name: string; count: number }> = [];
    let total = 0;
    for (const name of stackedKeys) {
      const count = records.filter(
        (r) => r.dayOfWeek === day && r.offense === name && enabled.has(r.offense),
      ).length;
      if (count > 0) segs.push({ name, count });
      total += count;
    }
    return { day, total, segs };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  return (
    <>
      <CategoryToggles
        available={available}
        enabled={enabled}
        onToggle={toggle}
        onShowAll={reset}
      />
      <div className="day-ribbon tall">
        {days.map((d) => {
          const pct = (d.total / maxDay) * 100;
          return (
            <div key={d.day} className="day-cell">
              <div
                className="day-bar stacked"
                style={{ height: `${Math.max(6, pct)}%` }}
              >
                {/* Render bottom-up: largest category at the bottom of the
                    stack. flex-direction: column-reverse on .day-bar.stacked
                    handles ordering; we just emit in stack order. */}
                {d.segs.map((s) => {
                  const segPct = (s.count / d.total) * 100;
                  return (
                    <div
                      key={s.name}
                      className="day-bar-seg"
                      style={{
                        height: `${segPct}%`,
                        background: offenseColor(s.name),
                      }}
                    />
                  );
                })}
              </div>
              <span className="day-label">{d.day}</span>
              <span className="day-count">{d.total.toLocaleString()}</span>
              {/* Hover popover tooltip — matches the monthly chart styling.
                  CSS shows it via .day-cell:hover .day-tooltip. */}
              {d.segs.length > 0 ? (
                <div className="day-tooltip trend-tooltip" role="tooltip">
                  <div className="trend-tooltip-label">{d.day}</div>
                  <ul className="trend-tooltip-rows">
                    {d.segs.map((s) => (
                      <li key={s.name}>
                        <span
                          className="trend-tooltip-dot"
                          style={{ background: offenseColor(s.name) }}
                        />
                        <span className="trend-tooltip-name">{formatOffense(s.name)}</span>
                        <span className="trend-tooltip-value">{s.count.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="trend-tooltip-total">
                    <span>Total</span>
                    <span className="trend-tooltip-total-value">{d.total.toLocaleString()}</span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

interface HourTooltipPayloadItem {
  name: string;
  value: number;
  color?: string;
  dataKey?: string;
}

interface HourTooltipProps {
  active?: boolean;
  payload?: HourTooltipPayloadItem[];
  label?: string;
}

/**
 * Custom tooltip for the time-of-day chart. Reuses the same .trend-tooltip
 * CSS as the monthly and day-of-week charts so all three views feel like one
 * consistent product. Filters out zero-value rows (categories that have no
 * incidents at this hour) so the popover stays tight.
 */
function HourTooltip({ active, payload, label }: HourTooltipProps): JSX.Element | null {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.filter((item) => typeof item.value === "number" && item.value > 0);
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  const isSingleTotal = rows.length === 1 && (rows[0].dataKey === "count" || rows[0].name === "Incidents");
  return (
    <div className="trend-tooltip">
      <div className="trend-tooltip-label">{label}</div>
      <ul className="trend-tooltip-rows">
        {rows.map((item) => (
          <li key={item.dataKey ?? item.name}>
            <span
              className="trend-tooltip-dot"
              style={{ background: item.color ?? "#3b82f6" }}
            />
            <span className="trend-tooltip-name">
              {item.dataKey === "count" ? "Incidents" : formatOffense(item.dataKey ?? item.name)}
            </span>
            <span className="trend-tooltip-value">{item.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      {!isSingleTotal ? (
        <div className="trend-tooltip-total">
          <span>Total</span>
          <span className="trend-tooltip-total-value">{total.toLocaleString()}</span>
        </div>
      ) : null}
    </div>
  );
}

function HourCurve({ records }: { records: CrimeRecord[] }): JSX.Element {
  const { available, enabled, toggle, reset } = useFilteredCategories(records);

  // When every category is enabled, render a single blue total curve. When a
  // subset is selected, render one colored line per selected category so the
  // user can compare category-specific time-of-day shapes.
  const showSingleTotal = enabled.size === available.length;
  const enabledList = available.filter((name) => enabled.has(name));

  // Per-hour, per-category counts. Skip records with hour === null (date-only
  // entries with no time component).
  const data = Array.from({ length: 24 }, (_, hour) => {
    const row: Record<string, string | number> = {
      hour,
      label: formatHour(hour),
      count: 0,
    };
    for (const name of enabledList) row[name] = 0;
    return row;
  });
  for (const r of records) {
    if (!enabled.has(r.offense)) continue;
    if (r.hour === null) continue;
    const row = data[r.hour];
    row.count = (row.count as number) + 1;
    row[r.offense] = (row[r.offense] as number) + 1;
  }

  return (
    <>
      <CategoryToggles
        available={available}
        enabled={enabled}
        onToggle={toggle}
        onShowAll={reset}
      />
      <div className="chart-box tall">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="hourFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
              {enabledList.map((name) => {
                const color = offenseColor(name);
                return (
                  <linearGradient
                    key={name}
                    id={`hourFill-${name}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.04} />
                  </linearGradient>
                );
              })}
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 11 }}
              interval={2}
              tickLine={false}
              axisLine={{ stroke: "rgba(15,23,42,0.08)" }}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip
              cursor={{ stroke: "rgba(59,130,246,0.18)", strokeWidth: 2 }}
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ outline: "none", zIndex: 10 }}
              content={<HourTooltip />}
            />
            {showSingleTotal ? (
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#hourFill)"
                name="Incidents"
              />
            ) : (
              enabledList.map((name) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={offenseColor(name)}
                  strokeWidth={2}
                  fill={`url(#hourFill-${name})`}
                  name={formatOffense(name)}
                />
              ))
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
