import snapshot from '@/fixtures/property-context.json';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export type CountyMetric = 'heat' | 'flood' | 'coastal' | 'wind' | 'hurricane' | 'wildfire' | 'quake' | 'density';
export type ClimateMetric = 'temperature' | 'humidity' | 'rain';
export type GeoMetric = CountyMetric | ClimateMetric;
export type MapLayer = 'exposure' | GeoMetric;
export type County = { id: string; name: string; state: string; population: number | null; version: string } & Record<CountyMetric, number | null>;
export type CountyGeoJSON = FeatureCollection<Polygon | MultiPolygon, County>;
export type Climate = Record<ClimateMetric, (number | null)[]> & { annualTemperature: number | null; annualHumidity: number | null; annualRain: number | null; period: string; source: string };
export type SiteContext = { caseId: string; lat: number; lng: number; countyId: string | null; climate: Climate | null; errors: string[] };
export const context = snapshot as { retrievedAt: string; countyCount: number; coverage: string; source: string; versions: string[]; counties: County[]; sites: SiteContext[] };
export const counties = new Map(context.counties.map(c => [c.id, c]));
export const sites = new Map(context.sites.map(s => [s.caseId, s]));
const warm = ['#332b22', '#725132', '#b07a3f', '#df9c49', '#ffcc79'];
const cool = ['#1a303b', '#28576b', '#378394', '#70b4c0', '#bee1df'];
export const METRICS: Record<GeoMetric, { label: string; unit: string; stops: number[]; colors: string[]; source: string; note: string }> = {
  heat: { label: 'Heat waves', unit: 'event-days / year', stops: [0,1,3,7,14], colors: warm, source: 'FEMA NRI', note: 'County annualized heat-wave frequency. A prompt to review cooling and business-interruption resilience.' },
  flood: { label: 'Inland flood', unit: '$ / $1M building value / year', stops: [0,10,100,500,2000], colors: cool, source: 'FEMA NRI', note: 'Inland flood building loss. County context; check the site flood zone separately.' },
  wind: { label: 'Strong wind', unit: '$ / $1M building value / year', stops: [0,10,100,500,2000], colors: warm, source: 'FEMA NRI', note: 'Strong-wind building loss. Review roof, openings and wind protections.' },
  coastal: { label: 'Coastal flood', unit: '$ / $1M building value / year', stops: [0,10,100,500,2000], colors: cool, source: 'FEMA NRI', note: 'Coastal flood building loss. Areas without a reported value remain unshaded; they are not assigned zero loss.' },
  hurricane: { label: 'Hurricane', unit: '$ / $1M building value / year', stops: [0,10,100,500,2000], colors: warm, source: 'FEMA NRI', note: 'Hurricane building loss. Review local wind and storm-surge evidence for the site.' },
  wildfire: { label: 'Wildfire', unit: '$ / $1M building value / year', stops: [0,10,100,500,2000], colors: warm, source: 'FEMA NRI', note: 'County building loss estimate. Review site vegetation, defensible space and construction.' },
  quake: { label: 'Earthquake', unit: '$ / $1M building value / year', stops: [0,10,100,500,2000], colors: warm, source: 'FEMA NRI', note: 'County building loss estimate. Review structural system and retrofit evidence.' },
  density: { label: 'Population density', unit: 'people / sq mi', stops: [0,25,100,1000,10000], colors: cool, source: 'FEMA NRI · 2020 population', note: 'Population divided by county area. Geographic context only; it is not a crime measure or an appetite factor.' },
  temperature: { label: 'Temperature', unit: '°C annual mean', stops: [-10,0,10,20,30], colors: warm, source: 'NASA POWER · 2001–2020', note: 'Gridded climate estimate at each cached submission location, not a current reading or a heat-wave forecast.' },
  humidity: { label: 'Humidity', unit: '% annual mean', stops: [0,40,60,75,90], colors: cool, source: 'NASA POWER · 2001–2020', note: 'Outdoor relative humidity from a climate grid. Review moisture controls; this does not measure indoor dampness or mould.' },
  rain: { label: 'Rainfall', unit: 'mm / day annual mean', stops: [0,1,2,4,8], colors: cool, source: 'NASA POWER · 2001–2020', note: 'Mean precipitation from a climate grid. Review drainage; this is not flood depth or a storm forecast.' },
};
export const isClimate = (metric: MapLayer): metric is ClimateMetric => ['temperature','humidity','rain'].includes(metric);
export const isMetric = (metric: string): metric is GeoMetric => metric in METRICS;
export function siteValue(site: SiteContext | undefined, metric: GeoMetric): number | null {
  if (!site) return null;
  if (!isClimate(metric)) return counties.get(site.countyId ?? '')?.[metric] ?? null;
  const key = { temperature:'annualTemperature', humidity:'annualHumidity', rain:'annualRain' } as const;
  return site.climate?.[key[metric]] ?? null;
}
export const geoValue = (value: number | null | undefined) => value == null ? 'No data' : value.toLocaleString('en-US', { maximumFractionDigits: 1 });
export function metricColor(metric: GeoMetric, value: number | null | undefined): [number,number,number,number] {
  if (value == null || !Number.isFinite(value)) return [72,79,84,165];
  const m = METRICS[metric]; const index = m.stops.reduce((last,stop,i) => value >= stop ? i : last,0);
  const hex=m.colors[index]; return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),205];
}
