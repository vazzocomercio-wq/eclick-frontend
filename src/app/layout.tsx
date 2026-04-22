import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
