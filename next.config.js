// Configuracao do Next.js.
// O modo "standalone" cria um pacote menor para o servidor Next que o Azure Static Web Apps publica como Function.
// Isso evita que o deploy falhe por tentar enviar dependencias demais para a parte dinamica da aplicacao.
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
