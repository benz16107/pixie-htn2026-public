# Toronto data sources

Fetched files retain the source geometry and attributes. Toronto Police Service points are offset to the nearest road intersection for privacy, so they must not be treated as exact incident addresses. Demographic data is not downloaded or used as a pricing input.

| Dataset | Source | Licence | Fetch date |
|---|---|---|---|
| Toronto Police Service Break and Enter Open Data, report year 2023 onward | [ArcGIS FeatureServer](https://services.arcgis.com/S9th0jAJ7bqgIRjw/arcgis/rest/services/Break_and_Enter_Open_Data/FeatureServer/0) | [Open Government Licence, Ontario](https://data.torontopolice.on.ca/pages/licence) | 2026-09-19 |
| Basement Flooding Study Areas | [City of Toronto Open Data](https://open.toronto.ca/dataset/basement-flooding-study-areas/) | [Open Government Licence, Toronto](https://open.toronto.ca/open-data-license/) | 2026-09-19 |
| Fire Station Locations | [City of Toronto Open Data](https://open.toronto.ca/dataset/fire-station-locations/) | [Open Government Licence, Toronto](https://open.toronto.ca/open-data-license/) | 2026-09-19 |
| Fire Hydrants | [City of Toronto Open Data](https://open.toronto.ca/dataset/fire-hydrants/) | [Open Government Licence, Toronto](https://open.toronto.ca/open-data-license/) | 2026-09-19 |
| TRCA Floodline Polygon | [ArcGIS FeatureServer](https://services1.arcgis.com/d0ZCwU7eGKVeNiEE/arcgis/rest/services/Floodline_TRCA_Polygon/FeatureServer/1) | [TRCA Open Data Licence](https://trca.ca/about/open-data-licence/) | 2026-09-19 |

`MANIFEST.json` records the resolved download URL, fetch timestamp, row count, and any failed source. Full downloads larger than 20 MiB stay ignored in `raw/`; the script writes a 100-row sample beside each oversized file.
