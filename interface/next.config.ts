import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // A composed deployment runs `.next/standalone/server.js` under supervisor,
  // and the workspace it is built from is a throwaway release directory — so
  // the server has to carry its own traced node_modules rather than depend on
  // that directory surviving. No effect on `next dev`.
  output: "standalone",
};

export default nextConfig;
