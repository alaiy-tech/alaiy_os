/** Thrown when a config file exists and parses as JSON but fails schema
 * validation (or has duplicate node ids) - distinct from "no config at this
 * route", which is the ordinary, expected state for a route nobody has
 * created a page for yet (`getPageById`/`getPageByRoute` return `null` for
 * that case, not an error). Callers that want a controlled error state
 * (the dynamic route does) catch this specifically; callers that don't can
 * let it propagate to Next's nearest `error.tsx` boundary. */
export class InvalidPageConfigError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid page configuration: ${errors.join("; ")}`);
    this.name = "InvalidPageConfigError";
    this.errors = errors;
  }
}
