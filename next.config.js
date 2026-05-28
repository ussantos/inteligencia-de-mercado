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
