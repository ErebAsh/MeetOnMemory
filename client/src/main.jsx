// main.jsx
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n.js";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppContextProvider } from "./context/AppContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import { ClerkAuthProvider } from "./context/ClerkAuthProvider.jsx";
import { ClerkSessionSync } from "./components/ClerkSessionSync.jsx";
import { AssistantProvider } from "./context/AssistantContext.jsx";
import { PwaProvider } from "./context/PwaContext.jsx";
import { registerSW } from "virtual:pwa-register";
registerSW({ immediate: true });

import {
  getCookiePreferences,
  applyCookiePreferences,
} from "./utils/cookieManager.js";

// Initialize and apply stored cookie consent preferences on application boot
applyCookiePreferences(getCookiePreferences());

// Prevent FOUC by applying theme class before render
const savedTheme = localStorage.getItem("theme");
const systemPrefersDark = window.matchMedia(
  "(prefers-color-scheme: dark)",
).matches;
const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
if (initialTheme === "dark") {
  document.documentElement.classList.add("dark");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <ClerkAuthProvider>
        <ThemeProvider>
          <PreferencesProvider>
            <AppContextProvider>
              <PwaProvider>
                <ClerkSessionSync />
                <AssistantProvider>
                  <App />
                </AssistantProvider>
              </PwaProvider>
            </AppContextProvider>
          </PreferencesProvider>
        </ThemeProvider>
      </ClerkAuthProvider>
    </QueryClientProvider>
  </BrowserRouter>,
);
