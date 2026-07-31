import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FrappeProvider } from "frappe-react-sdk";

import "./index.css";
import App from "./App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* No url prop: requests go to relative paths, proxied to the bench in
        dev (see vite.config.ts) and served same-origin in production.
        Socket disabled - this pass has no live-update features that need it,
        and it would otherwise try to reach the bench's socket port directly
        (unproxied) and fail every few seconds. */}
    <FrappeProvider enableSocket={false}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename="/os" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </FrappeProvider>
  </StrictMode>,
);
