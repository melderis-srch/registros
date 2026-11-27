/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: '20mb' } },
  // La pantalla principal del equipo es el sistema web (public/sistema.html)
  async redirects() { return [{ source: '/', destination: '/sistema.html', permanent: false }]; },
};
export default nextConfig;
