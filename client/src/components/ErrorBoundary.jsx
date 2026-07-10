import React from "react";
import ErrorState from "./ErrorState.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <ErrorState 
            title="Oops! Something went wrong." 
            message={this.state.error?.message || "An unexpected application error occurred."} 
            onRetry={this.handleRetry} 
            retryText="Try Again" 
          />
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
