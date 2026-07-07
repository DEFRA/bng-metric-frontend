// BMD-546 spike: render baseline and post-intervention geometry on the
// habitat list page using @defra/interactive-map. The library is loaded via
// separate <script> tags in the page template and registers globalThis.defra
// at runtime — we never import it through webpack (its UMD bundles aren't
// designed for that).
//
// Both stages render as parallel maplibre source/layer sets. A checkbox panel
// overlaid on the map toggles per-layer-per-stage visibility, so the user can
// view either stage alone or both at once. When both are visible, baseline
// switches to a dashed-grey "ghost" outline so the PI UKHab fills read on
// top — making the difference between the two stages visible at a glance.

import {
  broadHabitatPalette,
  broadHabitatSublayers,
  detailedHabitatPalette,
  detailedHabitatSublayers,
  hedgerowPalette,
  hedgerowSublayers,
  PATTERNS,
  watercoursePalette,
  watercourseSublayers
} from './ukhab-palette.js'

const CONTAINER_ID = 'bhm-container'
const LAYER_PANEL_ID = 'bhm-layer-panel'
const LEGEND_ID = 'bhm-legend'
const WRAPPER_CLASS = 'bhm-wrapper'

// Getmapping APGB aerial photography, proxied same-origin (see the
// aerial-base-map server plugin). Added beneath the BNG data as a raster base
// layer and toggled from the layer panel; off by default so OS Maps stays the
// default backdrop.
const AERIAL_SOURCE_ID = 'bhm-aerial'
const AERIAL_LAYER_ID = 'bhm-aerial'
const AERIAL_TILE_SIZE = 256
const AERIAL_MAX_ZOOM = 20
const AERIAL_ATTRIBUTION = 'Aerial imagery &copy; Getmapping plc / APGB'

const RED_LINE_PAINT = {
  'line-color': '#d4351c',
  'line-width': 2,
  'line-dasharray': [2, 2]
}

const GHOST_PAINT = {
  'line-color': '#0b0c0c',
  'line-width': 1.5,
  'line-dasharray': [3, 2],
  'line-opacity': 0.7
}

// Selected-feature highlight: bright turquoise border with a thin white halo
// behind it so the border reads against any UKHab fill colour. For polygons
// the border is drawn as a separate line layer on the polygon source (fills
// can't carry a thick outline). A subtle turquoise tint keeps the interior
// visually associated with the selection without obscuring its habitat fill.
const HIGHLIGHT_TURQUOISE = '#00e5cc'
const HIGHLIGHT_HALO_COLOR = '#ffffff'
const HIGHLIGHT_BORDER_WIDTH = 4
const HIGHLIGHT_HALO_WIDTH = 7
const HIGHLIGHT_LINE_WIDTH = 5
const HIGHLIGHT_LINE_HALO_WIDTH = 9

const HIGHLIGHT_FILL_TINT_PAINT = {
  'fill-color': HIGHLIGHT_TURQUOISE,
  'fill-opacity': 0.15
}
const HIGHLIGHT_FILL_HALO_PAINT = {
  'line-color': HIGHLIGHT_HALO_COLOR,
  'line-width': HIGHLIGHT_HALO_WIDTH
}
const HIGHLIGHT_FILL_BORDER_PAINT = {
  'line-color': HIGHLIGHT_TURQUOISE,
  'line-width': HIGHLIGHT_BORDER_WIDTH
}
const HIGHLIGHT_LINE_HALO_PAINT = {
  'line-color': HIGHLIGHT_HALO_COLOR,
  'line-width': HIGHLIGHT_LINE_HALO_WIDTH
}
const HIGHLIGHT_LINE_PAINT = {
  'line-color': HIGHLIGHT_TURQUOISE,
  'line-width': HIGHLIGHT_LINE_WIDTH
}

const LAYER_DEFS = [
  {
    layer: 'areaHabitats',
    type: 'fill',
    sublayerProperty: 'broadHabitatType',
    label: 'Area habitats',
    sublayerFactory: broadHabitatSublayers
  },
  {
    layer: 'hedgerows',
    type: 'line',
    sublayerProperty: 'habitatType',
    label: 'Hedgerows',
    sublayerFactory: hedgerowSublayers
  },
  {
    layer: 'watercourses',
    type: 'line',
    sublayerProperty: 'habitatType',
    label: 'Watercourses',
    sublayerFactory: watercourseSublayers
  }
]

const STAGE_PREFIX = { baseline: 'baseline', postIntervention: 'pi' }

const PATTERN_TILE_SIZE = 16

// ---------------------------------------------------------------------------
// Pattern tile generators for the detailed (Level 4) habitat fills.
// Background colour matches the parent broad-habitat fill so the detailed
// pattern reads as an overlay on top of the broad colour.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Bounds helpers — used to fit the camera to all the data the page has.
// ---------------------------------------------------------------------------

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

function fitToFeatureCollections(map, featureCollections) {
  const tuple = featureCollections
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

// ---------------------------------------------------------------------------
// Source + layer building. Each stage registers its own sources and layers
// under a stage prefix; baseline additionally gets a "ghost" line layer per
// data source that draws a dashed outline (used when PI is overlaid on top).
// ---------------------------------------------------------------------------

function getDefraApi() {
  const defraApi = globalThis?.defra
  if (!defraApi?.InteractiveMap || !defraApi?.maplibreProvider) {
    return null
  }
  return defraApi
}

function emptyFeatureCollection() {
  return { type: 'FeatureCollection', features: [] }
}

function createLayerRegistry() {
  const perLayer = () =>
    Object.fromEntries(LAYER_DEFS.map((def) => [def.layer, []]))
  return {
    redLine: [],
    baselineFull: perLayer(),
    baselineGhost: perLayer(),
    piFull: perLayer()
  }
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

function addGeoJsonSource(map, sourceId, data) {
  if (!data?.features?.length) return false
  if (map.getSource(sourceId)) {
    map.getSource(sourceId).setData(data)
  } else {
    map.addSource(sourceId, { type: 'geojson', data })
  }
  return true
}

// Raster aerial base layer. Added first (see renderAll) so it sits at the
// bottom of our layer stack — above the OS vector base, beneath every BNG data
// layer. Hidden initially; applyVisibility drives it from state.aerial.
function addAerialLayer(map, aerialUrl) {
  if (!aerialUrl || map.getSource(AERIAL_SOURCE_ID)) return
  map.addSource(AERIAL_SOURCE_ID, {
    type: 'raster',
    tiles: [aerialUrl],
    tileSize: AERIAL_TILE_SIZE,
    maxzoom: AERIAL_MAX_ZOOM,
    attribution: AERIAL_ATTRIBUTION
  })
  map.addLayer({
    id: AERIAL_LAYER_ID,
    type: 'raster',
    source: AERIAL_SOURCE_ID,
    layout: { visibility: 'none' }
  })
}

function addRedLineLayer(map, registry, payload) {
  const sourceId = 'red-line'
  if (!addGeoJsonSource(map, sourceId, payload?.redLine)) return
  if (map.getLayer(sourceId)) return
  map.addLayer({
    id: sourceId,
    type: 'line',
    source: sourceId,
    paint: RED_LINE_PAINT
  })
  registry.redLine.push(sourceId)
}

function addFullStageLayers(map, stage, payload, registry) {
  const prefix = STAGE_PREFIX[stage]
  const group = stage === 'baseline' ? registry.baselineFull : registry.piFull
  for (const def of LAYER_DEFS) {
    const sourceId = `${prefix}-${def.layer}`
    const fc = payload?.[def.layer]
    if (!addGeoJsonSource(map, sourceId, fc)) continue
    const sublayers = def.sublayerFactory(def.sublayerProperty)
    for (const sublayer of sublayers) {
      const layerId = `${sourceId}-${sublayer.id}`
      if (map.getLayer(layerId)) continue
      if (def.type === 'fill') {
        map.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          filter: sublayer.filter,
          paint: paintFromFillSublayer(sublayer.style)
        })
      } else {
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          filter: sublayer.filter,
          paint: paintFromStrokeSublayer(sublayer.style)
        })
      }
      group[def.layer].push(layerId)
    }
  }
}

// Detailed (Level 4) sublayers paint on top of the broad fills using
// fill-pattern. Patterns must already be registered on the map by the time
// these layers reference them. Filter only matches features whose habitatType
// is in the detailed palette, so features without a detailed entry are
// unaffected and the broad colour beneath shows through.
function addDetailedHabitatLayers(map, stage, payload, registry) {
  const prefix = STAGE_PREFIX[stage]
  const sourceId = `${prefix}-areaHabitats`
  if (!map.getSource(sourceId)) return
  if (!payload?.areaHabitats?.features?.length) return
  const group = stage === 'baseline' ? registry.baselineFull : registry.piFull
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
    group.areaHabitats.push(layerId)
  }
}

// One ghost line layer per baseline source — drawn on top of the full layers
// so dashed baseline outlines remain visible over PI fills. Toggled into view
// only when PI is also visible for the same data layer.
function addBaselineGhostLayers(map, registry) {
  for (const def of LAYER_DEFS) {
    const sourceId = `baseline-${def.layer}`
    if (!map.getSource(sourceId)) continue
    const layerId = `${sourceId}-ghost`
    if (map.getLayer(layerId)) continue
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: GHOST_PAINT
    })
    registry.baselineGhost[def.layer].push(layerId)
  }
}

function ensureHighlightLayers(map) {
  if (!map.getSource('bhm-highlight-fill')) {
    map.addSource('bhm-highlight-fill', {
      type: 'geojson',
      data: emptyFeatureCollection()
    })
    // Layer order matters — halo first, then turquoise border on top, with
    // the subtle tint underneath both. A line layer on a polygon source
    // draws the polygon outline, which is how we get a thick border.
    map.addLayer({
      id: 'bhm-highlight-fill',
      type: 'fill',
      source: 'bhm-highlight-fill',
      paint: HIGHLIGHT_FILL_TINT_PAINT
    })
    map.addLayer({
      id: 'bhm-highlight-fill-halo',
      type: 'line',
      source: 'bhm-highlight-fill',
      paint: HIGHLIGHT_FILL_HALO_PAINT
    })
    map.addLayer({
      id: 'bhm-highlight-fill-border',
      type: 'line',
      source: 'bhm-highlight-fill',
      paint: HIGHLIGHT_FILL_BORDER_PAINT
    })
  }
  if (!map.getSource('bhm-highlight-line')) {
    map.addSource('bhm-highlight-line', {
      type: 'geojson',
      data: emptyFeatureCollection()
    })
    map.addLayer({
      id: 'bhm-highlight-line-halo',
      type: 'line',
      source: 'bhm-highlight-line',
      paint: HIGHLIGHT_LINE_HALO_PAINT
    })
    map.addLayer({
      id: 'bhm-highlight-line',
      type: 'line',
      source: 'bhm-highlight-line',
      paint: HIGHLIGHT_LINE_PAINT
    })
  }
}

async function renderAll(map, payloads, registry, aerialUrl) {
  addAerialLayer(map, aerialUrl)
  addRedLineLayer(map, registry, payloads.baseline ?? payloads.postIntervention)
  addFullStageLayers(map, 'baseline', payloads.baseline, registry)
  addFullStageLayers(
    map,
    'postIntervention',
    payloads.postIntervention,
    registry
  )
  // Patterns must be registered with the map before the detailed-habitat
  // layers reference them via fill-pattern; otherwise maplibre fires
  // styleimagemissing and the layer renders blank until the image arrives.
  await preloadDetailedHabitatPatterns(map)
  addDetailedHabitatLayers(map, 'baseline', payloads.baseline, registry)
  addDetailedHabitatLayers(
    map,
    'postIntervention',
    payloads.postIntervention,
    registry
  )
  addBaselineGhostLayers(map, registry)
  ensureHighlightLayers(map)
  fitToFeatureCollections(map, [
    payloads.baseline?.redLine,
    payloads.baseline?.areaHabitats,
    payloads.baseline?.hedgerows,
    payloads.baseline?.watercourses,
    payloads.postIntervention?.redLine,
    payloads.postIntervention?.areaHabitats,
    payloads.postIntervention?.hedgerows,
    payloads.postIntervention?.watercourses
  ])
}

// ---------------------------------------------------------------------------
// Visibility model. State is { redLine: bool, areaHabitats: {baseline, pi},
// hedgerows: {…}, watercourses: {…} }. When both stages are checked for a
// data layer, baseline collapses to its dashed ghost line so the PI UKHab
// fills read on top.
// ---------------------------------------------------------------------------

function setLayerListVisibility(map, layerIds, visible) {
  const value = visible ? 'visible' : 'none'
  for (const id of layerIds) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', value)
    }
  }
}

function applyVisibility(map, registry, state, piAvailable) {
  setLayerListVisibility(map, [AERIAL_LAYER_ID], state.aerial === true)
  setLayerListVisibility(map, registry.redLine, state.redLine === true)
  for (const def of LAYER_DEFS) {
    const baselineOn = state[def.layer]?.baseline === true
    const piOn = piAvailable && state[def.layer]?.pi === true
    const baselineFullVisible = baselineOn && !piOn
    const baselineGhostVisible = baselineOn && piOn
    const piFullVisible = piOn
    setLayerListVisibility(
      map,
      registry.baselineFull[def.layer],
      baselineFullVisible
    )
    setLayerListVisibility(
      map,
      registry.baselineGhost[def.layer],
      baselineGhostVisible
    )
    setLayerListVisibility(map, registry.piFull[def.layer], piFullVisible)
  }
}

// ---------------------------------------------------------------------------
// Checkbox layer panel — sits as a map overlay (top-right of the map). One
// checkbox per layer per available stage; baseline + PI for each non-redline
// data layer. When PI data isn't loaded, only baseline checkboxes render.
// ---------------------------------------------------------------------------

function buildInitialState(piAvailable) {
  const state = { redLine: true, aerial: false }
  for (const def of LAYER_DEFS) {
    state[def.layer] = { baseline: true, pi: piAvailable }
  }
  return state
}

function ensureMapWrapper(container) {
  const parent = container.parentElement
  if (parent?.classList.contains(WRAPPER_CLASS)) return parent
  const wrapper = document.createElement('div')
  wrapper.className = WRAPPER_CLASS
  container.parentNode.insertBefore(wrapper, container)
  wrapper.appendChild(container)
  return wrapper
}

function renderStageCheckbox(layerKey, stageKey, label, checked) {
  const id = `bhm-toggle-${layerKey}-${stageKey}`
  return `
    <div class="bhm-layer-panel__option">
      <input class="bhm-layer-panel__checkbox" type="checkbox" id="${id}"
             data-layer="${layerKey}" data-stage="${stageKey}"
             ${checked ? 'checked' : ''}>
      <label class="bhm-layer-panel__option-label" for="${id}">${label}</label>
    </div>
  `
}

function renderRedLineRow(state) {
  return `
    <div class="bhm-layer-panel__option">
      <input class="bhm-layer-panel__checkbox" type="checkbox" id="bhm-toggle-redLine"
             data-layer="redLine" ${state.redLine ? 'checked' : ''}>
      <label class="bhm-layer-panel__option-label" for="bhm-toggle-redLine">Red line boundary</label>
    </div>
  `
}

function renderBaseMapSection(state) {
  return `
    <div class="bhm-layer-panel__group">
      <div class="bhm-layer-panel__group-title">Base map</div>
      <div class="bhm-layer-panel__option">
        <input class="bhm-layer-panel__checkbox" type="checkbox" id="bhm-toggle-aerial"
               data-layer="aerial" ${state.aerial ? 'checked' : ''}>
        <label class="bhm-layer-panel__option-label" for="bhm-toggle-aerial">Aerial photography</label>
      </div>
    </div>
  `
}

function renderStageSection(stageKey, stageLabel, state) {
  const rows = LAYER_DEFS.map((def) =>
    renderStageCheckbox(
      def.layer,
      stageKey,
      def.label,
      state[def.layer]?.[stageKey]
    )
  ).join('')
  return `
    <div class="bhm-layer-panel__group">
      <div class="bhm-layer-panel__group-title">${stageLabel}</div>
      ${rows}
    </div>
  `
}

function renderLayerPanel(
  wrapper,
  state,
  piAvailable,
  onChange,
  aerialAvailable
) {
  const existing = document.getElementById(LAYER_PANEL_ID)
  if (existing) existing.remove()
  const panel = document.createElement('div')
  panel.id = LAYER_PANEL_ID
  panel.className = 'bhm-layer-panel'
  panel.setAttribute('aria-label', 'Map layers')
  const sections = [
    renderStageSection('baseline', 'Baseline', state),
    piAvailable ? renderStageSection('pi', 'Post-intervention', state) : ''
  ].join('')
  panel.innerHTML = `
    <div class="bhm-layer-panel__title">Layers</div>
    ${renderRedLineRow(state)}
    ${aerialAvailable ? renderBaseMapSection(state) : ''}
    ${sections}
  `
  wrapper.appendChild(panel)
  panel.addEventListener('change', (event) => {
    const target = event.target
    if (!target || target.type !== 'checkbox') return
    const layer = target.dataset?.layer
    const stage = target.dataset?.stage
    if (!layer) return
    if (layer === 'redLine') {
      state.redLine = target.checked
    } else if (layer === 'aerial') {
      state.aerial = target.checked
    } else if (stage && state[layer]) {
      state[layer][stage] = target.checked
    }
    onChange()
  })
}

// ---------------------------------------------------------------------------
// Legend overlay — a second map overlay describing what each visible fill,
// pattern and line stroke means. Only entries that actually appear in the
// loaded data are shown, so the panel scales with the project rather than
// listing the entire palette.
// ---------------------------------------------------------------------------

const SWATCH_W = 22
const SWATCH_H = 14

function svgWrap(inner) {
  return `<svg width="${SWATCH_W}" height="${SWATCH_H}" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">${inner}</svg>`
}

function broadSwatchSvg(fill, stroke) {
  return svgWrap(
    `<rect width="${SWATCH_W}" height="${SWATCH_H}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`
  )
}

function detailedSwatchOverlay(name, fg) {
  if (name === PATTERNS.CROSS_HATCH) {
    return `<path d="M0 0L${SWATCH_W} ${SWATCH_H}M${SWATCH_W} 0L0 ${SWATCH_H}" stroke="${fg}" stroke-width="1" fill="none"/>`
  }
  if (name === PATTERNS.HORIZONTAL) {
    return `<path d="M0 4L${SWATCH_W} 4M0 10L${SWATCH_W} 10" stroke="${fg}" stroke-width="1" fill="none"/>`
  }
  if (name === PATTERNS.VERTICAL) {
    return `<path d="M6 0L6 ${SWATCH_H}M16 0L16 ${SWATCH_H}" stroke="${fg}" stroke-width="1" fill="none"/>`
  }
  if (name === PATTERNS.DOTS) {
    return `<circle cx="5" cy="4" r="1.3" fill="${fg}"/><circle cx="11" cy="10" r="1.3" fill="${fg}"/><circle cx="17" cy="4" r="1.3" fill="${fg}"/>`
  }
  return ''
}

function detailedSwatchSvg(entry) {
  const base = `<rect width="${SWATCH_W}" height="${SWATCH_H}" fill="${entry.fillPatternBackgroundColor}" stroke="${entry.stroke}" stroke-width="0.5"/>`
  const overlay = detailedSwatchOverlay(
    entry.fillPattern,
    entry.fillPatternForegroundColor
  )
  return svgWrap(base + overlay)
}

function lineSwatchSvg(stroke, dashArray) {
  const dash = dashArray ? `stroke-dasharray="${dashArray.join(' ')}"` : ''
  const mid = SWATCH_H / 2
  return svgWrap(
    `<line x1="1" y1="${mid}" x2="${SWATCH_W - 1}" y2="${mid}" stroke="${stroke}" stroke-width="2.5" ${dash}/>`
  )
}

function collectUniqueValues(payloads, layerKey, propertyName) {
  const values = new Set()
  for (const stage of [payloads.baseline, payloads.postIntervention]) {
    for (const feature of stage?.[layerKey]?.features ?? []) {
      const value = feature.properties?.[propertyName]
      if (value) values.add(value)
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b))
}

function collectLegendEntries(payloads) {
  const broadValues = collectUniqueValues(
    payloads,
    'areaHabitats',
    'broadHabitatType'
  )
  const detailedValues = collectUniqueValues(
    payloads,
    'areaHabitats',
    'habitatType'
  ).filter((name) => detailedHabitatPalette[name])
  const hedgerowValues = collectUniqueValues(
    payloads,
    'hedgerows',
    'habitatType'
  )
  const watercourseValues = collectUniqueValues(
    payloads,
    'watercourses',
    'habitatType'
  )
  return {
    broad: broadValues,
    detailed: detailedValues,
    hedgerows: hedgerowValues,
    watercourses: watercourseValues
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function legendRow(swatchSvg, label) {
  return `<div class="bhm-legend__entry">${swatchSvg}<span class="bhm-legend__label">${escapeHtml(label)}</span></div>`
}

function renderBroadSection(values) {
  if (values.length === 0) return ''
  const rows = values
    .map((name) => {
      const entry = broadHabitatPalette[name]
      const swatch = entry
        ? broadSwatchSvg(entry.fill, entry.stroke)
        : broadSwatchSvg('#cccccc', '#666666')
      return legendRow(swatch, name)
    })
    .join('')
  return `<div class="bhm-legend__group"><div class="bhm-legend__group-title">Area habitats</div>${rows}</div>`
}

function renderDetailedSection(values) {
  if (values.length === 0) return ''
  const rows = values
    .map((name) => {
      const entry = detailedHabitatPalette[name]
      return legendRow(detailedSwatchSvg(entry), name)
    })
    .join('')
  return `<div class="bhm-legend__group"><div class="bhm-legend__group-title">Detailed habitats</div>${rows}</div>`
}

function renderLinearSection(title, values, palette) {
  if (values.length === 0) return ''
  const rows = values
    .map((name) => {
      const entry = palette[name]
      const swatch = entry
        ? lineSwatchSvg(entry.stroke, entry.dashArray)
        : lineSwatchSvg('#666666')
      return legendRow(swatch, name)
    })
    .join('')
  return `<div class="bhm-legend__group"><div class="bhm-legend__group-title">${escapeHtml(title)}</div>${rows}</div>`
}

function renderLegendPanel(wrapper, entries) {
  const totalEntries =
    entries.broad.length +
    entries.detailed.length +
    entries.hedgerows.length +
    entries.watercourses.length
  if (totalEntries === 0) return
  const existing = document.getElementById(LEGEND_ID)
  if (existing) existing.remove()
  const panel = document.createElement('div')
  panel.id = LEGEND_ID
  panel.className = 'bhm-legend'
  panel.setAttribute('aria-label', 'Map legend')
  panel.innerHTML = `
    <div class="bhm-legend__title">Legend</div>
    ${renderBroadSection(entries.broad)}
    ${renderDetailedSection(entries.detailed)}
    ${renderLinearSection('Hedgerows', entries.hedgerows, hedgerowPalette)}
    ${renderLinearSection('Watercourses', entries.watercourses, watercoursePalette)}
  `
  wrapper.appendChild(panel)
}

// ---------------------------------------------------------------------------
// Highlight + table wiring. The habitat-list page shows one table per data
// layer for whichever stage the page is built around. We search both stages
// when resolving a ref, preferring the page's primary stage so that ties go
// to the table the user is looking at.
// ---------------------------------------------------------------------------

function findFeatureByRef(payloads, primaryStage, ref) {
  const order =
    primaryStage === 'postIntervention'
      ? ['postIntervention', 'baseline']
      : ['baseline', 'postIntervention']
  for (const stage of order) {
    const payload = payloads[stage]
    if (!payload) continue
    for (const key of ['areaHabitats', 'hedgerows', 'watercourses']) {
      const feature = payload[key]?.features?.find(
        (f) => f.properties?.ref === ref
      )
      if (feature) return { feature, layer: key, stage }
    }
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

function fitToFeatureBounds(map, geometry) {
  const bbox = extendBounds(null, geometry)
  if (!bbox) return
  map.fitBounds(
    [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]]
    ],
    { padding: 64, maxZoom: 17, duration: 250 }
  )
}

function wireTableToMap(map, payloads, primaryStage) {
  annotateTableRowsWithRef()
  document.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-ref]')
    if (!row) return
    if (event.target.closest('a, button, input')) return
    const ref = row.dataset.ref
    const found = findFeatureByRef(payloads, primaryStage, ref)
    if (!found) return
    event.preventDefault()
    setHighlight(map, found.feature)
    highlightRowByRef(ref)
    fitToFeatureBounds(map, found.feature.geometry)
  })
}

function wireMapToTable(map, registry) {
  const clickableLayers = [
    ...Object.values(registry.baselineFull).flat(),
    ...Object.values(registry.piFull).flat()
  ]
  for (const layerId of clickableLayers) {
    map.on('click', layerId, (e) => {
      const feature = e.features?.[0]
      if (!feature) return
      const ref = feature.properties?.ref
      if (!ref) return
      setHighlight(map, feature)
      highlightRowByRef(ref)
    })
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = ''
    })
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

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

async function loadAllPayloads(geometryUrl, postInterventionGeometryUrl) {
  const payloads = { baseline: null, postIntervention: null }
  payloads.baseline = await loadGeometry(geometryUrl)
  if (postInterventionGeometryUrl) {
    payloads.postIntervention = await loadGeometry(
      postInterventionGeometryUrl
    ).catch((err) => {
      // PI is optional — if the project hasn't been through PI yet, the
      // endpoint may return 404 or no features. Log and fall back to
      // baseline-only rendering.
      console.warn('[baseline-habitat-map] post-intervention fetch failed', err)
      return null
    })
  }
  return payloads
}

function payloadHasAnyFeatures(payload) {
  if (!payload) return false
  return (
    Boolean(payload.redLine?.features?.length) ||
    Boolean(payload.areaHabitats?.features?.length) ||
    Boolean(payload.hedgerows?.features?.length) ||
    Boolean(payload.watercourses?.features?.length)
  )
}

export async function initBaselineHabitatMap() {
  const container = document.getElementById(CONTAINER_ID)
  if (!container) return

  const {
    geometryUrl,
    postInterventionGeometryUrl,
    osStyleUrl,
    aerialUrl,
    stage: stageAttr
  } = container.dataset
  if (!geometryUrl || !osStyleUrl) {
    console.warn('[baseline-habitat-map] missing data-* attributes; skipping')
    return
  }
  const primaryStage =
    stageAttr === 'postIntervention' ? 'postIntervention' : 'baseline'

  const defraApi = getDefraApi()
  if (!defraApi) {
    console.warn('[baseline-habitat-map] @defra/interactive-map not loaded')
    return
  }

  let payloads
  try {
    payloads = await loadAllPayloads(geometryUrl, postInterventionGeometryUrl)
  } catch (err) {
    console.error('[baseline-habitat-map] failed to load geometries', err)
    container.innerHTML =
      '<p class="govuk-body">Map unavailable — could not load geometries.</p>'
    return
  }

  const piAvailable = payloadHasAnyFeatures(payloads.postIntervention)
  const aerialAvailable = Boolean(aerialUrl)
  const wrapper = ensureMapWrapper(container)

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

  const state = buildInitialState(piAvailable)
  const registry = createLayerRegistry()

  interactiveMap.on('map:ready', (event) => {
    const map = event?.map
    if (!map) {
      console.warn('[baseline-habitat-map] map:ready event had no map instance')
      return
    }
    runWhenStyleReady(map, async () => {
      try {
        await renderAll(map, payloads, registry, aerialUrl)
        applyVisibility(map, registry, state, piAvailable)
        renderLayerPanel(
          wrapper,
          state,
          piAvailable,
          () => {
            applyVisibility(map, registry, state, piAvailable)
            setHighlight(map, null)
            highlightRowByRef(null)
          },
          aerialAvailable
        )
        renderLegendPanel(wrapper, collectLegendEntries(payloads))
        wireTableToMap(map, payloads, primaryStage)
        wireMapToTable(map, registry)
      } catch (err) {
        console.error('[baseline-habitat-map] failed to add layers', err)
      }
    })
  })
}
