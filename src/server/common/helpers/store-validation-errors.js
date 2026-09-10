function storeValidationErrors(request, uploadType, projectId, errors) {
  request.yar.set(uploadType.validationErrorsSessionKey, errors)
  request.yar.set(uploadType.validationErrorsProjectIdSessionKey, projectId)
  request.yar.set(uploadType.validationUploadTypeSessionKey, uploadType.key)
}

export { storeValidationErrors }
