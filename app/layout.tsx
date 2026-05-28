// Este arquivo e a "moldura" de todas as paginas do site.
// Ele coloca o ClerkProvider em volta da aplicacao para que login, usuario e seguranca funcionem em qualquer tela.
// Tambem define titulo, descricao e regra para buscadores nao indexarem a ferramenta.
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { ptBR } from '@clerk/localizations';
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
    <ClerkProvider localization={ptBR}>
      <html lang="pt-BR">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
