import React from 'react';
import { AlertTriangleIcon } from './Icons';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    componentDidUpdate(prevProps) {
        if (this.state.hasError && prevProps.children !== this.props.children) {
            this.setState({ hasError: false, error: null });
        }
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
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
