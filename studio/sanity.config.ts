import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { codeInput } from '@sanity/code-input'
import { schemaTypes } from './schemas'
import { deskStructure } from './deskStructure'

/**
 * e-Click Blog Studio.
 *
 * projectId/dataset vêm das envs SANITY_STUDIO_PROJECT_ID / SANITY_STUDIO_DATASET.
 * Definidas no .env do Studio (ver .env.example) — preencher com as creds reais.
 */
export default defineConfig({
  name: 'eclick-blog',
  title: 'e-Click Blog Studio',

  projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'MISSING_PROJECT_ID',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',

  plugins: [
    structureTool({ structure: deskStructure }),
    visionTool({ defaultApiVersion: '2024-10-01' }),
    codeInput(),
  ],

  schema: {
    types: schemaTypes,
  },
})
