// Configuracao do Next.js.
// Aqui desligamos o header "powered by", ativamos verificacoes extras do React e liberamos imagens dos tiles do mapa.
/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'a.tile.openstreetmap.org' },
      { protocol: 'https', hostname: 'b.tile.openstreetmap.org' },
      { protocol: 'https', hostname: 'c.tile.openstreetmap.org' }
    ]
  }
};

module.exports = nextConfig;
