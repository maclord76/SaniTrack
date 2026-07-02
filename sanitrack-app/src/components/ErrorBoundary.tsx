import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8 dark:bg-slate-900">
          <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-8 shadow-lg dark:border-red-800 dark:bg-slate-800">
            <h2 className="mb-4 text-xl font-bold text-red-600 dark:text-red-400">
              Une erreur est survenue
            </h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              L'application a rencontré une erreur inattendue. Veuillez réessayer.
            </p>
            <div className="mb-6 max-h-48 overflow-auto rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
              <code className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap">
                {this.state.error?.message}
              </code>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Recharger la page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };