import type { UIPageDefinition } from "./page";

export type PageConfigFile = {
  id: string;
  route: string;
  metadata?: { title?: string; description?: string };
  definition: UIPageDefinition;
};

export type ValidationResult = { ok: true; page: PageConfigFile } | { ok: false; errors: string[] };
