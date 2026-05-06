import { config } from '../../config/config.js'
import { wreck } from '../common/helpers/wreck-client.js'

const backendUrl = config.get('backend').url

export const dbInfoController = {
  async handler(_request, h) {
    const { payload: data } = await wreck.get(`${backendUrl}/db-info`)

    return h.view('db-info/index', {
      pageTitle: 'DB Info',
      heading: 'Database Info',
      dbInfo: JSON.stringify(data, null, 2)
    })
  }
}
