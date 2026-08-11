function defaultUploadReturnUrl(projectId) {
  return `/add-project-details/${projectId}`
}

function safeUploadReturnUrl(returnUrl, projectId) {
  if (
    typeof returnUrl !== 'string' ||
    !returnUrl.startsWith('/') ||
    returnUrl.startsWith('//') ||
    returnUrl.includes('\\')
  ) {
    return defaultUploadReturnUrl(projectId)
  }

  return returnUrl
}

function uploadFileHref(projectId, returnUrl) {
  const safeReturnUrl = safeUploadReturnUrl(returnUrl, projectId)
  const params = new URLSearchParams({ returnUrl: safeReturnUrl })
  return `/projects/${projectId}/upload-file?${params.toString()}`
}

function selectedUploadHref(projectId, uploadRoute, returnUrl) {
  const params = new URLSearchParams({
    returnUrl: safeUploadReturnUrl(returnUrl, projectId)
  })
  return `/projects/${projectId}/${uploadRoute}?${params.toString()}`
}

export {
  defaultUploadReturnUrl,
  safeUploadReturnUrl,
  selectedUploadHref,
  uploadFileHref
}
