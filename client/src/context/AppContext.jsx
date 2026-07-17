import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import AppContent from "./AppContent.js";
import { RBACProvider } from "./RBACContext.jsx";
import { useNavigate } from "react-router-dom";
import { authApi } from "../services";
import apiClient from "../services/apiClient.js";

export const AppContextProvider = ({ children }) => {
  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

  const [isLoggedin, setIsLoggedin] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  const getUserData = useCallback(async () => {
    try {
      const { data } = await authApi.getUserData();

      if (data.success && data.user) {
        setUserData(data.user);
        localStorage.setItem("userData", JSON.stringify(data.user));
        return data.user;
      }

      setUserData(null);
      localStorage.removeItem("userData");
      return null;
    } catch (err) {
      console.error("User data error:", err);
      setUserData(null);
      localStorage.removeItem("userData");
      return null;
    }
  }, []);

  const getAuthState = useCallback(async () => {
    try {
      // Fetch CSRF token first
      try {
        const { data: csrfData } = await authApi.getCsrfToken();
        if (csrfData && csrfData.csrfToken) {
          apiClient.defaults.headers.common["X-CSRF-Token"] =
            csrfData.csrfToken;
        }
      } catch (csrfErr) {
        console.error("Failed to fetch CSRF token", csrfErr);
        toast.error(
          "Failed to initialize secure session. Please check your connection and refresh.",
        );
      }

      const { data } = await authApi.getAuthState();

      if (data.success) {
        setIsLoggedin(true);
        await getUserData();
      } else {
        setIsLoggedin(false);
        setUserData(null);
        localStorage.removeItem("userData");
      }
    } catch {
      setIsLoggedin(false);
      setUserData(null);
      localStorage.removeItem("userData");

      if (!isLoggingOut) {
        console.log("User not authenticated");
      }
    } finally {
      setLoading(false);
    }
  }, [getUserData, isLoggingOut]);

  useEffect(() => {
    getAuthState();
  }, [getAuthState]);

  const logoutUser = async () => {
    try {
      setIsLoggingOut(true);

      toast.success("Logged out successfully");

      navigate("/"); //FORCE REDIRECT TO LANDING PAGE (Prevents the 404 page)

      await authApi.logout();

      setIsLoggedin(false);
      setUserData(null);
      localStorage.removeItem("userData");
    } catch {
      toast.error("Failed to logout");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const value = {
    backendUrl,
    isLoggedin,
    setIsLoggedin,
    userData,
    setUserData,
    getUserData,
    logoutUser,
    loading,
  };

  return (
    <AppContent.Provider value={value}>
      <RBACProvider userRole={userData?.role || null}>{children}</RBACProvider>
    </AppContent.Provider>
  );
};
