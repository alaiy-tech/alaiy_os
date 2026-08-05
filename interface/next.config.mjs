/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["100.125.212.31", "localhost"],
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/os/dashboard",
        destination: "/os",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
