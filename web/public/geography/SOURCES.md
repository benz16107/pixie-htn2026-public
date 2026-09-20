# Commercial property geographic context

Refresh with `python3 packs/us/property_context.py` from the repository root. Raw responses are cached by the full request URL in `cache/property-context/`; successful repeated requests use that cache. The web snapshot and county GeoJSON are bundled for offline use. Missing lookups remain missing.

## County data

- Provider: FEMA National Risk Index Counties, December 2025, v1.20.
- Endpoint: https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0
- Metadata: https://www.arcgis.com/sharing/rest/content/items/39485e8035d446a5bff03259508ae355/info/metadata/metadata.xml?format=default&output=html
- Technical documentation: https://www.fema.gov/sites/default/files/documents/fema_national-risk-index_technical-documentation.pdf
- Retrieved: 2026-09-20. Exact retrieval times and source URLs are in the raw cache; the compiled snapshot records its generation time.
- Coverage: 3,109 counties, contiguous United States and District of Columbia.
- Display geometry: EPSG:4326 GeoJSON, 0.01-degree maximum simplification offset, three coordinate decimals. Submission-to-county lookup queries the original service geometry, not simplified display boundaries. No nearest-county substitution.
- Heat: HWAV_AFREQ, area-weighted annualized heat-wave event-days per year.
- Population density: POPULATION / AREA. Population is the source's 2020 population; AREA is square miles.
- Building loss: each hazard's EALB / BUILDVALUE × 1,000,000, in expected annual building-loss dollars per $1M county building value. IFLD is inland flood, CFLD is coastal flood, SWND is strong wind, HRCN is hurricane, WFIR is wildfire and ERQK is earthquake. These are displayed separately. Unavailable and negative sentinel values become null. Real zero values stay zero.
- Colour bins are display choices in `web/src/lib/geography.ts`; they are not FEMA ratings, percentiles, appetite thresholds or claim probabilities. Values at or above the last legend break use the final colour.

This product uses the Federal Emergency Management Agency's National Risk Index dataset API or downloadable datasets but is not endorsed by FEMA. The Federal Government or FEMA cannot vouch for the data or analyses derived from these data after the data have been retrieved from the Agency's website(s).

## Climate

- Provider: NASA POWER Climatology API, MERRA-2 meteorology.
- Endpoint: https://power.larc.nasa.gov/api/temporal/climatology/point
- Documentation: https://power.larc.nasa.gov/docs/services/api/temporal/climatology/
- Resolution: https://power.larc.nasa.gov/docs/tutorials/ , 0.5 degrees latitude × 0.625 degrees longitude.
- Period in the responses: January 2001 through December 2020.
- Parameters: T2M, temperature at 2 metres in degrees C; RH2M, relative humidity at 2 metres in percent; PRECTOTCORR, corrected precipitation in mm/day.
- Coverage: all 21 submission coordinates returned by the running demo API at refresh. Site layers colour only these points. There is no spatial interpolation between sites.
- Monthly and annual means come directly from the response. NASA's fill value becomes null and is never plotted as a real measurement.
- Five cached submission coordinates did not intersect a FEMA county. Climate remains available; their county profile remains unknown.

## Scope

These layers are geographic context for review. They do not alter the scoring engine, active guideline, claim estimates, premium, queue ranking or historical backtest. Population is not a proxy for crime. No verified crime dataset is connected. County loss averages and gridded outdoor climate are not measurements of a particular building's condition.
