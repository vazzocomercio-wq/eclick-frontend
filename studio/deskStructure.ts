import type { StructureResolver } from 'sanity/structure'

/**
 * Estrutura do menu lateral do Studio. Organiza os posts por status editorial
 * (espelha o pipeline do Active) e separa os documentos de apoio.
 */
export const deskStructure: StructureResolver = (S) =>
  S.list()
    .title('Blog GEO')
    .items([
      S.listItem()
        .title('Posts')
        .child(
          S.list()
            .title('Posts por status')
            .items([
              S.listItem()
                .title('📝 Rascunhos')
                .child(
                  S.documentList()
                    .title('Rascunhos')
                    .filter('_type == "post" && status == "draft"')
                    .defaultOrdering([{ field: '_updatedAt', direction: 'desc' }]),
                ),
              S.listItem()
                .title('👀 Em revisão')
                .child(
                  S.documentList()
                    .title('Em revisão')
                    .filter('_type == "post" && status == "review"')
                    .defaultOrdering([{ field: '_updatedAt', direction: 'desc' }]),
                ),
              S.listItem()
                .title('✅ Aprovados')
                .child(
                  S.documentList()
                    .title('Aprovados')
                    .filter('_type == "post" && status == "approved"')
                    .defaultOrdering([{ field: '_updatedAt', direction: 'desc' }]),
                ),
              S.listItem()
                .title('🚀 Publicados')
                .child(
                  S.documentList()
                    .title('Publicados')
                    .filter('_type == "post" && status == "published"')
                    .defaultOrdering([{ field: 'publishedAt', direction: 'desc' }]),
                ),
              S.divider(),
              S.listItem()
                .title('Todos os posts')
                .child(S.documentTypeList('post').title('Todos os posts')),
            ]),
        ),
      S.divider(),
      S.documentTypeListItem('category').title('Categorias (pilares)'),
      S.documentTypeListItem('author').title('Autores'),
      S.documentTypeListItem('tag').title('Tags'),
      S.documentTypeListItem('series').title('Séries'),
    ])
