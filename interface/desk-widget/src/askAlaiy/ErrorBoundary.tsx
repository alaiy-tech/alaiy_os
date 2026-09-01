import { Component, type ReactNode } from "react";

/** Wraps one chart (or any risky render) so a model-supplied spec that makes
 * Recharts throw costs the reader that one chart, not the whole panel --
 * there is nothing above this widget to catch a render error otherwise,
 * since it's mounted straight onto document.body, outside React's own
 * Desk-page tree (there isn't one). */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; label?: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[AskAlaiy${this.props.label ? `:${this.props.label}` : ""}]`, error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
