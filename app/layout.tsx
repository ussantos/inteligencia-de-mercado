// Este arquivo e a "moldura" de todas as paginas do site.
// A ferramenta principal e publica, entao nao envolvemos a aplicacao com login.
// Tambem define titulo, descricao e regra para buscadores nao indexarem a ferramenta.
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Inteligência de Mercado',
  description: 'Ferramenta independente de análise regional, concorrência e oportunidade para qualquer tipo de empresa.',
  robots: {
    index: false,
    follow: false
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
