const { getController } = await import('./controller.js')

const createMockH = () => ({
  view: vi.fn().mockReturnThis(),
  redirect: vi.fn().mockReturnThis()
})

const createMockRequest = (projectId = 'proj-123') => ({
  params: { id: projectId }
})

describe('upload-result controller', () => {
  it('should render the upload result view with the correct data', () => {
    const h = createMockH()
    const request = createMockRequest()

    getController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith('upload-result/upload-result', {
      pageTitle: 'File uploaded',
      heading: 'File uploaded successfully',
      projectId: 'proj-123'
    })
  })

  it('should use the project id from request params', () => {
    const h = createMockH()
    const request = createMockRequest('proj-999')

    getController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'upload-result/upload-result',
      expect.objectContaining({
        projectId: 'proj-999'
      })
    )
  })
})
