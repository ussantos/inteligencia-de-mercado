// Este arquivo ensina o TypeScript sobre plugins do Leaflet carregados no navegador.
// Sem esta declaracao, o TypeScript pode reclamar que "window.L" nao existe.
import type * as Leaflet from 'leaflet';

declare global {
  interface Window {
    L?: typeof Leaflet;
  }
}

export {};
