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
