import axios from "axios";
import React, {useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import AppContent from "./AppContent.js";


axios.defaults.withCredentials = true;

export const AppContextProvider = ({ children }) => {
const backendUrl =
import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

const [isLoggedin, setIsLoggedin] = useState(false);
const [userData, setUserData] = useState(null);
const [loading, setLoading] = useState(true);
const [isLoggingOut, setIsLoggingOut] = useState(false);

const getUserData = useCallback(async () => {
try {
const { data } = await axios.get(
`${backendUrl}/api/auth/user-data`,
{
withCredentials: true,
}
);


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


}, [backendUrl]);

const getAuthState = useCallback(async () => {
try {
const { data } = await axios.get(
`${backendUrl}/api/auth/is-auth`,
{
withCredentials: true,
}
);


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


}, [backendUrl, getUserData, isLoggingOut]);

useEffect(() => {
getAuthState();
}, [getAuthState]);

const logoutUser = async () => {
try {
setIsLoggingOut(true);


  await axios.post(
    `${backendUrl}/api/auth/logout`,
    {},
    {
      withCredentials: true,
    }
  );

  setIsLoggedin(false);
  setUserData(null);
  localStorage.removeItem("userData");

  toast.success("Logged out successfully");
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
{children}
</AppContent.Provider>
);
};
