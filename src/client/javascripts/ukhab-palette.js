// BMD-546 / BMD-559: UK Habitat Classification colours, plus matching
// palettes for the non-UKHab hedgerow and watercourse classifications used
// by the BNG metric. Keys here are matched verbatim against the GeoJSON
// property values the backend attaches to each feature (see
// src/routes/geometry.js). When a feature's value isn't in the
// palette the sublayer factory emits an "Other" catch-all sublayer.

const STROKE_DARKEN_AMOUNT = 0.2

function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

function parseHex(hex) {
  const cleaned = hex.replace('#', '')
  return [
    parseInt(cleaned.slice(0, 2), 16),
    parseInt(cleaned.slice(2, 4), 16),
    parseInt(cleaned.slice(4, 6), 16)
  ]
}

function toHex(component) {
  return clamp(Math.round(component), 0, 255).toString(16).padStart(2, '0')
}

// Multiplicative darken: strokes are ~20% darker than fills, matching the
// guidance in the BMD-546 spike doc. Avoid hand-coding two hexes per entry.
export function darken(hex, amount = STROKE_DARKEN_AMOUNT) {
  const [r, g, b] = parseHex(hex)
  const factor = 1 - amount
  return `#${toHex(r * factor)}${toHex(g * factor)}${toHex(b * factor)}`
}

function fillEntry(fill, stroke) {
  return { fill, stroke: stroke ?? darken(fill) }
}

function strokeEntry(stroke, extras = {}) {
  return { stroke, ...extras }
}

// UKHab Level 3 — broad habitats. Colour hex values come from the
// Skipper-is/UKHAB-QGIS style pack and the NE BNG palette referenced in
// the spike doc; keep the keys spelt exactly as they appear in the
// GeoPackage so palette[value] is a direct lookup.
export const broadHabitatPalette = {
  Cropland: fillEntry('#e6c87a'),
  Grassland: fillEntry('#98f05d'),
  'Heathland and shrub': fillEntry('#8268d6'),
  'Woodland and forest': fillEntry('#33a02c'),
  Wetland: fillEntry('#1f78b4'),
  Lakes: fillEntry('#6db8e1'),
  'Rivers and streams': fillEntry('#3b8bba'),
  'Coastal lagoons': fillEntry('#6db8e1'),
  Urban: fillEntry('#ec2244'),
  'Sparsely vegetated land': fillEntry('#cbb59d'),
  'Rocky shore': fillEntry('#cbb59d'),
  'Hard structures': fillEntry('#9e9e9e'),
  'Individual trees': fillEntry('#2e7d32'),
  'Intertidal sediment': fillEntry('#a98e5c'),
  Saltmarsh: fillEntry('#cdd76c'),
  'Marine inlets and transitional waters': fillEntry('#4f9fbe')
}

// Hedgerow types — stroke only (rendered as a line). Keys match the
// canonical "Baseline Hedge Type" values produced by the Natural England
// QGIS template (see HEDGE_TYPES in bng-lib's synthetic-constants).
export const hedgerowPalette = {
  'Native hedgerow': strokeEntry('#3f7a2a'),
  'Species-rich native hedgerow': strokeEntry('#1b5e20'),
  'Native hedgerow with trees': strokeEntry('#2e7d32'),
  'Species-rich native hedgerow with trees': strokeEntry('#0d4012'),
  'Native hedgerow - associated with bank or ditch': strokeEntry('#5d8231'),
  'Non-native and ornamental hedgerow': strokeEntry('#a98e5c'),
  'Line of trees': strokeEntry('#4caf50')
}

// Watercourse types — stroke plus optional dashArray for enhanced reaches.
// Keys match the canonical "Baseline River Type" values (see RIVER_TYPES
// in bng-lib's synthetic-constants).
export const watercoursePalette = {
  'Priority habitat': strokeEntry('#0d47a1'),
  'Other rivers and streams': strokeEntry('#1976d2'),
  Canals: strokeEntry('#4fc3f7'),
  Culvert: strokeEntry('#90a4ae'),
  Ditches: strokeEntry('#26a69a')
}

// Urban tree dimensions — fill + stroke for circles. PI introduces
// "Proposed" and "Lost" states.
export const urbanTreePalette = {
  Existing: fillEntry('#2e7d32'),
  Proposed: fillEntry('#7bc36b'),
  Lost: fillEntry('#9e9e9e')
}

const FALLBACK_FILL = fillEntry('#cccccc')
const FALLBACK_STROKE = strokeEntry('#666666')

function sublayerFromFillPaletteEntry(name, entry, property) {
  return {
    id: `broad-${name}`,
    label: name,
    filter: ['==', ['get', property], name],
    style: {
      fill: entry.fill,
      stroke: entry.stroke,
      strokeWidth: 1
    }
  }
}

function sublayerFromStrokePaletteEntry(name, entry, property, prefix) {
  const style = {
    stroke: entry.stroke,
    strokeWidth: 2
  }
  if (entry.dashArray) {
    style.dashArray = entry.dashArray
  }
  return {
    id: `${prefix}-${name}`,
    label: name,
    filter: ['==', ['get', property], name],
    style
  }
}

function makeFillSublayerFactory(palette, prefix, fallback = FALLBACK_FILL) {
  return (property) => {
    const known = Object.keys(palette)
    const sublayers = Object.entries(palette).map(([name, entry]) =>
      sublayerFromFillPaletteEntry(name, entry, property)
    )
    sublayers.push({
      id: `${prefix}-other`,
      label: 'Other',
      filter: ['!', ['in', ['get', property], ['literal', known]]],
      style: {
        fill: fallback.fill,
        stroke: fallback.stroke,
        strokeWidth: 1
      }
    })
    return sublayers
  }
}

function makeStrokeSublayerFactory(
  palette,
  prefix,
  fallback = FALLBACK_STROKE
) {
  return (property) => {
    const known = Object.keys(palette)
    const sublayers = Object.entries(palette).map(([name, entry]) =>
      sublayerFromStrokePaletteEntry(name, entry, property, prefix)
    )
    sublayers.push({
      id: `${prefix}-other`,
      label: 'Other',
      filter: ['!', ['in', ['get', property], ['literal', known]]],
      style: {
        stroke: fallback.stroke,
        strokeWidth: 2
      }
    })
    return sublayers
  }
}

export const broadHabitatSublayers = makeFillSublayerFactory(
  broadHabitatPalette,
  'broad'
)

export const hedgerowSublayers = makeStrokeSublayerFactory(
  hedgerowPalette,
  'hedge'
)

export const watercourseSublayers = makeStrokeSublayerFactory(
  watercoursePalette,
  'water'
)

export const urbanTreeSublayers = makeFillSublayerFactory(
  urbanTreePalette,
  'tree'
)

// Named patterns supported by the renderer (see baseline-habitat-map.js).
// Keep this list and the SVG generators in baseline-habitat-map.js in sync —
// adding a new pattern means adding both an entry here and a generator.
export const PATTERNS = {
  CROSS_HATCH: 'diagonal-cross-hatch',
  HORIZONTAL: 'horizontal-hatch',
  VERTICAL: 'vertical-hatch',
  DOTS: 'dot'
}

// Level 4 (UK BAP priority habitat) palette. Each entry sits *over* the broad
// colour declared in `broadHabitatPalette` — `fillPatternBackgroundColor`
// inherits the broad fill verbatim, so when the detailed layer paints on top
// the broad colour reads through unchanged. The pattern colour is a darker
// shade of the broad fill (derived programmatically) so the two stay in the
// same hue family.
function detailedEntry(broadName, fillPattern) {
  const broad = broadHabitatPalette[broadName]
  const bg = broad?.fill ?? '#cccccc'
  return {
    fillPattern,
    fillPatternForegroundColor: darken(bg, 0.45),
    fillPatternBackgroundColor: bg,
    stroke: darken(bg, 0.45)
  }
}

export const detailedHabitatPalette = {
  // Grassland
  'Modified grassland': detailedEntry('Grassland', PATTERNS.DOTS),
  'Lowland meadows': detailedEntry('Grassland', PATTERNS.CROSS_HATCH),
  'Lowland dry acid grassland': detailedEntry('Grassland', PATTERNS.HORIZONTAL),
  'Lowland calcareous grassland': detailedEntry('Grassland', PATTERNS.VERTICAL),
  'Upland acid grassland': detailedEntry('Grassland', PATTERNS.HORIZONTAL),
  'Other neutral grassland': detailedEntry('Grassland', PATTERNS.DOTS),
  // Cropland
  'Cereal crops': detailedEntry('Cropland', PATTERNS.VERTICAL),
  'Non-cereal crops': detailedEntry('Cropland', PATTERNS.HORIZONTAL),
  'Temporary grass and clover leys': detailedEntry('Cropland', PATTERNS.DOTS),
  Horticulture: detailedEntry('Cropland', PATTERNS.CROSS_HATCH),
  // Heathland and shrub
  'Mixed scrub': detailedEntry('Heathland and shrub', PATTERNS.DOTS),
  'Bramble scrub': detailedEntry('Heathland and shrub', PATTERNS.CROSS_HATCH),
  'Hawthorn scrub': detailedEntry('Heathland and shrub', PATTERNS.HORIZONTAL),
  // Woodland and forest
  'Lowland mixed deciduous woodland': detailedEntry(
    'Woodland and forest',
    PATTERNS.DOTS
  ),
  'Wet woodland': detailedEntry('Woodland and forest', PATTERNS.HORIZONTAL),
  'Other broadleaved woodland': detailedEntry(
    'Woodland and forest',
    PATTERNS.CROSS_HATCH
  ),
  'Other coniferous woodland': detailedEntry(
    'Woodland and forest',
    PATTERNS.VERTICAL
  ),
  // Urban
  'Developed land; sealed surface': detailedEntry(
    'Urban',
    PATTERNS.CROSS_HATCH
  ),
  'Vacant/derelict land': detailedEntry('Urban', PATTERNS.DOTS),
  'Built linear features': detailedEntry('Urban', PATTERNS.VERTICAL),
  // Wetland
  Reedbeds: detailedEntry('Wetland', PATTERNS.VERTICAL),
  'Lowland fens': detailedEntry('Wetland', PATTERNS.HORIZONTAL)
}

function slugForId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Factory mirrors the broad-habitat one. The level-4 palette only covers a
// representative subset of UKHab; uncovered features get no pattern overlay
// and read through to the broad colour painted underneath.
export const detailedHabitatSublayers = (property) =>
  Object.entries(detailedHabitatPalette).map(([name, entry]) => ({
    id: `detailed-${slugForId(name)}`,
    label: name,
    filter: ['==', ['get', property], name],
    style: {
      fillPattern: entry.fillPattern,
      fillPatternForegroundColor: entry.fillPatternForegroundColor,
      fillPatternBackgroundColor: entry.fillPatternBackgroundColor,
      stroke: entry.stroke,
      strokeWidth: 1
    }
  }))
