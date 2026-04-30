export const invalidFileController = {
  handler(request, h) {
    const baselineErrors = request.yar.get('baselineErrors') ?? []
    const projectId = request.yar.get('baselineErrorsProjectId') ?? null

    // Errors are one-shot — clear them so a refresh or back-nav doesn't
    // resurrect a stale rejection.
    request.yar.clear('baselineErrors')
    request.yar.clear('baselineErrorsProjectId')

    return h.view('invalid-file/index', {
      pageTitle: 'There is a problem with your file',
      baselineErrors,
      projectId
    })
  }
}
