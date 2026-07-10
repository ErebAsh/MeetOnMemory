import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

const ErrorState = ({ 
  title = "An Error Occurred", 
  message = "Something went wrong. Please try again.", 
  onRetry = null, 
  retryText = "Retry",
  className = "" 
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-red-50 rounded-lg border border-red-100 ${className}`}>
      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6 max-w-md">{message}</p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          <RefreshCw className="w-4 h-4" />
          {retryText}
        </button>
      )}
    </div>
  );
};

export default ErrorState;
