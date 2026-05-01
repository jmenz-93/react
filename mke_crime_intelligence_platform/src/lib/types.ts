export type ChatRole = "user" | "assistant";

export interface CrimeRecord {
  id: string;
  date: Date;
  year: number;
  month: number;
  monthKey: string;
  dayOfWeek: string;
  hour: number | null;
  offense: string;
  description: string;
  district: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  raw: Record<string, string>;
}

export interface ColumnMapping {
  dateColumn: string | null;
  offenseColumn: string | null;
  descriptionColumn: string | null;
  districtColumn: string | null;
  addressColumn: string | null;
  latitudeColumn: string | null;
  longitudeColumn: string | null;
  hourColumn: string | null;
}

export interface ParsedCsvResult {
  records: CrimeRecord[];
  mapping: ColumnMapping;
  warnings: string[];
  ignoredRows: number;
}

export interface MonthlyCount {
  monthKey: string;
  label: string;
  incidents: number;
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface Hotspot {
  key: string;
  lat: number;
  lon: number;
  count: number;
  recentCount: number;
  previousCount: number;
  growth: number;
}

export interface MapBubbleSelection {
  source: "incident" | "hotspot";
  title: string;
  latitude: number;
  longitude: number;
  offense: string;
  address: string;
  date: string;
  zip: string;
  policeDistrict: string;
  district: string;
  hotspotCount: number | null;
  growth: number | null;
  /** Full list of records in the cluster (only populated for source: 'hotspot'). */
  clusterRecords?: CrimeRecord[];
}

export interface CrimeAnalytics {
  totalIncidents: number;
  mappedIncidents: number;
  monthlyCounts: MonthlyCount[];
  /** Per-month rows shaped { monthKey, label, [offenseName]: count } */
  monthlyByOffense: Array<Record<string, string | number>>;
  offenseDistribution: CategoryCount[];
  districtDistribution: CategoryCount[];
  weaponDistribution: CategoryCount[];
  zipDistribution: CategoryCount[];
  wardDistribution: CategoryCount[];
  aldDistribution: CategoryCount[];
  dayOfWeekDistribution: CategoryCount[];
  hourDistribution: CategoryCount[];
  topHotspots: Hotspot[];
  topRisingAreas: Hotspot[];
  likelyNextHotspot: Hotspot | null;
  trendDirection: "up" | "down" | "flat";
  trendSlope: number;
}

export interface ApiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * Raw OpenAI chat-completions message. Stored on assistant ChatMessages so
 * the next turn can re-feed the model its prior tool_calls and tool results
 * (without these, the model loses geocoded lat/lon, filter args, etc. on
 * follow-up turns and has to guess from its visible reply text).
 */
export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
export interface OpenAIChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Suggested follow-up questions parsed out of the assistant reply. Only set on assistant messages. */
  suggestions?: string[];
  /**
   * The full sequence of OpenAI messages produced during this assistant
   * turn — including the user message that started the turn, every
   * assistant tool_calls round, and every tool result. Stored only on
   * assistant messages and replayed verbatim on the next turn so the
   * model retains visibility into its own prior tool exchange.
   */
  internalMessages?: OpenAIChatMessage[];
}

/**
 * Snapshot of what the user is currently looking at on the map. Pushed up
 * from MapPanel and threaded into the chat so the LLM can answer questions
 * like "tell me about hotspot 1 on the map" using the EXACT same hotspot
 * list the user sees, not a parallel re-computation. Includes the active
 * in-map filters (month + offense toggles) so the LLM can narrate them.
 */
export interface MapVisibleState {
  /** Hotspots currently rendered as circles on the map, in render order. */
  hotspots: Hotspot[];
  /** 'all' or a 'YYYY-MM' monthKey. */
  selectedMonth: string;
  /** Human-readable month label, e.g. 'All months' or 'Apr 26'. */
  selectedMonthLabel: string;
  /**
   * Offenses currently visible on the map. null means 'all categories on'
   * (the default — equivalent to no offense filter applied).
   */
  enabledOffenses: string[] | null;
  /** Distinct offense categories present in the underlying data. */
  totalOffenseCategories: number;
}

// Programmatic map-focus instruction emitted by the chat assistant when the
// user asks 'show me on the map' / 'zoom to this area'. Consumed by MapPanel.
export interface MapFocus {
  /** Latitude of the area centroid the user asked about. */
  lat: number;
  /** Longitude of the area centroid the user asked about. */
  lon: number;
  /** Target zoom level. ~17 for an exact address, 15 for a hotspot/cluster, 13 for a broader area. */
  zoom: number;
  /** Human-readable label for this focus (e.g. 'near 5833 N 91ST ST'). */
  label: string;
  /** Bumped on every emit so React useEffect can detect repeats. */
  nonce: number;
}
