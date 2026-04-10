import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };

type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[artikel-match]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#0a0a0f] px-6 py-12 text-center text-[#f0eeff]">
          <p className="text-sm font-bold text-rose-300">Что-то пошло не так</p>
          <pre className="max-h-[40vh] max-w-full overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-left text-xs text-artikl-text">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border-2 border-purple-600 bg-purple-600 px-5 py-3 text-sm font-semibold text-white dark:border-transparent dark:bg-[#7c6cf8]"
          >
            Перезагрузить страницу
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
