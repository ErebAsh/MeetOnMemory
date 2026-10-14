import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import ProtectedRoutes from "./ProtectedRoutes";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Meetings from "./pages/Meetings";
import MeetingDetails from "./pages/MeetingDetails";
import MeetingAnalytics from "./pages/MeetingAnalytics";
import CreateMeeting from "./pages/CreateMeeting";
import Calendar from "./pages/Calendar";
import Reports from "./pages/Reports";
import Policies from "./pages/Policies";
import Settings from "./pages/Settings";
import Organization from "./pages/Organization";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import GuestMeetingView from "./pages/GuestMeetingView";
import NotFound from "./pages/NotFound";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  console.warn("Missing Clerk Publishable Key");
}

function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/guest/:token" element={<GuestMeetingView />} />

          {/* Protected routes with layout */}
          <Route element={<ProtectedRoutes />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Meetings */}
              <Route path="/meetings" element={<Meetings />} />
              <Route path="/meetings/create" element={<CreateMeeting />} />
              <Route path="/meetings/:id" element={<MeetingDetails />} />

              {/* Meeting Analytics - Now Routed! */}
              <Route
                path="/meetings/:id/analytics"
                element={<MeetingAnalytics />}
              />

              {/* Calendar */}
              <Route path="/calendar" element={<Calendar />} />

              {/* Reports */}
              <Route path="/reports" element={<Reports />} />

              {/* Policies */}
              <Route path="/policies" element={<Policies />} />

              {/* Settings */}
              <Route path="/settings" element={<Settings />} />

              {/* Organization */}
              <Route path="/organization" element={<Organization />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  );
}

export default App;
