"use client";
import { useState } from 'react';
import { METRICS, geoValue, type County, type Climate, type ClimateMetric, type CountyMetric } from '@/lib/geography';
import styles from './Geography.module.css';

export function CountyProfile({ county }: { county: County }) {
  const hazards: CountyMetric[] = ['flood','coastal','wind','hurricane','wildfire','quake'];
  const max = Math.max(1,...hazards.map(k=>county[k] ?? 0));
  return <div className={styles.profile}>
    <div className={styles.readings}><div><span>Heat-wave days / year</span><strong>{geoValue(county.heat)}</strong></div><div><span>People / sq mi</span><strong>{geoValue(county.density)}</strong></div></div>
    <h3>Expected annual building loss</h3><p className={styles.caption}>Dollars per $1M of county building value</p>
    <div className={styles.bars}>{hazards.map(key=><div key={key}><span>{METRICS[key].label}</span><div className={styles.track}><span style={{width:`${county[key] == null ? 0 : county[key]!/max*100}%`}} /></div><b>{geoValue(county[key])}</b></div>)}</div>
  </div>;
}

export function ClimateChart({ climate }: { climate: Climate | null }) {
  const [metric,setMetric]=useState<ClimateMetric>('humidity');
  if (!climate) return <p className={styles.caption}>No cached climate data for this location.</p>;
  const values=climate[metric]; const valid=values.filter((v):v is number=>v!==null);
  const min=metric==='temperature'?Math.min(0,...valid):0;
  const max=metric==='humidity'?100:Math.max(min+1,...valid)*1.1;
  const x=(i:number)=>30+i*26;const y=(v:number)=>112-(v-min)/(max-min)*90;
  const unit={temperature:'°C',humidity:'%',rain:'mm/day'}[metric];
  return <div className={styles.climate}>
    <div className={styles.chartHeading}><h3>Seasonal climate</h3><select aria-label="Climate chart measure" value={metric} onChange={e=>setMetric(e.target.value as ClimateMetric)}>{(['humidity','temperature','rain'] as const).map(key=><option key={key} value={key}>{METRICS[key].label}</option>)}</select></div>
    <p className={styles.caption}>Annual mean · {geoValue(climate[({temperature:"annualTemperature",humidity:"annualHumidity",rain:"annualRain"} as const)[metric]])} {unit}</p>
    <svg role="img" aria-label={`Monthly ${METRICS[metric].label.toLowerCase()} climatology, 2001 to 2020, in ${unit}`} viewBox="0 0 340 145">
      {[min,(min+max)/2,max].map(tick=><g key={tick}><line x1="27" x2="322" y1={y(tick)} y2={y(tick)} stroke="var(--color-rule)"/><text x="24" y={y(tick)+3} textAnchor="end">{Math.round(tick)}</text></g>)}
      {values.map((v,i)=>v===null?null:<g key={i}>{i>0&&values[i-1]!==null&&<line x1={x(i-1)} y1={y(values[i-1]!)} x2={x(i)} y2={y(v)} stroke="var(--color-ochre)" strokeWidth="2"/>}<circle cx={x(i)} cy={y(v)} r="3" fill="var(--color-ochre)"><title>{new Date(2000,i).toLocaleString('en',{month:'long'})}: {v} {unit}</title></circle></g>)}
      {'JFMAMJJASOND'.split('').map((month,i)=><text key={i} x={x(i)} y="134" textAnchor="middle">{month}</text>)}
    </svg>
    <p className={styles.caption}>NASA POWER · 2001–2020 · 0.5° × 0.625° climate grid</p>
    <details><summary>Monthly values</summary><table><thead><tr><th>Month</th><th>{unit}</th></tr></thead><tbody>{values.map((value,i)=><tr key={i}><td>{new Date(2000,i).toLocaleString('en',{month:'long'})}</td><td>{geoValue(value)}</td></tr>)}</tbody></table></details>
  </div>;
}
