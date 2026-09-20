import { api, PERILS, type Peril } from '@/lib/api';
import { isMetric, type MapLayer } from '@/lib/geography';
import { RiskExplorer } from '@/components/geography/RiskExplorer';

export default async function MapPage({ searchParams }: PageProps<'/map'>) {
  const params = await searchParams;
  const peril: Peril = PERILS.includes(params.peril as Peril) ? params.peril as Peril : 'all';
  const layer: MapLayer = typeof params.layer === 'string' && isMetric(params.layer) ? params.layer : 'exposure';
  const [hexes, allPins] = await Promise.all([api.mapBook(peril,5),api.mapPins()]);
  const pins = peril === 'all' ? allPins : allPins.filter(p=>p.perils?.includes(peril));
  return <RiskExplorer hexes={hexes} pins={pins} peril={peril} initialLayer={layer} initialPerspective={params.view !== 'flat'} initialSite={typeof params.site === 'string' ? params.site : undefined} highlight={typeof params.cell === 'string' ? params.cell : undefined} />;
}
