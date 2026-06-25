import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    // Imagens do blog vêm do CDN do Sanity.
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.sanity.io' }],
  },
  async redirects() {
    return [
      {
        // Product OS migrou de Catálogo para Produção (links/favoritos antigos).
        source: '/dashboard/catalogo/product-os',
        destination: '/dashboard/producao/product-os',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
