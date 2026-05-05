export const invalidFileController = {
  handler(request, h) {
    const baselineValidationErrors =
      request.yar.get('baselineValidationErrors') ?? []
    const projectId =
      request.yar.get('baselineValidationErrorsProjectId') ?? null

    // Errors are one-shot — clear them so a refresh or back-nav doesn't
    // resurrect a stale rejection.
    request.yar.clear('baselineValidationErrors')
    request.yar.clear('baselineValidationErrorsProjectId')

    const errorList = baselineValidationErrors.map((err) => ({
      text: err.message
    }))

    return h.view('invalid-file/index', {
      pageTitle: 'There is a problem with your file',
      errorList,
      projectId
    })
  }
}
