import React from 'react';
import { AlertTriangleIcon } from './Icons';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, prevResetKey: props.resetKey };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    static getDerivedStateFromProps(props, state) {
        if (props.resetKey !== state.prevResetKey) {
            return { hasError: false, error: null, prevResetKey: props.resetKey };
        }
        return null;
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const level = this.props.level || 'page';

            if (level === 'section') {
                return (
                    <div className="flex items-center justify-center py-12 px-4">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-sm text-center">
                            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertTriangleIcon className="w-5 h-5 text-red-600" />
                            </div>
                            <h2 className="text-base font-semibold text-slate-800 mb-1">
                                Something went wrong
                            </h2>
                            <p className="text-sm text-slate-500 mb-4">
                                This section encountered an error.
                            </p>
                            <button
                                onClick={this.handleRetry}
                                className="px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                Try Again
                            </button>
                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <details className="mt-4 text-left">
                                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                                        Error details
                                    </summary>
                                    <pre className="mt-1 p-2 bg-slate-100 rounded text-xs text-red-600 overflow-auto max-h-32">
                                        {this.state.error.toString()}
                                    </pre>
                                </details>
                            )}
                        </div>
                    </div>
                );
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50">
                    <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertTriangleIcon className="w-8 h-8 text-red-600" />
                        </div>
                        <h1 className="text-xl font-semibold text-slate-800 mb-2">
                            Something went wrong
                        </h1>
                        <p className="text-slate-600 mb-6">
                            We encountered an unexpected error. Please try refreshing the page.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReload}
                                className="px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                Refresh Page
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                Go to Home
                            </button>
                        </div>
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-6 text-left">
                                <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
                                    Error details
                                </summary>
                                <pre className="mt-2 p-3 bg-slate-100 rounded text-xs text-red-600 overflow-auto max-h-40">
                                    {this.state.error.toString()}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
