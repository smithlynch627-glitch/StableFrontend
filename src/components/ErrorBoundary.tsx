import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; resetKey?: string }
interface State { error: Error | null }

/** Keeps one broken component from blanking the whole site. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui error]', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page container" style={{ display: 'grid', gap: 14, justifyItems: 'start' }}>
        <h1 className="h2">This page failed to load</h1>
        <p className="soft">{this.state.error.message}</p>
        <div className="row">
          <button className="btn" onClick={() => this.setState({ error: null })}>Try again</button>
          <a className="btn btn--outline" href="/">Go to home</a>
        </div>
      </div>
    );
  }
}
