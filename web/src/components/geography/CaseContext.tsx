import Link from 'next/link';
import { context, counties, sites } from '@/lib/geography';
import { CountyProfile, ClimateChart } from './ContextCharts';
import styles from './Geography.module.css';

export function CaseContext({caseId}:{caseId:string}) {
  const site=sites.get(caseId);const county=site?.countyId?counties.get(site.countyId):undefined;
  return <div>
    <p className={styles.caption}>Geographic context · not applied to the appetite score</p>
    <div className={styles.contextColumns}>
      <div>{county?<><h3 className="font-sans text-[22px]">{county.name}, {county.state}</h3><CountyProfile county={county}/></>:<p className={styles.note}>{site?'No county match for these submission coordinates.':'No geographic snapshot for this case.'}</p>}</div>
      {site&&<ClimateChart climate={site.climate}/>}
    </div>
    <div className={styles.controls}><Link href={`/map?site=${caseId}&layer=heat&view=flat`}>Explore geographic layers</Link></div>
    <details className={styles.sources}><summary>Sources & limits</summary><p><a href={context.source}>FEMA NRI {context.versions.join(', ')}</a> · county context. Building-loss values are expected annual building loss per $1M of county building value. They do not predict this building&apos;s claim.</p><p><a href="https://power.larc.nasa.gov/docs/services/api/temporal/climatology/">NASA POWER</a> · 2001–2020 climate means · retrieved {context.retrievedAt.slice(0,10)}. No verified crime feed is connected.</p></details>
  </div>;
}
