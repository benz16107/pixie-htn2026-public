"use client";
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { LiveMap } from '@/components/LiveMap';
import { money, DecisionChip } from '@/components/bits';
import type { Pin } from '@/components/BookMap';
import type { Hex, DecisionView } from '@/contract';
import { PERILS, type Peril } from '@/lib/api';
import { context, counties, sites, METRICS, isClimate, siteValue, geoValue, type MapLayer, type CountyGeoJSON } from '@/lib/geography';
import { CountyProfile, ClimateChart } from './ContextCharts';
import styles from './Geography.module.css';

export function RiskExplorer({hexes,pins,peril,initialLayer,initialPerspective,initialSite,highlight}: {hexes:Hex[];pins:Pin[];peril:Peril;initialLayer:MapLayer;initialPerspective:boolean;initialSite?:string;highlight?:string}) {
  const [layer,setLayer]=useState<MapLayer>(initialLayer);
  const [perspective,setPerspective]=useState(initialPerspective);
  const [showExposure,setShowExposure]=useState(false);
  const [selectedSite,setSelectedSite]=useState(initialSite);
  const [selectedCounty,setSelectedCounty]=useState<string|undefined>(sites.get(initialSite ?? '')?.countyId ?? undefined);
  const [countyData,setCountyData]=useState<CountyGeoJSON>();
  const [loadError,setLoadError]=useState(false);
  const [query,setQuery]=useState('');
  const metric=layer==='exposure'?null:METRICS[layer];
  const county=selectedCounty?counties.get(selectedCounty):undefined;
  const site=selectedSite?sites.get(selectedSite):undefined;
  const pin=pins.find(p=>p.caseId===selectedSite);
  const total=hexes.reduce((sum,h)=>sum+h.value,0);
  const countyLayer=layer!=='exposure'&&!isClimate(layer);
  useEffect(()=>{
    if (!countyLayer || countyData) return;
    const controller=new AbortController();
    fetch('/geography/counties.geojson',{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('county cache unavailable');return r.json();}).then(setCountyData).catch(e=>{if(e.name!=='AbortError')setLoadError(true);});
    return ()=>controller.abort();
  },[countyLayer,countyData]);
  const chooseSite=useCallback((id:string)=>{setSelectedSite(id);setSelectedCounty(sites.get(id)?.countyId??undefined);},[]);
  const chooseCounty=useCallback((id:string)=>{setSelectedCounty(id);setSelectedSite(undefined);setQuery('');},[]);
  const href=(nextPeril:Peril,cell?:string)=>{
    const q=new URLSearchParams();if(nextPeril!=='all')q.set('peril',nextPeril);if(layer!=='exposure')q.set('layer',layer);if(!perspective)q.set('view','flat');if(cell)q.set('cell',cell);return '/map'+(q.size?'?'+q:'');
  };
  const changeLayer=(next:MapLayer)=>{setLayer(next);const url=new URL(window.location.href);if(next==='exposure')url.searchParams.delete('layer');else url.searchParams.set('layer',next);window.history.replaceState(null,'',url);};
  const matches=query.trim().length>=2?context.counties.filter(c=>`${c.name} ${c.state}`.toLowerCase().includes(query.toLowerCase())).slice(0,8):[];
  const concentrations=[...hexes].sort((a,b)=>b.value-a.value).slice(0,5);
  const coverage=layer==='exposure'?pins.length:isClimate(layer)?pins.filter(p=>siteValue(sites.get(p.caseId),layer)!==null).length:context.counties.filter(c=>c[layer]!==null).length;
  return <main className={styles.explorer}>
    <div className={styles.map}>
      <LiveMap hexes={hexes} pins={pins} center={[-99,37]} zoom={3.5} perspective={layer==='exposure'&&perspective} highlight={highlight} contextLayer={layer} countyData={countyData} selectedCounty={selectedCounty} selectedSite={selectedSite} showExposure={layer==='exposure'||showExposure} onCountySelect={chooseCounty} onSiteSelect={chooseSite} />
      {countyLayer&&!countyData&&<p role="status" className={styles.status}>{loadError?'County shapes unavailable. Values remain searchable in the sidebar.':'Loading county shapes…'}</p>}
      <div className={styles.legend}>
        <h2>{metric?.label??'Active insured value'}</h2><p className={styles.caption}>{metric?.unit??(perspective?'Tower height scales with TIV':'Cell shade scales with TIV')}</p>
        <div className={styles.swatches}>{metric? <>{metric.stops.map((stop,i)=><span key={stop}><i style={{background:metric.colors[i]}}/>{geoValue(stop)}{i===metric.stops.length-1?'+':''}</span>)}<span><i style={{background:'#484f54'}}/>No data</span></>:<><span><i style={{background:'#b7813a'}}/>Exposure</span><span>○ Open</span><span>● Submission sites</span></>}</div>
        {metric&&<p className={styles.caption}>{metric.source} · {coverage.toLocaleString()} {isClimate(layer)?'cached sites':'counties'}</p>}
      </div>
    </div>
    <aside className={styles.sidebar}>
      <section className={styles.section}>
        <p className="kicker text-ochre">Commercial property</p><h1>Portfolio & geography</h1>
        <label className="kicker mb-2 block" htmlFor="map-layer">Map layer</label>
        <select id="map-layer" value={layer} onChange={e=>changeLayer(e.target.value as MapLayer)}><option value="exposure">Portfolio exposure</option><optgroup label="County context · FEMA">{Object.entries(METRICS).filter(([key])=>!isClimate(key as MapLayer)).map(([key,m])=><option key={key} value={key}>{m.label}</option>)}</optgroup><optgroup label="Submission climate · NASA">{(['humidity','temperature','rain'] as const).map(key=><option key={key} value={key}>{METRICS[key].label}</option>)}</optgroup></select>
        <div className={styles.controls}>{layer==='exposure'?<><button aria-pressed={perspective} onClick={()=>setPerspective(true)}>3D exposure</button><button aria-pressed={!perspective} onClick={()=>setPerspective(false)}>Flat map</button></>:<label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={showExposure} onChange={e=>setShowExposure(e.target.checked)}/>Show portfolio exposure</label>}</div>
        {metric&&<><p className={styles.note}>{metric.note}</p><p className={styles.caption}>Context only · not applied to the appetite score</p></>}
        {highlight&&<Link href={href(peril)} className="mt-3 block text-[12px] text-ochre">Show whole book</Link>}
      </section>
      <section className={styles.section}>
        <label htmlFor="geo-site" className="kicker mb-2 block">Inspect a submission</label><select id="geo-site" value={pin?.caseId??''} onChange={e=>{if(e.target.value)chooseSite(e.target.value);else{setSelectedSite(undefined);setSelectedCounty(undefined);}}}><option value="">Choose a submission</option>{pins.map(p=><option key={p.caseId} value={p.caseId}>#{p.caseId} · {p.insured}</option>)}</select>
        <label className="kicker mb-2 mt-5 block" htmlFor="county-search">Find a county</label><input id="county-search" type="search" value={query} placeholder="County or state" onChange={e=>setQuery(e.target.value)} className="w-full border border-edge bg-land p-2.5 text-[12px]"/>
        {query.length>=2&&<div className="mt-2" aria-live="polite">{matches.length?matches.map(c=><button key={c.id} onClick={()=>chooseCounty(c.id)} className="block w-full border-b border-rule py-2 text-left text-[12px] hover:text-ochre">{c.name}, {c.state}</button>):<p className={styles.caption}>No county found.</p>}</div>}
        {pin&&<div className={styles.controls}><Link href={`/cases/${pin.caseId}`}>Open case #{pin.caseId}</Link></div>}
        {county?<><h2 className="mt-6!">{county.name}, {county.state}</h2><CountyProfile county={county}/></>:<p className={styles.note}>{selectedSite?'No county match for these submission coordinates.':'Click a county on a hazard layer, or choose a submission.'}</p>}
        {site&&<ClimateChart key={site.caseId} climate={site.climate}/>}
      </section>
      <section className={styles.section}>
        <h2>{money(total)} active TIV</h2><p className={styles.caption}>{hexes.length} exposure cells · {pins.length} submission sites</p>
        <nav aria-label="Portfolio peril filter" className={styles.controls}>{PERILS.map(p=><Link key={p} aria-current={p===peril?'page':undefined} className={p===peril?'bg-ink text-paper':''} href={href(p)}>{p==='all'?'All perils':p==='quake'?'Quake':p[0].toUpperCase()+p.slice(1)}</Link>)}</nav>
        <p className={styles.caption}>Filters select portfolio location tags. County background coverage stays nationwide.</p>
        <details className={styles.sources}><summary>Largest concentrations</summary><ol>{concentrations.map(h=><li key={h.cell}><Link className="flex justify-between gap-3 py-2" href={href(peril,h.cell)}><span>{h.ring[0][0].toFixed(1)}°, {h.ring[0][1].toFixed(1)}°</span><span>{money(h.value)}</span></Link></li>)}</ol></details>
      </section>
      <section className={styles.section}>
        <details className={styles.sources}><summary>Sources, coverage & calculation</summary>
          <p><a href={context.source}>FEMA National Risk Index {context.versions.join(', ')}</a>. {context.countyCount.toLocaleString()} counties in the contiguous US and DC. Retrieved {context.retrievedAt.slice(0,10)}. Boundaries simplified for display; site-to-county lookup uses the source geometry.</p>
          <p>Building-loss layers divide FEMA expected annual building loss by county building value, then multiply by 1,000,000. Inland flood, coastal flood, strong wind and hurricane stay separate. Missing or non-applicable source values stay unshaded.</p>
          <p>Population density uses the source&apos;s 2020 population and county area in square miles. Heat shows area-weighted annualized event-days. County averages do not establish a particular building&apos;s exposure.</p>
          <p><a href="https://power.larc.nasa.gov/docs/services/api/temporal/climatology/">NASA POWER</a> provides 2001–2020 climate means at submission coordinates on a 0.5° × 0.625° grid. These are estimates, not site observations. {context.sites.filter(s=>s.climate).length}/{context.sites.length} cached sites have climate data.</p>
          <p>Crime: no verified, comparable crime dataset is connected. No crime values or scores are inferred.</p>
          <p>These new geographic layers are not part of the historical backtest or the active scoring formula.</p>
          <p>Exposure cells use Federato active-policy building TIV at H3 resolution 5. Basemap: OpenFreeMap / OpenStreetMap; offline state boundaries: US Census 2024.</p>
          <p>This product uses the Federal Emergency Management Agency&apos;s National Risk Index dataset API or downloadable datasets but is not endorsed by FEMA. The Federal Government or FEMA cannot vouch for the data or analyses derived from these data after the data have been retrieved from the Agency&apos;s website(s).</p>
        </details>
        <details className={styles.sources}><summary>Submission sites · {pins.length}</summary><ul className={styles.siteList}>{pins.map(p=><li key={p.caseId}><Link href={`/cases/${p.caseId}`}><span>#{p.caseId}</span><span>{p.insured}</span><DecisionChip decision={{kind:p.decision} as DecisionView}/></Link></li>)}</ul></details>
      </section>
    </aside>
  </main>;
}
