import { MAX_PROJECT_NAME_LENGTH } from '../../src/server/common/helpers/project-name.js'
import { MAX_REF_LENGTH } from '../../src/server/post-intervention-habitat-details/constants.js'
import { MAX_TEXT_FIELD_LENGTH } from '../../src/server/project-details/constants.js'
import {
  MAX_FILENAME_LENGTH,
  MAX_FILE_SIZE_LABEL
} from '../../src/shared/file-checks.js'

// What each {name} in error-text.yaml stands for, and where each
// [link text](target) goes, in words a reviewer of the wording can read. A
// test fails when the file gains a {name} or a target that has none here.

/** What a {name} is filled in with, wherever the file names it. */
export const PLACEHOLDERS = Object.freeze({
  actualType: 'the data type the column has in the file',
  applicationId:
    "the file's GeoPackage identifier (application_id), in hexadecimal",
  area: 'an area: in square metres for a parcel, part of a parcel or a sliver, and for a vertical area habitat its Area (ha) as the file gives it',
  areaSqM: "the red line boundary's area, in square metres",
  bands: 'the distinctiveness bands the service accepts',
  childArea:
    'the Area of the post-intervention vertical area habitats linked to the baseline one, together',
  childCount:
    'how many trees the Retained and Enhanced post-intervention trees linked to the baseline tree stand for, together',
  childLength:
    'the length of the post-intervention hedgerows linked to the baseline hedgerow, together, in metres',
  childRefs:
    'the Habitat Refs of the post-intervention habitats linked to the baseline habitat, separated by commas',
  column: 'the name of a column in the layer',
  condition: "the habitat's condition",
  contentsSrsId:
    'the spatial reference system id the gpkg_contents table gives the layer',
  count:
    'how many: on a page worded for several, how many habitats the error names; for a tree, how many trees the baseline tree stands for, its Count',
  distinctiveness: "the habitat's distinctiveness, such as Very high",
  expected: 'what the template expects',
  expectedSrsId: 'the spatial reference system id the template expects',
  expectedType: 'the data type the template expects for the column',
  feature:
    'the habitat, by its Feature Ref, or else its fid or its place in the file',
  featureA:
    'the first of the two overlapping parcels, by its Feature Ref, or else its fid or its place in the file',
  featureB:
    'the second of the two overlapping parcels, by its Feature Ref, or else its fid or its place in the file',
  featureCount:
    "the number of features in the file's boundary, habitat, hedgerow and watercourse layers",
  featureRef:
    "the habitat's Feature Ref, or a BNG Service template tree's Habitat Ref",
  fid: "the feature's fid, its row id in the file",
  fileLabel: 'the kind of file uploaded, such as baseline',
  found: 'what the file has instead',
  foundSrsId: 'the spatial reference system id the file has',
  geometryColumnsSrsId:
    'the spatial reference system id the gpkg_geometry_columns table gives the layer',
  habitatType: 'the habitat type',
  habitatsAreaSqM: "the area habitats' total area, in square metres",
  idx: "the feature's place in its layer",
  layer: 'the name of a layer in the file',
  length: "the baseline hedgerow's length, in metres",
  location: 'where the problem is, as coordinates',
  max: 'the limit the page applies',
  maxFeatureCount: 'the most features the service can check',
  name: 'the habitat, by its Habitat Ref, or else its fid',
  onlyLayer:
    'the layer of the one habitat the problem names; unknown when it names several',
  onlyRef:
    'the Habitat Ref, or else fid, of the one habitat the problem names; unknown when it names several',
  parentRef: 'the Habitat Ref of the baseline habitat it was copied from',
  sharedLayer:
    'the layer every habitat the problem names is in; unknown when they are in more than one, or some are not shown',
  part: 'the part of the date left blank: day, month or year',
  parts: 'the parts of the date left blank, such as "day and month"',
  reason: 'why the shape is not valid, as the geometry check words it',
  recordCount: 'the number of template version records in the file',
  redlineAreaSqM: "the red line boundary's area, in square metres",
  ref: "the habitat's Habitat Ref",
  refA: 'the Habitat Ref of the first of the two overlapping parcels',
  refB: 'the Habitat Ref of the second of the two overlapping parcels',
  rowCount:
    'the number of retained or enhanced rows with no baseline habitat type',
  seconds:
    "how long to wait before trying again, in whole seconds: the backend's Retry-After when a rate limit refused the request",
  supportedVersions: 'the template versions the service reads',
  table: 'the template table the habitat is in',
  tree: 'the tree, by its Habitat Ref, or else its fid or its place in the file',
  version: 'the template version the file gives'
})

/**
 * What a {name} is filled in with in one entry, by error ID, where that is
 * not what PLACEHOLDERS says. A limit is read from the constant the page
 * applies, so the number here cannot drift from the code's.
 */
// The text-value problems (BMD-1175) name each value that fails by its
// table, habitat and column.
const TEXT_VALUE_PLACEHOLDERS = Object.freeze({
  feature: 'the habitat, by its Habitat Ref, or else its fid',
  column: 'the name of the column the value is in'
})

export const ENTRY_PLACEHOLDERS = Object.freeze({
  GPKG_MISSING_SYSTEM_TABLE: { table: 'the name of the missing system table' },
  BASELINE_HABITATS_INCOMPLETE: {
    layer:
      'the layer the habitat is in, as the page names it: Habitat parcels, Hedgerows or Watercourses'
  },
  TEXT_TOO_LONG: {
    ...TEXT_VALUE_PLACEHOLDERS,
    length:
      'how many characters the value has, once spaces at its start and end are removed',
    limit:
      'the most characters the column can hold: 99 for a reference, Location and a drop-down, 255 for Spatial risk category, 999 for a comment and the other site details'
  },
  VALUE_NOT_ALLOWED: {
    ...TEXT_VALUE_PLACEHOLDERS,
    value:
      'the value the file holds, cut to 99 characters; the part naming it is left out for a value that is not text'
  },
  FEATURE_UUID_INVALID: TEXT_VALUE_PLACEHOLDERS,
  PARENT_UUID_INVALID: TEXT_VALUE_PLACEHOLDERS,
  PARENT_GEOM_INVALID: {
    ...TEXT_VALUE_PLACEHOLDERS,
    shape: "the shape of the habitat's layer, such as polygon"
  },
  STORED_VALUE_NOT_ALLOWED: {
    fields:
      'the fields that hold the older value, in plain words, such as "habitat reference and proposed condition"'
  },
  'upload.page.more': { count: 'how many habitats the list leaves out' },
  'forms.projectName.tooLong': {
    max: `the most characters a project name can have: ${MAX_PROJECT_NAME_LENGTH}`
  },
  'forms.surveyCompleters.tooLong': {
    max: `the most characters the answer can have: ${MAX_TEXT_FIELD_LENGTH}`
  },
  'forms.applicant.tooLong': {
    max: `the most characters the answer can have: ${MAX_TEXT_FIELD_LENGTH}`
  },
  'forms.habitatRef.tooLong': {
    max: `the most characters a habitat reference can have: ${MAX_REF_LENGTH}`
  },
  'forms.file.tooLarge': {
    max: `the largest file the service takes: ${MAX_FILE_SIZE_LABEL}`
  },
  'forms.file.nameTooLong': {
    max: `the most characters a file name can have: ${MAX_FILENAME_LENGTH}`
  }
})

/** Where a [link text](target) goes. */
export const LINK_TARGET_NAMES = Object.freeze({
  upload: 'the upload page',
  'metric-tool':
    'the statutory biodiversity metric tools and guides, on GOV.UK',
  home: "the service's home page"
})
