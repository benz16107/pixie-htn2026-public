#!/usr/bin/env python3
"""Cache public geographic context. No underwriting rules or case records are changed."""
from __future__ import annotations
import concurrent.futures
import hashlib
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'cache' / 'property-context'
NRI = 'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0'
NASA = 'https://power.larc.nasa.gov/api/temporal/climatology/point'
MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
FIELDS = ['STCOFIPS','COUNTY','STATE','STATEFIPS','POPULATION','AREA','BUILDVALUE','HWAV_AFREQ','HWAV_EALB','CFLD_EALB','IFLD_EALB','WFIR_EALB','SWND_EALB','HRCN_EALB','ERQK_EALB','NRI_VER']

def fetch(url, params):
    full = url + '?' + urllib.parse.urlencode(params)
    path = CACHE / (hashlib.sha256(full.encode()).hexdigest() + '.json')
    if path.exists():
        return json.loads(path.read_text())['data']
    for attempt in range(3):
        try:
            request = urllib.request.Request(full, headers={'User-Agent':'Pixie-property-context/1.0'})
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.load(response)
            if 'error' in data: raise ValueError(str(data['error']))
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({'url':full,'retrievedAt':datetime.now(timezone.utc).isoformat(),'data':data}))
            return data
        except Exception:
            if attempt == 2: raise
            time.sleep(2 * (attempt + 1))

def number(value):
    return round(value, 3) if isinstance(value, (float, int)) and value >= 0 else None

def county(p):
    building = number(p.get('BUILDVALUE'))
    def rate(field):
        value = number(p.get(field))
        return round(value / building * 1e6, 2) if value is not None and building else None
    pop, area = number(p.get('POPULATION')), number(p.get('AREA'))
    return {'id':p['STCOFIPS'],'name':p['COUNTY'],'state':p['STATE'],'population':pop,
            'density':round(pop/area, 1) if pop is not None and area else None,
            'heat':number(p.get('HWAV_AFREQ')), 'flood':rate('IFLD_EALB'), 'coastal':rate('CFLD_EALB'),
            'wildfire':rate('WFIR_EALB'),'wind':rate('SWND_EALB'), 'hurricane':rate('HRCN_EALB'),
            'quake':rate('ERQK_EALB'),'version':p.get('NRI_VER')}

def site_context(pin):
    lat, lng = pin['site']['lat'], pin['site']['lng']
    result = {'caseId':pin['caseId'],'lat':lat,'lng':lng,'countyId':None,'climate':None,'errors':[]}
    try:
        d=fetch(NRI+'/query',{'f':'json','geometry':f'{lng},{lat}','geometryType':'esriGeometryPoint','inSR':4326,'spatialRel':'esriSpatialRelIntersects','outFields':'STCOFIPS','returnGeometry':'false'})
        if d.get('features'): result['countyId']=d['features'][0]['attributes']['STCOFIPS']
    except Exception as error: result['errors'].append('County lookup unavailable: '+type(error).__name__)
    try:
        d=fetch(NASA,{'parameters':'T2M,RH2M,PRECTOTCORR','community':'SB','longitude':lng,'latitude':lat,'format':'JSON'})
        params=d['properties']['parameter']; fill=d['header']['fill_value']
        def values(key):
            return [None if params[key].get(month,fill)==fill else params[key][month] for month in MONTHS]
        def annual(key):
            v=params[key].get('ANN',fill);return None if v==fill else v
        result['climate']={'temperature':values('T2M'),'humidity':values('RH2M'),'rain':values('PRECTOTCORR'),
                           'annualTemperature':annual('T2M'),'annualHumidity':annual('RH2M'),'annualRain':annual('PRECTOTCORR'),
                           'period':d['header']['range'],'source':NASA,'parameters':d['parameters']}
    except Exception as error: result['errors'].append('Climate lookup unavailable: '+type(error).__name__)
    print('site',pin['caseId'],result['countyId'],'climate',result['climate'] is not None,flush=True)
    return result

def main():
    where="STATEFIPS NOT IN ('02','15','60','66','69','72','78')"
    expected=fetch(NRI+'/query',{'f':'json','where':where,'returnCountOnly':'true'})['count']
    features=[]
    for offset in range(0,expected,1000):
        data=fetch(NRI+'/query',{'f':'geojson','where':where,'outFields':','.join(FIELDS),'outSR':4326,'maxAllowableOffset':0.01,'geometryPrecision':3,'resultOffset':offset,'resultRecordCount':1000,'orderByFields':'STCOFIPS'})
        for feature in data['features']:
            feature['properties']=county(feature['properties']);feature['id']=feature['properties']['id']
            features.append(feature)
        print('counties',len(features),'/',expected,flush=True)
    assert len(features)==expected and len({f['id'] for f in features})==expected
    try:
        with urllib.request.urlopen('http://localhost:8000/map/pins',timeout=10) as response: pins=json.load(response)
    except Exception:
        pins=json.loads((ROOT/'web/src/fixtures/map-pins.json').read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        sites=list(pool.map(site_context,pins))
    out=ROOT/'web/public/geography';out.mkdir(parents=True,exist_ok=True)
    (out/'counties.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))
    snapshot={'retrievedAt':datetime.now(timezone.utc).isoformat(),'countyCount':len(features),'coverage':'Contiguous United States and District of Columbia','source':NRI,'versions':sorted({f['properties']['version'] for f in features}),'counties':[f['properties'] for f in features],'sites':sites}
    (ROOT/'web/src/fixtures/property-context.json').write_text(json.dumps(snapshot,separators=(',',':')))
    print('Saved',len(features),'counties and',len(sites),'sites',flush=True)

if __name__=='__main__': main()
