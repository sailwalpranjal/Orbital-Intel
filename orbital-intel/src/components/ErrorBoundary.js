import React from 'react';
import { AlertCircle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center mb-4">
              <AlertCircle className="text-red-500 mr-3" size={24} />
              <h1 className="text-xl font-semibold">Something went wrong</h1>
            </div>
            <p className="text-gray-400 mb-4">
              The application encountered an error. This might be due to:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-400 mb-4">
              <li>WebGL not supported in your browser</li>
              <li>Network connectivity issues</li>
              <li>Invalid satellite data</li>
            </ul>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
