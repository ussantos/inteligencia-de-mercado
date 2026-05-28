// Esta rota antiga continua existindo para nao quebrar favoritos ou links ja compartilhados.
// Em vez de duplicar a tela principal, ela manda a pessoa para a raiz "/", onde a ferramenta roda agora.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Inteligência de Mercado',
  robots: {
    index: false,
    follow: false
  }
};

export default function MarketIntelligencePage() {
  redirect('/');
}
