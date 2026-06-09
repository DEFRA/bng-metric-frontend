// BMD-546 spike: render baseline geometry layers on the listing page using
// @defra/interactive-map. The library is loaded via separate <script> tags in
// the page template and registers globalThis.defra at runtime — we never
// import it through webpack (its UMD bundles aren't designed for that).

const CONTAINER_ID = 'bhm-container'

const RED_LINE_PAINT = {
  'line-color': '#d4351c',
  'line-width': 2,
  'line-dasharray': [2, 2]
}
const AREA_HABITAT_PAINT = {
  'fill-color': '#00703c',
  'fill-opacity': 0.35,
  'fill-outline-color': '#00703c'
}
const HEDGEROW_PAINT = { 'line-color': '#85994b', 'line-width': 3 }
const WATERCOURSE_PAINT = { 'line-color': '#1d70b8', 'line-width': 2 }

function getDefraApi() {
  const defraApi = globalThis?.defra
  if (!defraApi?.InteractiveMap || !defraApi?.maplibreProvider) {
    return null
  }
  return defraApi
}

function fitToFeatures(map, layers) {
  const bounds = layers
    .flatMap((fc) => fc?.features ?? [])
    .reduce((acc, feature) => extendBounds(acc, feature.geometry), null)
  if (!bounds) {
    return
  }
  map.fitBounds(bounds, { padding: 32, maxZoom: 16, duration: 0 })
}

function extendBounds(acc, geometry) {
  const coords = flattenCoords(geometry)
  if (coords.length === 0) {
    return acc
  }
  let [minLon, minLat, maxLon, maxLat] = acc ?? [
    coords[0][0],
    coords[0][1],
    coords[0][0],
    coords[0][1]
  ]
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon
    if (lat < minLat) minLat = lat
    if (lon > maxLon) maxLon = lon
    if (lat > maxLat) maxLat = lat
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat]
  ]
}

function flattenCoords(geometry) {
  if (!geometry) return []
  const { type, coordinates } = geometry
  if (type === 'Point') return [coordinates]
  if (type === 'LineString' || type === 'MultiPoint') return coordinates
  if (type === 'Polygon' || type === 'MultiLineString') {
    return coordinates.flat()
  }
  if (type === 'MultiPolygon') return coordinates.flat(2)
  return []
}

function addLineLayer(map, id, featureCollection, paint) {
  if (!featureCollection?.features?.length) return
  map.addSource(id, { type: 'geojson', data: featureCollection })
  map.addLayer({ id, type: 'line', source: id, paint })
}

function addFillLayer(map, id, featureCollection, fillPaint) {
  if (!featureCollection?.features?.length) return
  map.addSource(id, { type: 'geojson', data: featureCollection })
  map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, paint: fillPaint })
}

function addLayers(map, payload) {
  addLineLayer(map, 'red-line', payload.redLine, RED_LINE_PAINT)
  addFillLayer(map, 'area-habitats', payload.areaHabitats, AREA_HABITAT_PAINT)
  addLineLayer(map, 'hedgerows', payload.hedgerows, HEDGEROW_PAINT)
  addLineLayer(map, 'watercourses', payload.watercourses, WATERCOURSE_PAINT)

  fitToFeatures(map, [
    payload.redLine,
    payload.areaHabitats,
    payload.hedgerows,
    payload.watercourses
  ])
}

function runWhenStyleReady(map, callback) {
  if (map.isStyleLoaded()) {
    callback()
    return
  }
  map.once('style.load', callback)
}

async function loadGeoJson(url) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) {
    throw new Error(`GeoJSON fetch failed: ${response.status}`)
  }
  return response.json()
}

export async function initBaselineHabitatMap() {
  const container = document.getElementById(CONTAINER_ID)
  if (!container) {
    return
  }

  const { geoJsonUrl, osStyleUrl } = container.dataset
  if (!geoJsonUrl || !osStyleUrl) {
    console.warn('[baseline-habitat-map] missing data-* attributes; skipping')
    return
  }

  const defraApi = getDefraApi()
  if (!defraApi) {
    console.warn('[baseline-habitat-map] @defra/interactive-map not loaded')
    return
  }

  let payload
  try {
    payload = await loadGeoJson(geoJsonUrl)
  } catch (err) {
    console.error('[baseline-habitat-map] failed to load geometries', err)
    container.innerHTML =
      '<p class="govuk-body">Map unavailable — could not load geometries.</p>'
    return
  }

  const osAttribution = `&copy; Crown copyright and database rights ${new Date().getFullYear()} Ordnance Survey`
  const mapStyle = {
    id: 'os-default',
    label: 'OS Maps',
    url: osStyleUrl,
    attribution: osAttribution
  }

  const interactiveMap = new defraApi.InteractiveMap(CONTAINER_ID, {
    mapProvider: defraApi.maplibreProvider(),
    behaviour: 'inline',
    enableZoomControls: true,
    mapStyle,
    mapStyles: [mapStyle]
  })

  interactiveMap.on('map:ready', (event) => {
    const map = event?.map
    if (!map) {
      console.warn('[baseline-habitat-map] map:ready event had no map instance')
      return
    }
    runWhenStyleReady(map, () => {
      try {
        addLayers(map, payload)
      } catch (err) {
        console.error('[baseline-habitat-map] failed to add layers', err)
      }
    })
  })
}
