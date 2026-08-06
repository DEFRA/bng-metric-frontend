const HABITAT_UPLOAD_TYPES = {
  baseline: {
    key: 'baseline',
    projectKey: 'baseline',
    label: 'baseline',
    isPostIntervention: false,
    pageHeading: 'On-site baseline habitats',
    detailsSectionHeading: 'Baseline Details',
    uploadPageTitle: 'Upload Baseline File',
    uploadInstruction:
      'Upload a GeoPackage (.gpkg) file containing a red line boundary and baseline habitat parcels.',
    uploadRoute: 'upload-baseline-file',
    uploadReceivedRoute: 'upload-received',
    validatingRoute: 'validating-baseline',
    listRoute: 'baseline-habitat-list',
    listView: 'habitat-list/habitat-list',
    detailsRoute: 'baseline-habitat-details',
    backendValidatePath: 'baseline',
    backendFeaturePath: (projectId, featureId) =>
      `projects/${projectId}/features/${featureId}`,
    backendSavePath: (projectId, featureId) =>
      `projects/${projectId}/features/${featureId}`,
    pendingUploadSessionKey: 'pendingUploadId',
    uploadStartedAtSessionKey: 'uploadStartedAt',
    pendingJobIdSessionKey: 'pendingValidationJobId',
    validationStartedAtSessionKey: 'validationStartedAt',
    uploadErrorSessionKey: 'uploadError',
    validationErrorsSessionKey: 'baselineValidationErrors',
    validationErrorsProjectIdSessionKey: 'baselineValidationErrorsProjectId',
    validationUploadTypeSessionKey: 'validationUploadType'
  },
  postIntervention: {
    key: 'postIntervention',
    projectKey: 'postIntervention',
    label: 'post-intervention',
    isPostIntervention: true,
    pageHeading: 'On-site post intervention habitats',
    detailsSectionHeading: 'Post-intervention Details',
    uploadPageTitle: 'Upload Post-intervention File',
    uploadInstruction:
      'Upload a GeoPackage (.gpkg) file containing a red line boundary and post-intervention habitat parcels.',
    uploadRoute: 'upload-post-intervention-file',
    uploadReceivedRoute: 'post-intervention-upload-received',
    validatingRoute: 'validating-post-intervention',
    listRoute: 'post-intervention-habitat-list',
    listView: 'habitat-list/habitat-list',
    detailsRoute: 'post-intervention-habitat-details',
    backendValidatePath: 'post-intervention',
    backendFeaturePath: (projectId, featureId) =>
      `projects/${projectId}/post-intervention/features/${featureId}`,
    backendSavePath: (projectId, featureId) =>
      `projects/${projectId}/post-intervention/habitats/${featureId}`,
    pendingUploadSessionKey: 'postInterventionPendingUploadId',
    uploadStartedAtSessionKey: 'postInterventionUploadStartedAt',
    pendingJobIdSessionKey: 'postInterventionPendingValidationJobId',
    validationStartedAtSessionKey: 'postInterventionValidationStartedAt',
    uploadErrorSessionKey: 'postInterventionUploadError',
    validationErrorsSessionKey: 'postInterventionValidationErrors',
    validationErrorsProjectIdSessionKey:
      'postInterventionValidationErrorsProjectId',
    validationUploadTypeSessionKey: 'validationUploadType'
  }
}

function getHabitatUploadType(key) {
  return HABITAT_UPLOAD_TYPES[key]
}

export { HABITAT_UPLOAD_TYPES, getHabitatUploadType }
