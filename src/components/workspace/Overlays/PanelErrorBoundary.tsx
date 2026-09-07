"use client";
/** Per-panel error boundary (Module 03 W-30): one broken panel must not blank the page. */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props { name: string; children: ReactNode }
interface State { error: Error | null }

export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo): void { console.error(`[workspace] ${this.props.name} panel crashed`, error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <AlertTriangle className="size-5 text-medium" />
        <p className="text-sm font-medium text-fg-1">The {this.props.name} panel hit an error</p>
        <p className="max-w-sm text-xs text-fg-3">{this.state.error.message}</p>
        <button type="button" onClick={() => this.setState({ error: null })} className="mt-1 flex h-8 items-center gap-1.5 rounded-[6px] bg-ws-chip px-3 text-xs text-fg-1 hover:bg-ws-hover"><RefreshCw className="size-3.5" /> Try again</button>
      </div>
    );
  }
}
