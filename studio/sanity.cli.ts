import { defineCliConfig } from 'sanity/cli'

/**
 * Config do CLI do Sanity (sanity dev / build / deploy).
 *
 * projectId/dataset vêm das envs SANITY_STUDIO_*. Preencher .env (ver
 * .env.example) com as credenciais que o Silvio gerar em sanity.io.
 *
 * studioHost 'eclick-blog' publica o Studio em https://eclick-blog.sanity.studio
 * ao rodar `npm run deploy`. (CNAME pra studio.eclick.app.br é passo de DNS.)
 */
export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  },
  studioHost: 'eclick-blog',
  autoUpdates: true,
})
