import type { Metadata } from 'next';
import './globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { htmlLang, type Locale } from '@/i18n/locales';

export const metadata: Metadata = {
  title: 'e-Click | Inteligência Comercial',
  description: 'Plataforma de inteligência comercial e-Click',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={htmlLang[locale as Locale] ?? 'pt-BR'} suppressHydrationWarning>
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
        <NextIntlClientProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
