/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // A composed deployment runs `.next/standalone/server.js` under PM2, and the
  // workspace it is built from is a throwaway directory — so the server has to
  // carry its own traced node_modules rather than depend on that directory
  // surviving. No effect on `next dev`.
  output: "standalone",
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
      // Sales Orders moved under /os/sales/ — keep old bookmarks working.
      {
        source: "/os/sales-orders",
        destination: "/os/sales/orders",
        permanent: false,
      },
      // Same for Purchase Orders, now under /os/procurement/.
      {
        source: "/os/purchase-orders",
        destination: "/os/procurement/purchase-orders",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
