import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

export const metadata: Metadata = {
  title: 'e-Click | Inteligência Comercial',
  description: 'Plataforma de inteligência comercial e-Click',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      {/* Inline script seta data-theme antes do React hydratar — evita
          flash de tema errado (FOUC) quando user salvou 'light' mas
          SSR sempre devolve 'dark'. Roda síncrono no <head>. */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('eclick-theme') || 'dark';
                document.documentElement.setAttribute('data-theme', t);
                document.documentElement.style.colorScheme = t;
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
