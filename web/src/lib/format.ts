// Turns the engine's machine strings into plain copy. Numbers are parsed from the text, never invented.

const PERIL_NAME: Record<string, string> = {
  wind_and_rain: "Wind and rain",
  flood: "Flood",
  geocode_check: "Address check",
  earthquake: "Earthquake",
  wildfire: "Wildfire",
  usgs_earthquakes: "Earthquake",
  usfs_wildfire: "Wildfire",
  open_meteo: "Wind and rain",
  fema_flood: "Flood",
  nominatim: "Address check",
};

export const humanize = (s: string) => {
  const t = s.replaceAll("_", " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const perilName = (key: string) => PERIL_NAME[key] ?? humanize(key);

const SOURCES: [RegExp, string][] = [
  [/fema|arcgis|esri/i, "FEMA via Esri"],
  [/open-meteo/i, "Open-Meteo"],
  [/usgs/i, "USGS"],
  [/usfs|wildfire/i, "USFS"],
  [/nominatim|openstreetmap/i, "OpenStreetMap"],
  [/torontopolice|tps/i, "Toronto Police"],
  [/toronto\.ca/i, "City of Toronto"],
];

/** Short label for a source URL or dataset name; falls back to the URL's host. */
export function sourceLabel(src: string): string {
  for (const [re, name] of SOURCES) if (re.test(src)) return name;
  try {
    return new URL(src).hostname.replace(/^www\./, "");
  } catch {
    return src;
  }
}

export type HazardLine = { peril: string; sentence: string; multiplier?: number; points?: number };

/** "flood: outside FEMA mapped flood hazard areas (x0.97, +2.0 pts)" -> parts. */
export function parseHazard(line: string, peril?: string): HazardLine {
  const m = line.match(/^\s*([a-z_]+):\s*(.*?)\s*(?:\(x([\d.]+),\s*([+-]?[\d.]+)\s*pts\))?\s*$/i);
  if (!m) return { peril: perilName(peril ?? ""), sentence: line };
  const sentence = m[2].charAt(0).toUpperCase() + m[2].slice(1);
  return {
    peril: perilName(peril ?? m[1]),
    sentence: sentence.replace(/^(\d+) days/, (_, n) => (n === "1" ? "1 day" : `${n} days`)).replace(/\b1 days\b/g, "1 day"),
    multiplier: m[3] ? Number(m[3]) : undefined,
    points: m[4] ? Number(m[4]) : undefined,
  };
}

/** "Skipped usgs_earthquakes: Earthquake is not an explicit site hazard tag." -> name + reason. */
export function parseSkip(key: string, why: string) {
  const reason = why.replace(/^Skipped [a-z_]+:\s*/i, "").replace(/\.$/, "");
  return { peril: perilName(key), reason: reason.charAt(0).toLowerCase() + reason.slice(1) };
}

export const signed = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(digits)}`;

/** Factor valueText like "{'Masonry Non-Combustible': 1.0} (TIV share over 1 buildings)" -> "Masonry non-combustible 100%". */
export function factorValue(fact: string, raw: string): string {
  let v = raw.replace(/\s*\([^()]*\)\s*$/, "").trim();
  const dict = v.match(/^\{(.*)\}$/);
  if (dict)
    v = dict[1]
      .split(/,\s*(?=')/)
      .map((pair) => {
        const [, k = "", share = ""] = pair.match(/'([^']+)':\s*([\d.]+)/) ?? [];
        return k ? `${k} ${Math.round(Number(share) * 100)}%` : pair;
      })
      .join(", ");
  if (fact.includes("year")) v = v.replace(/^\$/, "").replace(/,/g, "");
  return v.replace(/\bnew-new\b/, "new").replace(/\best\.?$/, "est.");
}

/** "premium:not_acceptable" -> "premium, not acceptable". */
export const bandPhrase = (s: string) => {
  const [fact, band] = s.split(":");
  return band ? `${fact.replaceAll("_", " ")}, ${band.replaceAll("_", " ")}` : s;
};

/** The API stamps actions with epoch seconds as a string. */
export function whenLabel(at: string): string {
  const secs = Number(at);
  if (!Number.isFinite(secs)) return at;
  return new Date(secs * 1000).toLocaleString("en-CA", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
}

/** Replaces "premium:not_acceptable" inside a sentence with "premium not acceptable". */
export const prettyBands = (s: string) =>
  s.replace(/\b([a-z_]+):(target|acceptable|not_acceptable)\b/g, (_, f, b) => `${f.replaceAll("_", " ")} ${b.replaceAll("_", " ")}`);
