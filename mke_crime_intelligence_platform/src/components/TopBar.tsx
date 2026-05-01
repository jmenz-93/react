import { ArrowUpRight, ArrowDownRight, Minus, Upload, AlertTriangle } from "lucide-react";
import { formatHour } from "../lib/format";
import type { ColumnMapping, CrimeAnalytics } from "../lib/types";

type DetailLevel = "none" | "zip" | "district";

interface TopBarProps {
  isLoading: boolean;
  warnings: string[];
  ignoredRows: number;
  mapping: ColumnMapping | null;
  detailLevel: DetailLevel;
  detailValue: string;
  detailOptions: string[];
  filteredCount: number;
  totalCount: number;
  analytics: CrimeAnalytics | null;
  onDetailLevelChange: (level: DetailLevel) => void;
  onDetailValueChange: (value: string) => void;
  onUpload: (file: File) => void;
}

function recentChangePct(monthly: CrimeAnalytics["monthlyCounts"]): {
  pct: number | null;
  direction: "up" | "down" | "flat";
} {
  if (monthly.length < 2) return { pct: null, direction: "flat" };
  const last = monthly[monthly.length - 1].incidents;
  const prev = monthly[monthly.length - 2].incidents;
  if (prev === 0) return { pct: null, direction: "flat" };
  const pct = ((last - prev) / prev) * 100;
  const direction = pct > 2 ? "up" : pct < -2 ? "down" : "flat";
  return { pct, direction };
}

/**
 * Single slim control bar that replaces the previous Upload + KpiStrip + Insights
 * stack. Holds the upload button, area filters, filtered/total count, and the
 * four headline metrics inline so users see everything without scrolling.
 */
export function TopBar(props: Readonly<TopBarProps>): JSX.Element {
  const {
    isLoading, warnings, ignoredRows, mapping,
    detailLevel, detailValue, detailOptions,
    filteredCount, totalCount, analytics,
    onDetailLevelChange, onDetailValueChange, onUpload,
  } = props;

  const peakHour = analytics
    ? [...analytics.hourDistribution].sort((a, b) => b.count - a.count)[0]
    : null;
  const peakHourLabel =
    peakHour && peakHour.count > 0 ? formatHour(Number(peakHour.name)) : "—";
  const peakDay = analytics
    ? [...analytics.dayOfWeekDistribution].sort((a, b) => b.count - a.count)[0]?.name ?? "—"
    : "—";
  const change = analytics ? recentChangePct(analytics.monthlyCounts) : { pct: null, direction: "flat" as const };

  const ChangeIcon =
    change.direction === "up" ? ArrowUpRight :
    change.direction === "down" ? ArrowDownRight : Minus;

  return (
    <>
      <section className="topbar">
        <label className="topbar-upload">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
            }}
            disabled={isLoading}
          />
          <Upload size={14} />
          <span>{isLoading ? "Parsing…" : mapping ? "Replace CSV" : "Upload CSV"}</span>
        </label>

        {mapping ? (
          <>
            <div className="topbar-filters">
              <select
                value={detailLevel}
                onChange={(event) => onDetailLevelChange(event.target.value as DetailLevel)}
                aria-label="Filter by"
              >
                <option value="none">All areas</option>
                <option value="zip">ZIP Code</option>
                <option value="district">Police District</option>
              </select>
              {detailLevel !== "none" ? (
                <select
                  value={detailValue}
                  onChange={(event) => onDetailValueChange(event.target.value)}
                  aria-label="Selection"
                >
                  <option value="None">—</option>
                  {detailOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="topbar-divider" aria-hidden />

            <div className="topbar-metrics">
              <div className="metric">
                <span className="metric-label">Incidents</span>
                <span className="metric-value">
                  {filteredCount.toLocaleString()}
                  {filteredCount !== totalCount ? (
                    <span className="metric-sub"> / {totalCount.toLocaleString()}</span>
                  ) : null}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Peak Hour</span>
                <span className="metric-value">{peakHourLabel}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Peak Day</span>
                <span className="metric-value">{peakDay}</span>
              </div>
              <div className={`metric metric-change ${change.direction}`}>
                <span className="metric-label">MoM</span>
                <span className="metric-value">
                  <ChangeIcon size={14} strokeWidth={2.5} />
                  {change.pct === null
                    ? "—"
                    : `${change.pct >= 0 ? "+" : ""}${change.pct.toFixed(1)}%`}
                </span>
              </div>
            </div>
          </>
        ) : (
          <span className="topbar-hint">
            Upload a WIBR CSV to populate the map, charts, and AI assistant.
          </span>
        )}
      </section>

      {(warnings.length > 0 || ignoredRows > 0) && mapping ? (
        <p className="topbar-note">
          <AlertTriangle size={12} />
          {ignoredRows > 0 ? `${ignoredRows} rows skipped (invalid dates). ` : ""}
          {warnings.join(" · ")}
        </p>
      ) : null}
    </>
  );
}
