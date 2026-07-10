import axios from 'axios';

// Setup interceptor on the default axios instance
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    let friendlyMessage = "An unexpected error occurred. Please try again.";

    if (!error.response) {
      // Network error (offline or server not reachable)
      friendlyMessage = "Network offline. Please check your internet connection.";
      // Mock the response so local catch blocks using error.response?.data?.message work
      error.response = { data: { message: friendlyMessage }, status: 0 };
    } else {
      switch (error.response.status) {
        case 401:
          friendlyMessage =
            error.response.data && error.response.data.message
              ? error.response.data.message
              : "Session expired. Please log in again.";
          break;
        case 403:
          friendlyMessage = "You do not have permission to perform this action.";
          break;
        case 404:
          friendlyMessage = "The requested resource was not found.";
          break;
        case 419:
          friendlyMessage = "Session expired (CSRF). Please refresh the page.";
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          friendlyMessage = "Server unavailable. Please try again later.";
          break;
        default:
          // Use backend provided message if available, otherwise keep default
          if (error.response.data && error.response.data.message) {
             friendlyMessage = error.response.data.message;
          }
          break;
      }
      
      // Inject the friendly message back into the response so local catch blocks display it
      if (error.response.data) {
        error.response.data.message = friendlyMessage;
      } else {
        error.response.data = { message: friendlyMessage };
      }
    }
    
    error.message = friendlyMessage;

    return Promise.reject(error);
  }
);
