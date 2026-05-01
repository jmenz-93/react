import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatOffense } from "../lib/format";

interface TrendChartProps {
  /**
   * Per-month rows like { monthKey, label, AssaultOffense: 12, Theft: 8, ... }.
   * Each non-meta key is treated as an offense category and rendered as a
   * stacked area in the chart.
   */
  data: Array<Record<string, string | number>>;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function MonthlyTooltip({ active, payload, label }: CustomTooltipProps): JSX.Element | null {
  if (!active || !payload || payload.length === 0) return null;
  // Recharts hands us one payload entry per stacked series. Their values are
  // the per-category counts for the hovered month — sum them for the total.
  const total = payload.reduce(
    (sum, item) => sum + (typeof item.value === "number" ? item.value : 0),
    0,
  );
  return (
    <div className="trend-tooltip">
      <div className="trend-tooltip-label">{label}</div>
      <ul className="trend-tooltip-rows">
        {payload.map((item) => (
          <li key={item.name}>
            <span
              className="trend-tooltip-dot"
              style={{ background: item.color ?? "#94a3b8" }}
            />
            <span className="trend-tooltip-name">{formatOffense(item.name)}</span>
            <span className="trend-tooltip-value">{item.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <div className="trend-tooltip-total">
        <span>Total</span>
        <span className="trend-tooltip-total-value">{total.toLocaleString()}</span>
      </div>
    </div>
  );
}

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
const META_KEYS = new Set(["monthKey", "label", "incidents"]);
const FALLBACK = "#334155";

function offenseColor(name: string): string {
  return OFFENSE_COLORS[name] ?? FALLBACK;
}

export function TrendChart({ data }: TrendChartProps): JSX.Element {
  if (data.length === 0) {
    return <p className="muted">No monthly series available yet.</p>;
  }

  // Determine which offense categories appear at least once across the dataset
  // and sort them by total volume (largest at the bottom of the stack so the
  // big drivers are read first).
  const totals = new Map<string, number>();
  for (const row of data) {
    for (const [key, value] of Object.entries(row)) {
      if (META_KEYS.has(key) || typeof value !== "number") continue;
      totals.set(key, (totals.get(key) ?? 0) + value);
    }
  }
  const categories = [...totals.entries()]
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <defs>
            {categories.map((name) => {
              const color = offenseColor(name);
              return (
                <linearGradient key={name} id={`grad-${name}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.45} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid stroke="rgba(15,23,42,0.05)" strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(15,23,42,0.08)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: "rgba(59,130,246,0.18)", strokeWidth: 2 }}
            content={<MonthlyTooltip />}
          />
          {categories.map((name) => (
            <Area
              key={name}
              type="monotone"
              dataKey={name}
              stackId="offenses"
              stroke={offenseColor(name)}
              strokeWidth={1}
              fill={`url(#grad-${name})`}
              isAnimationActive
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
