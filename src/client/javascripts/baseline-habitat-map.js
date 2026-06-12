// BMD-546 spike: render baseline + post-intervention geometry on the
// habitat list page using @defra/interactive-map. The library is loaded
// via separate <script> tags in the page template and registers
// globalThis.defra at runtime — we never import it through webpack (its
// UMD bundles aren't designed for that).

import {
  broadHabitatSublayers,
  detailedHabitatSublayers,
  hedgerowSublayers,
  PATTERNS,
  watercourseSublayers
} from './ukhab-palette.js'

const CONTAINER_ID = 'bhm-container'
const STAGE_TOGGLE_NAME = 'bhm-stage'

const RED_LINE_PAINT = {
  'line-color': '#d4351c',
  'line-width': 2,
  'line-dasharray': [2, 2]
}

const HIGHLIGHT_FILL_PAINT = {
  'fill-color': '#ffdd00',
  'fill-opacity': 0.5,
  'fill-outline-color': '#0b0c0c'
}
const HIGHLIGHT_LINE_PAINT = {
  'line-color': '#ffdd00',
  'line-width': 5
}

const LAYER_DEFS = [
  { layer: 'areaHabitats', type: 'fill', sublayerProperty: 'broadHabitatType' },
  { layer: 'hedgerows', type: 'line', sublayerProperty: 'habitatType' },
  { layer: 'watercourses', type: 'line', sublayerProperty: 'habitatType' }
]

const PATTERN_TILE_SIZE = 16

// Two-colour SVG tile generators for the named patterns declared in
// ukhab-palette.js. Each returns a 16x16 SVG that maplibre will tile across
// the fill via the fill-pattern paint property. Background colour matches
// the parent broad-habitat fill so the detailed pattern reads as an overlay
// on top of the broad colour rather than replacing it.
function patternSvg(name, fg, bg, size = PATTERN_TILE_SIZE) {
  const background = `<rect width="${size}" height="${size}" fill="${bg}"/>`
  if (name === PATTERNS.CROSS_HATCH) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${background}<path d="M0 0L${size} ${size}M${size} 0L0 ${size}" stroke="${fg}" stroke-width="1.5"/></svg>`
  }
  if (name === PATTERNS.HORIZONTAL) {
    const mid = size / 2
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${background}<path d="M0 ${mid}L${size} ${mid}" stroke="${fg}" stroke-width="2"/></svg>`
  }
  if (name === PATTERNS.VERTICAL) {
    const mid = size / 2
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${background}<path d="M${mid} 0L${mid} ${size}" stroke="${fg}" stroke-width="2"/></svg>`
  }
  if (name === PATTERNS.DOTS) {
    const mid = size / 2
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${background}<circle cx="${mid}" cy="${mid}" r="2" fill="${fg}"/></svg>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${background}</svg>`
}

function loadSvgAsImage(svg) {
  return new Promise((resolve, reject) => {
    const ImageCtor = globalThis.Image
    if (!ImageCtor) {
      reject(new Error('Image constructor not available'))
      return
    }
    const image = new ImageCtor(PATTERN_TILE_SIZE, PATTERN_TILE_SIZE)
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load pattern SVG'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

function patternImageId(name, fg, bg) {
  return `bhm-pat-${name}-${fg.replace('#', '')}-${bg.replace('#', '')}`
}

async function ensurePatternImage(map, name, fg, bg) {
  const id = patternImageId(name, fg, bg)
  if (map.hasImage(id)) return id
  const svg = patternSvg(name, fg, bg)
  const image = await loadSvgAsImage(svg)
  // Concurrent calls for the same pattern could race; addImage throws if the
  // image is already present, so guard with hasImage on both sides.
  if (!map.hasImage(id)) {
    map.addImage(id, image)
  }
  return id
}

async function preloadDetailedHabitatPatterns(map) {
  const sublayers = detailedHabitatSublayers('habitatType')
  await Promise.all(
    sublayers.map((sub) =>
      ensurePatternImage(
        map,
        sub.style.fillPattern,
        sub.style.fillPatternForegroundColor,
        sub.style.fillPatternBackgroundColor
      )
    )
  )
}

function getDefraApi() {
  const defraApi = globalThis?.defra
  if (!defraApi?.InteractiveMap || !defraApi?.maplibreProvider) {
    return null
  }
  return defraApi
}

function fitToFeatures(map, layers) {
  const tuple = layers
    .flatMap((fc) => fc?.features ?? [])
    .reduce((acc, feature) => extendBounds(acc, feature.geometry), null)
  if (!tuple) return
  const [minLon, minLat, maxLon, maxLat] = tuple
  map.fitBounds(
    [
      [minLon, minLat],
      [maxLon, maxLat]
    ],
    { padding: 32, maxZoom: 15, duration: 0 }
  )
}

function extendBounds(acc, geometry) {
  const coords = flattenCoords(geometry)
  if (coords.length === 0) return acc
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
  return [minLon, minLat, maxLon, maxLat]
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

function emptyFeatureCollection() {
  return { type: 'FeatureCollection', features: [] }
}

function addSourceIfMissing(map, sourceId, data) {
  if (!data?.features?.length) return false
  if (map.getSource(sourceId)) {
    map.getSource(sourceId).setData(data)
  } else {
    map.addSource(sourceId, { type: 'geojson', data })
  }
  return true
}

function addRedLineLayer(map, sourceId, fc) {
  if (!addSourceIfMissing(map, sourceId, fc)) return
  if (map.getLayer(sourceId)) return
  map.addLayer({
    id: sourceId,
    type: 'line',
    source: sourceId,
    paint: RED_LINE_PAINT
  })
}

function maplibreFilterFromSublayer(sublayer) {
  return sublayer.filter
}

function paintFromFillSublayer(style) {
  return {
    'fill-color': style.fill,
    'fill-opacity': 0.55,
    'fill-outline-color': style.stroke
  }
}

function paintFromStrokeSublayer(style) {
  const paint = {
    'line-color': style.stroke,
    'line-width': style.strokeWidth ?? 2
  }
  if (style.dashArray) {
    paint['line-dasharray'] = style.dashArray
  }
  return paint
}

function addSublayerStack(map, sourceId, fc, layerDef) {
  if (!addSourceIfMissing(map, sourceId, fc)) return
  const sublayers =
    layerDef.layer === 'areaHabitats'
      ? broadHabitatSublayers(layerDef.sublayerProperty)
      : layerDef.layer === 'hedgerows'
        ? hedgerowSublayers(layerDef.sublayerProperty)
        : watercourseSublayers(layerDef.sublayerProperty)

  for (const sublayer of sublayers) {
    const layerId = `${sourceId}-${sublayer.id}`
    if (map.getLayer(layerId)) continue
    if (layerDef.type === 'fill') {
      map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        filter: maplibreFilterFromSublayer(sublayer),
        paint: paintFromFillSublayer(sublayer.style)
      })
    } else {
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        filter: maplibreFilterFromSublayer(sublayer),
        paint: paintFromStrokeSublayer(sublayer.style)
      })
    }
  }
}

// Detailed (Level 4) sublayers paint on top of the broad fills using
// fill-pattern. Their filter only matches features whose habitatType is in
// the detailed palette, so features without a detailed entry are unaffected
// and the broad colour beneath shows through. Layer order matters here —
// this must be called after addSublayerStack for areaHabitats so the
// patterns appear above the solid broad fills in the maplibre layer stack.
function addDetailedHabitatLayers(map, sourceId, fc) {
  if (!fc?.features?.length) return
  if (!map.getSource(sourceId)) return
  const sublayers = detailedHabitatSublayers('habitatType')
  for (const sublayer of sublayers) {
    const layerId = `${sourceId}-${sublayer.id}`
    if (map.getLayer(layerId)) continue
    const patternId = patternImageId(
      sublayer.style.fillPattern,
      sublayer.style.fillPatternForegroundColor,
      sublayer.style.fillPatternBackgroundColor
    )
    map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      filter: sublayer.filter,
      paint: {
        'fill-pattern': patternId,
        'fill-outline-color': sublayer.style.stroke
      }
    })
  }
}

function ensureHighlightLayers(map) {
  if (!map.getSource('bhm-highlight-fill')) {
    map.addSource('bhm-highlight-fill', {
      type: 'geojson',
      data: emptyFeatureCollection()
    })
    map.addLayer({
      id: 'bhm-highlight-fill',
      type: 'fill',
      source: 'bhm-highlight-fill',
      paint: HIGHLIGHT_FILL_PAINT
    })
  }
  if (!map.getSource('bhm-highlight-line')) {
    map.addSource('bhm-highlight-line', {
      type: 'geojson',
      data: emptyFeatureCollection()
    })
    map.addLayer({
      id: 'bhm-highlight-line',
      type: 'line',
      source: 'bhm-highlight-line',
      paint: HIGHLIGHT_LINE_PAINT
    })
  }
}

async function renderStage(map, payload) {
  addRedLineLayer(map, 'red-line', payload.redLine)
  for (const layerDef of LAYER_DEFS) {
    const fc = payload[layerDef.layer] ?? emptyFeatureCollection()
    addSublayerStack(map, layerDef.layer, fc, layerDef)
  }
  // Patterns must be registered with the map before the detailed-habitat
  // layers reference them via fill-pattern; otherwise maplibre fires
  // styleimagemissing and the layer renders blank until the image arrives.
  await preloadDetailedHabitatPatterns(map)
  addDetailedHabitatLayers(
    map,
    'areaHabitats',
    payload.areaHabitats ?? emptyFeatureCollection()
  )
  ensureHighlightLayers(map)
  fitToFeatures(map, [
    payload.redLine,
    payload.areaHabitats,
    payload.hedgerows,
    payload.watercourses
  ])
}

function setStageData(map, payload) {
  if (map.getSource('red-line') && payload.redLine) {
    map.getSource('red-line').setData(payload.redLine)
  }
  for (const layerDef of LAYER_DEFS) {
    const source = map.getSource(layerDef.layer)
    if (source) {
      source.setData(payload[layerDef.layer] ?? emptyFeatureCollection())
    } else {
      // Stage was empty on initial render; build the layers now.
      addSublayerStack(
        map,
        layerDef.layer,
        payload[layerDef.layer] ?? emptyFeatureCollection(),
        layerDef
      )
    }
  }
  // Detailed habitat patterns reference the areaHabitats source — if the
  // source was just created above, the detailed layers don't exist yet, so
  // build them now. Patterns are preloaded once at init, so this stays
  // synchronous after the first render.
  addDetailedHabitatLayers(
    map,
    'areaHabitats',
    payload.areaHabitats ?? emptyFeatureCollection()
  )
}

function runWhenStyleReady(map, callback) {
  if (map.isStyleLoaded()) {
    callback()
    return
  }
  map.once('style.load', callback)
}

async function loadGeometry(url) {
  if (!url) return null
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) {
    throw new Error(`Geometry fetch failed: ${response.status}`)
  }
  return response.json()
}

function findFeatureByRef(payload, ref) {
  for (const key of ['areaHabitats', 'hedgerows', 'watercourses']) {
    const feature = payload?.[key]?.features?.find(
      (f) => f.properties?.ref === ref
    )
    if (feature) return { feature, layer: key }
  }
  return null
}

function setHighlight(map, feature) {
  if (!feature) {
    if (map.getSource('bhm-highlight-fill')) {
      map.getSource('bhm-highlight-fill').setData(emptyFeatureCollection())
    }
    if (map.getSource('bhm-highlight-line')) {
      map.getSource('bhm-highlight-line').setData(emptyFeatureCollection())
    }
    return
  }
  const fc = { type: 'FeatureCollection', features: [feature] }
  const isLine = feature.geometry?.type?.includes('LineString')
  if (isLine) {
    map.getSource('bhm-highlight-line')?.setData(fc)
    map.getSource('bhm-highlight-fill')?.setData(emptyFeatureCollection())
  } else {
    map.getSource('bhm-highlight-fill')?.setData(fc)
    map.getSource('bhm-highlight-line')?.setData(emptyFeatureCollection())
  }
}

function escapeRefForSelector(ref) {
  return String(ref).replace(/["\\]/g, '\\$&')
}

function highlightRowByRef(ref) {
  const previous = document.querySelectorAll('tr.bhm-row-highlighted')
  previous.forEach((tr) => tr.classList.remove('bhm-row-highlighted'))
  if (ref == null) return
  const row = document.querySelector(
    `tr[data-ref="${escapeRefForSelector(ref)}"]`
  )
  if (row) {
    row.classList.add('bhm-row-highlighted')
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

function annotateTableRowsWithRef() {
  const tables = document.querySelectorAll('table.govuk-table')
  for (const table of tables) {
    const rows = table.querySelectorAll('tbody tr')
    for (const row of rows) {
      if (row.dataset.ref) continue
      const refCell = row.querySelector('td:first-child')
      if (!refCell) continue
      const ref = refCell.textContent?.trim() ?? ''
      if (ref) row.dataset.ref = ref
    }
  }
}

function wireTableToMap(map, stageGetter) {
  annotateTableRowsWithRef()
  document.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-ref]')
    if (!row) return
    if (event.target.closest('a, button, input')) return
    const ref = row.dataset.ref
    const payload = stageGetter()
    const found = findFeatureByRef(payload, ref)
    if (!found) return
    event.preventDefault()
    setHighlight(map, found.feature)
    highlightRowByRef(ref)
    const bbox = extendBounds(null, found.feature.geometry)
    if (bbox) {
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]]
        ],
        { padding: 64, maxZoom: 17, duration: 250 }
      )
    }
  })
}

function wireMapToTable(map) {
  const clickableLayers = LAYER_DEFS.map((d) => d.layer)
  for (const layer of clickableLayers) {
    map.on('click', layer, (e) => {
      const feature = e.features?.[0]
      if (!feature) return
      const ref = feature.properties?.ref
      if (!ref) return
      setHighlight(map, feature)
      highlightRowByRef(ref)
    })
    map.on('mouseenter', layer, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', layer, () => {
      map.getCanvas().style.cursor = ''
    })
  }
}

function renderStageToggle(container, initialStage, onChange) {
  if (document.getElementById('bhm-stage-toggle')) return
  const wrapper = document.createElement('fieldset')
  wrapper.id = 'bhm-stage-toggle'
  wrapper.className = 'govuk-fieldset govuk-!-margin-bottom-2 bhm-stage-toggle'
  wrapper.innerHTML = `
    <legend class="govuk-fieldset__legend govuk-fieldset__legend--s">
      Stage
    </legend>
    <div class="govuk-radios govuk-radios--inline" data-module="govuk-radios">
      <div class="govuk-radios__item">
        <input class="govuk-radios__input" id="bhm-stage-baseline" name="${STAGE_TOGGLE_NAME}" type="radio" value="baseline" ${initialStage === 'baseline' ? 'checked' : ''}>
        <label class="govuk-label govuk-radios__label" for="bhm-stage-baseline">Baseline</label>
      </div>
      <div class="govuk-radios__item">
        <input class="govuk-radios__input" id="bhm-stage-pi" name="${STAGE_TOGGLE_NAME}" type="radio" value="postIntervention" ${initialStage === 'postIntervention' ? 'checked' : ''}>
        <label class="govuk-label govuk-radios__label" for="bhm-stage-pi">Post-intervention</label>
      </div>
    </div>
  `
  container.parentNode.insertBefore(wrapper, container)
  wrapper.addEventListener('change', (event) => {
    const stage = event.target?.value
    if (stage) onChange(stage)
  })
}

export async function initBaselineHabitatMap() {
  const container = document.getElementById(CONTAINER_ID)
  if (!container) return

  const {
    geometryUrl,
    postInterventionGeometryUrl,
    osStyleUrl,
    stage: initialStageAttr
  } = container.dataset
  if (!geometryUrl || !osStyleUrl) {
    console.warn('[baseline-habitat-map] missing data-* attributes; skipping')
    return
  }
  const initialStage =
    initialStageAttr === 'postIntervention' ? 'postIntervention' : 'baseline'

  const defraApi = getDefraApi()
  if (!defraApi) {
    console.warn('[baseline-habitat-map] @defra/interactive-map not loaded')
    return
  }

  const stages = { baseline: null, postIntervention: null }
  try {
    stages.baseline = await loadGeometry(geometryUrl)
    if (postInterventionGeometryUrl) {
      stages.postIntervention = await loadGeometry(
        postInterventionGeometryUrl
      ).catch((err) => {
        console.warn(
          '[baseline-habitat-map] post-intervention fetch failed',
          err
        )
        return null
      })
    }
  } catch (err) {
    console.error('[baseline-habitat-map] failed to load geometries', err)
    container.innerHTML =
      '<p class="govuk-body">Map unavailable — could not load geometries.</p>'
    return
  }

  let currentStage = initialStage
  const stageGetter = () => stages[currentStage] ?? stages.baseline

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

  if (stages.postIntervention) {
    renderStageToggle(container, currentStage, (nextStage) => {
      currentStage = nextStage
      const payload = stageGetter()
      if (!payload) return
      const map = interactiveMap?._map ?? interactiveMap?.map
      if (map) {
        setStageData(map, payload)
        setHighlight(map, null)
        highlightRowByRef(null)
      }
    })
  }

  interactiveMap.on('map:ready', (event) => {
    const map = event?.map
    if (!map) {
      console.warn('[baseline-habitat-map] map:ready event had no map instance')
      return
    }
    runWhenStyleReady(map, async () => {
      try {
        await renderStage(map, stageGetter())
        wireTableToMap(map, stageGetter)
        wireMapToTable(map)
      } catch (err) {
        console.error('[baseline-habitat-map] failed to add layers', err)
      }
    })
  })
}
