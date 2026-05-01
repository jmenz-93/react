import { useMemo, useState } from "react";
import { AlertTriangle} from "lucide-react";
import { analyzeCrimeData } from "./lib/analytics";
import { parseCrimeCsv } from "./lib/csv";
import type { ApiConfig, ColumnMapping, CrimeRecord, MapBubbleSelection, MapFocus, MapVisibleState } from "./lib/types";
import { MapPanel } from "./components/MapPanel";
import { TopBar } from "./components/TopBar";
import { WorkspaceTabs } from "./components/WorkspaceTabs";

const initialApiConfig: ApiConfig = {
  apiKey: import.meta.env.VITE_OPENAI_API_KEY ?? "",
  baseUrl: import.meta.env.VITE_OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  model: import.meta.env.VITE_OPENAI_MODEL ?? "gpt-4o-mini",
};

type DetailLevel = "none" | "zip" | "district";

export function App(): JSX.Element {
  const [records, setRecords] = useState<CrimeRecord[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [ignoredRows, setIgnoredRows] = useState(0);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(initialApiConfig);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("none");
  const [detailValue, setDetailValue] = useState("None");
  const [selectedBubble, setSelectedBubble] = useState<MapBubbleSelection | null>(null);
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const [mapVisibleState, setMapVisibleState] = useState<MapVisibleState | null>(null);

  const handleUpload = async (file: File): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const parsed = await parseCrimeCsv(file);
      setRecords(parsed.records);
      setMapping(parsed.mapping);
      setWarnings(parsed.warnings);
      setIgnoredRows(parsed.ignoredRows);
      setDetailLevel("none");
      setDetailValue("None");
      setSelectedBubble(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "CSV parsing failed.");
      setRecords([]);
      setMapping(null);
      setWarnings([]);
      setIgnoredRows(0);
      setDetailLevel("none");
      setDetailValue("None");
      setSelectedBubble(null);
    } finally {
      setIsLoading(false);
    }
  };

  const zipOptions = useMemo(
    () => [...new Set(records.map((record) => record.raw.ZIP?.trim() ?? "").filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [records]
  );

  const districtOptions = useMemo(
    () =>
      [
        ...new Set(
          records
            .map((record) => {
              const policeDistrict = record.raw.POLICE?.trim();
              if (policeDistrict) {
                return policeDistrict;
              }
              return record.district.trim();
            })
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [records]
  );

  const detailOptions = useMemo(() => {
    if (detailLevel === "zip") {
      return zipOptions;
    }
    if (detailLevel === "district") {
      return districtOptions;
    }
    return [];
  }, [detailLevel, districtOptions, zipOptions]);

  const filteredRecords = useMemo(() => {
    if (detailLevel === "none" || detailValue === "None") {
      return records;
    }

    if (detailLevel === "zip") {
      return records.filter((record) => (record.raw.ZIP?.trim() ?? "") === detailValue);
    }

    if (detailLevel === "district") {
      return records.filter((record) => {
        const policeDistrict = record.raw.POLICE?.trim();
        if (policeDistrict) {
          return policeDistrict === detailValue;
        }
        return record.district.trim() === detailValue;
      });
    }

    return records;
  }, [detailLevel, detailValue, records]);

  const analytics = useMemo(() => {
    if (records.length === 0) {
      return null;
    }
    return analyzeCrimeData(filteredRecords);
  }, [filteredRecords, records.length]);

  const handleDetailLevelChange = (nextLevel: DetailLevel): void => {
    setDetailLevel(nextLevel);
    setDetailValue("None");
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <h1>Crime Intelligence Platform</h1>
        <p>
          Upload WIBR crime data to analyze trends, map hotspots, and receive AI-driven tactical recommendations.
        </p>
      </header>

      {error ? (
        <section className="error-banner">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </section>
      ) : null}

      <TopBar
        isLoading={isLoading}
        warnings={warnings}
        ignoredRows={ignoredRows}
        mapping={mapping}
        detailLevel={detailLevel}
        detailValue={detailValue}
        detailOptions={detailOptions}
        filteredCount={filteredRecords.length}
        totalCount={records.length}
        analytics={analytics}
        onDetailLevelChange={handleDetailLevelChange}
        onDetailValueChange={setDetailValue}
        onUpload={handleUpload}
      />

      <section className="grid two-up tall">
        <MapPanel
          records={filteredRecords}
          analytics={analytics}
          selectedBubble={selectedBubble}
          onBubbleSelect={setSelectedBubble}
          mapFocus={mapFocus}
          onVisibleStateChange={setMapVisibleState}
        />
        <WorkspaceTabs
          analytics={analytics}
          records={filteredRecords}
          apiConfig={apiConfig}
          onApiConfigChange={setApiConfig}
          onMapFocus={setMapFocus}
          mapVisibleState={mapVisibleState}
        />
      </section>
    </main>
  );
}
