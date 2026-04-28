export const invalidFileController = {
  handler(request, h) {
    const baselineErrors = request.yar.get('baselineErrors') ?? []
    return h.view('invalid-file/index', {
      pageTitle: 'Dropout Page',
      baselineErrors
    })
  }
}
