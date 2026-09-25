function isSafeRelativePath(path) {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\')
  )
}

function defaultUploadReturnUrl(projectId) {
  return `/add-project-details/${projectId}`
}

function safeUploadReturnUrl(returnUrl, projectId) {
  return isSafeRelativePath(returnUrl)
    ? returnUrl
    : defaultUploadReturnUrl(projectId)
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
  isSafeRelativePath,
  safeUploadReturnUrl,
  selectedUploadHref,
  uploadFileHref
}
