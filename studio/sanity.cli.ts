import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'avk9byrq',
    dataset: 'production',
  },
  studioHost: 'feroze-work',
  deployment: {
    autoUpdates: true,
  },
})
