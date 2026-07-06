import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- Public Pages ---
import Home from "./pages/Home.jsx"; // 👈 Public landing page
import Login from "./pages/Login.jsx";
import EmailVerify from "./pages/EmailVerify.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

// --- Protected Pages ---
import MeetingListPage from "./pages/MeetingListPage.jsx";
import SelectRolePage from "./pages/SelectRolePage.jsx";
import CreateOrganizationPage from "./pages/CreateOrganizationPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";

// ✅ Newly Added Feature Pages
import CreateMeeting from "./pages/CreateMeeting.jsx";
import UploadMeeting from "./pages/UploadMeeting.jsx";
import Policies from "./pages/Policies.jsx";
import Summaries from "./pages/Summaries.jsx";
import Reports from "./pages/Reports.jsx";
import AiSearch from "./pages/AiSearch.jsx";
import MeetingRoom from "./pages/MeetingRoom.jsx";


// --- Components ---
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Footer from "./components/Footer.jsx";

const App = () => {
  const location = useLocation();

const hideFooterRoutes = ["/login"];

const shouldShowFooter = !hideFooterRoutes.includes(location.pathname);
  return (
    <div className="flex flex-col min-h-screen">
      {/* Toast Notifications */}
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <Routes>
        {/* === Public Routes (No login required) === */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/email-verify" element={<EmailVerify />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* === Protected Routes (Require login) === */}
        <Route
          path="/meetings"
          element={
            <ProtectedRoute>
              <MeetingListPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/select-role"
          element={
            <ProtectedRoute>
              <SelectRolePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-organization"
          element={
            <ProtectedRoute>
              <CreateOrganizationPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* ✅ Newly Added Dashboard Feature Routes */}
        <Route
          path="/create-meeting"
          element={
            <ProtectedRoute>
              <CreateMeeting />
            </ProtectedRoute>
          }
        />

        <Route
          path="/upload-meeting"
          element={
            <ProtectedRoute>
              <UploadMeeting />
            </ProtectedRoute>
          }
        />

        <Route
          path="/policies"
          element={
            <ProtectedRoute>
              <Policies />
            </ProtectedRoute>
          }
        />

        <Route
          path="/summaries"
          element={
            <ProtectedRoute>
              <Summaries />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ai-search"
          element={
            <ProtectedRoute>
              <AiSearch />
            </ProtectedRoute>
          }
        />

      <Route path="/meeting-room" element={<MeetingRoom />} />


        {/* ✅ Fallback route — send unknown routes to Home */}
        <Route path="*" element={<Home />} />
      </Routes>
      
      {/* Global Footer */}
    {shouldShowFooter && <Footer />}
    </div>
  );
};

export default App;
