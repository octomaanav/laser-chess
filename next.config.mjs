/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // keep the Postgres driver as a runtime dependency (don't bundle it)
  serverExternalPackages: ['pg'],
};

export default nextConfig;
