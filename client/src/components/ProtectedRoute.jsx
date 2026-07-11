import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import AppContent from "../context/AppContent";

const ProtectedRoute = ({ children }) => {
  const { isLoggedin, userData, isLoading } = useContext(AppContent);
  const location = useLocation();

  // Show loading while fetching user data
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  // If user not logged in — block access to protected routes
  if (!isLoggedin) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Onboarding logic - redirect to Organization Hub
  const onboardingPages = [
    "/organizations",
    "/create-organization",
    "/join-organization",
  ];
  const isOnboardingPage = onboardingPages.includes(location.pathname);

  if (userData && !userData.hasCompletedOnboarding && !isOnboardingPage) {
    return <Navigate to="/organizations" replace />;
  }

  if (userData && userData.hasCompletedOnboarding && isOnboardingPage) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
