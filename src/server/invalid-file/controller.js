export const invalidFileController = {
  handler(_request, h) {
    return h.view('invalid-file/index', {
      pageTitle: 'Dropout Page'
    })
  }
}
