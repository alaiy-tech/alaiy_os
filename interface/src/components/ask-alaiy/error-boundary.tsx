"use client";

import { Component, type ReactNode } from "react";

/** Wraps one chart so a model-supplied spec that makes Recharts throw costs
 * the reader that one chart, not the whole panel. */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[AskAlaiy:AnswerChart]", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
