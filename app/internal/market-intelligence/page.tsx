import type { Metadata } from 'next';
import { MarketIntelligenceApp } from '@/components/MarketIntelligenceApp';

export const metadata: Metadata = {
  title: 'Inteligência de Mercado | My Robot',
  robots: {
    index: false,
    follow: false
  }
};

export default function MarketIntelligencePage() {
  return <MarketIntelligenceApp />;
}
