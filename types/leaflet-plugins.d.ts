import type * as Leaflet from 'leaflet';

declare global {
  interface Window {
    L?: typeof Leaflet;
  }
}

export {};
