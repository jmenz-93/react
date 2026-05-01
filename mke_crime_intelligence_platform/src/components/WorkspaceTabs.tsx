import { useState } from "react";
import { BarChart3, MessageSquare } from "lucide-react";
import type { ApiConfig, CrimeAnalytics, CrimeRecord, MapFocus, MapVisibleState } from "../lib/types";
import { ChatPanel } from "./ChatPanel";
import { InsightsPanel } from "./InsightsPanel";

type Tab = "chat" | "trends";

interface WorkspaceTabsProps {
  analytics: CrimeAnalytics | null;
  records: CrimeRecord[];
  apiConfig: ApiConfig;
  onApiConfigChange: (config: ApiConfig) => void;
  onMapFocus: (focus: MapFocus) => void;
  /** Latest snapshot of the map's hotspot list + in-map filters. */
  mapVisibleState: MapVisibleState | null;
}

/**
 * Right-column workspace that toggles between Chat and Trends. Map remains
 * the spatial anchor on the left; this column lets the user switch between
 * asking the AI questions and inspecting trend visualizations without losing
 * the map context.
 */
export function WorkspaceTabs(props: Readonly<WorkspaceTabsProps>): JSX.Element {
  const { analytics, records, apiConfig, onApiConfigChange, onMapFocus } = props;
  const [active, setActive] = useState<Tab>("chat");

  return (
    <section className="panel workspace-panel">
      <div className="workspace-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={active === "chat"}
          className={`workspace-tab ${active === "chat" ? "active" : ""}`}
          onClick={() => setActive("chat")}
        >
          <MessageSquare size={14} />
          <span>Assistant</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === "trends"}
          className={`workspace-tab ${active === "trends" ? "active" : ""}`}
          onClick={() => setActive("trends")}
        >
          <BarChart3 size={14} />
          <span>Trends</span>
        </button>
      </div>

      <div className="workspace-body">
        {active === "chat" ? (
          <ChatPanel
            analytics={analytics}
            records={records}
            apiConfig={apiConfig}
            onApiConfigChange={onApiConfigChange}
            onMapFocus={onMapFocus}
            embedded
          />
        ) : (
          <InsightsPanel analytics={analytics} records={records} />
        )}
      </div>
    </section>
  );
}
