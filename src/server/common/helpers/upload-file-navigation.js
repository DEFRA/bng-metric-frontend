const SAME_ORIGIN_BASE = 'http://localhost'
// Browsers strip tabs and newlines from URLs, so `/\t/evil.example` becomes
// the protocol-relative `//evil.example`. Reject every C0 control and DEL.
const LAST_C0_CONTROL_CODE = 0x1f
const DELETE_CODE = 0x7f

function hasControlCharacter(path) {
  return [...path].some((character) => {
    const code = character.codePointAt(0)
    return code <= LAST_C0_CONTROL_CODE || code === DELETE_CODE
  })
}

function resolvesToSameOrigin(path) {
  try {
    return new URL(path, SAME_ORIGIN_BASE).origin === SAME_ORIGIN_BASE
  } catch {
    return false
  }
}

function isSafeRelativePath(path) {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\') &&
    !hasControlCharacter(path) &&
    resolvesToSameOrigin(path)
  )
}

function defaultUploadReturnUrl(projectId) {
  return `/projects/${projectId}/project-summary`
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
