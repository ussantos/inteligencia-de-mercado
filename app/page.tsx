// Esta e a pagina inicial do site.
// Quando alguem acessa a raiz "/", mostramos diretamente a ferramenta principal.
// Pense nela como a porta da frente da aplicacao.
import { MarketIntelligenceApp } from '@/components/MarketIntelligenceApp';

export default function HomePage() {
  return <MarketIntelligenceApp />;
}
