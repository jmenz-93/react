/**
 * Formatting utilities for displaying WIBR data fields in the UI.
 */

/**
 * Convert a CamelCase WIBR offense category (e.g. "VehicleTheft") into a
 * human-readable label with spaces (e.g. "Vehicle Theft"). Already-spaced
 * labels (e.g. "Unknown Offense") are returned unchanged.
 */
export function formatOffense(name: string): string {
  if (!name) return name;
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convert a 24-hour clock value (0-23) into a friendly 12-hour label like
 * "12am", "9am", "1pm", "11pm". Returns the raw value if out of range.
 */
export function formatHour(hour: number): string {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return String(hour);
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}
