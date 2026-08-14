/**
 * 全局错误边界：捕获子树内的渲染异常，并给出可恢复的错误页。
 * resetKey 变化时自动清除错误，方便路由切换后重新渲染。
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  private handleReset = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="flex min-h-[420px] items-center justify-center p-4"
      >
        <div className="panel flex w-full max-w-md flex-col items-center border-rose-500/25 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-md border border-rose-500/25 bg-rose-500/10 text-rose-400">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-sm font-semibold text-ink-100">
            页面发生异常
          </h2>
          <p className="mt-1 max-w-sm break-words text-xs leading-5 text-ink-400">
            {this.state.error.message || "应用运行过程中出现未知错误"}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-signal-500/35 bg-signal-500/10 px-4 text-sm font-medium text-signal-300 transition hover:bg-signal-500/20"
          >
            <RotateCcw className="h-4 w-4" />
            重新加载
          </button>
        </div>
      </div>
    );
  }
}
