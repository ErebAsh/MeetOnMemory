import { createContext } from "react";

const AppContent = createContext({
  userData: null,
  isLoggedin: false,
  loading: false,
  backendUrl: "",
  getUserData: async () => {},
  setUserData: () => {},
  logoutUser: () => {},
});

export default AppContent;
