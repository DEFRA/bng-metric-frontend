export const getController = {
  handler(request, h) {
    const { id } = request.params

    return h.view('upload-result/upload-result', {
      pageTitle: 'File uploaded',
      heading: 'File uploaded successfully',
      projectId: id
    })
  }
}
