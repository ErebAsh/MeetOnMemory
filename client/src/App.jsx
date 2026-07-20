import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- Public Pages ---
import Home from "./pages/Home.jsx"; // 👈 Public landing page
import Login from "./pages/Login.jsx";
import EmailVerify from "./pages/EmailVerify.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import PublicOrganizationProfile from "./pages/PublicOrganizationProfile.jsx";
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";
import Security from "./pages/Security.jsx";
import Contact from "./pages/Contact.jsx";
import CookiePolicy from "./pages/CookiePolicy.jsx";

// --- Protected Pages ---
import MeetingListPage from "./pages/MeetingListPage.jsx";
import OrganizationHub from "./pages/OrganizationHub.jsx";
import JoinOrganizationPage from "./pages/JoinOrganizationPage.jsx";
import CreateOrganizationPage from "./pages/CreateOrganizationPage.jsx";
import BrowseOrganizations from "./pages/BrowseOrganizations/BrowseOrganizations.jsx";
import Dashboard from "./pages/Dashboard.jsx";

// ✅ Newly Added Feature Pages
import CreateMeeting from "./pages/CreateMeeting.jsx";
import UploadMeeting from "./pages/UploadMeeting.jsx";
import Policies from "./pages/Policies.jsx";
import Summaries from "./pages/Summaries.jsx";
import Reports from "./pages/Reports.jsx";
import AiSearch from "./pages/AiSearch.jsx";
import MeetingRoom from "./pages/MeetingRoom.jsx";
import MeetingDetails from "./pages/MeetingDetails.jsx";
import TranscriptViewer from "./pages/TranscriptViewer.jsx";
import TeamMembers from "./pages/TeamMembers.jsx";
import Profile from "./pages/Profile.jsx";
import Calendar from "./pages/Calendar.jsx";
import Notifications from "./pages/Notifications.jsx";
import Tasks from "./pages/Tasks.jsx";
import KnowledgeTimeline from "./pages/KnowledgeTimeline.jsx";
import MemoryConsolidation from "./pages/MemoryConsolidation.jsx";
import GraphSnapshots from "./pages/GraphSnapshots.jsx";
import PolicyCompliance from "./pages/PolicyCompliance.jsx";
import Settings from "./pages/Settings.jsx";
import MembershipRequests from "./pages/MembershipRequests.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";
import AccessDenied from "./pages/AccessDenied.jsx";
import Navbar from "./components/Navbar";
import ScrollNavigator from "./components/ScrollNavigator";
import CustomCursor from "./components/CustomCursor.jsx";

// --- Components ---
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Footer from "./components/Footer.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const App = () => {
  const location = useLocation();

  const hideFooterRoutes = ["/login"];
  const shouldShowFooter = !hideFooterRoutes.includes(location.pathname);

  // Only activate navigation controller panel when exactly on the landing page fold
  const shouldShowScrollNavigator = location.pathname === "/";

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900">
      <ErrorBoundary>
        {/* Toast Notifications */}
        <ToastContainer position="top-right" autoClose={3000} theme="colored" />

        <Routes>
          {/* === Public Routes (No login required) === */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/email-verify" element={<EmailVerify />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/security" element={<Security />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route
            path="/organizations/:slug"
            element={<PublicOrganizationProfile />}
          />

          {/* === Protected Routes (Require login) === */}
          <Route
            path="/meetings"
            element={
              <ProtectedRoute resource="meetings" action="view">
                <MeetingListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/knowledge/:decisionId"
            element={
              <ProtectedRoute>
                <KnowledgeTimeline />
              </ProtectedRoute>
            }
          />
          <Route
            path="/knowledge/consolidate"
            element={
              <ProtectedRoute resource="knowledge" action="view">
                <MemoryConsolidation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/knowledge/graph-history"
            element={
              <ProtectedRoute resource="knowledge" action="view">
                <GraphSnapshots />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizations"
            element={
              <ProtectedRoute>
                <OrganizationHub />
              </ProtectedRoute>
            }
          />
          <Route
            path="/join-organization"
            element={
              <ProtectedRoute>
                <JoinOrganizationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/browse-organizations"
            element={
              <ProtectedRoute>
                <BrowseOrganizations />
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
              <ProtectedRoute resource="meetings" action="create">
                <CreateMeeting />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload-meeting"
            element={
              <ProtectedRoute resource="meetings" action="create">
                <UploadMeeting />
              </ProtectedRoute>
            }
          />
          <Route
            path="/policies"
            element={
              <ProtectedRoute resource="policies" action="view">
                <Policies />
              </ProtectedRoute>
            }
          />
          <Route
            path="/summaries"
            element={
              <ProtectedRoute resource="meetings" action="view">
                <Summaries />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute resource="reports" action="view">
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-search"
            element={
              <ProtectedRoute resource="ai_search" action="search">
                <AiSearch />
              </ProtectedRoute>
            }
          />
          <Route path="/meeting-room/:roomId" element={<MeetingRoom />} />
          <Route
            path="/transcript/:meetingId"
            element={
              <ProtectedRoute resource="meetings" action="view">
                <TranscriptViewer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meeting/:id"
            element={
              <ProtectedRoute resource="meetings" action="view">
                <MeetingDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team-members"
            element={
              <ProtectedRoute resource="team_members" action="view">
                <TeamMembers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute resource="calendar" action="view">
                <Calendar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute resource="notifications" action="view">
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute resource="tasks" action="view">
                <Tasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/policy-compliance"
            element={
              <ProtectedRoute resource="policies" action="view">
                <PolicyCompliance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute resource="settings" action="view">
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/membership-requests"
            element={
              <ProtectedRoute resource="team_members" action="invite">
                <MembershipRequests />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-panel"
            element={
              <ProtectedRoute
                resource="admin_panel"
                action="view"
                forbiddenFallback={<AccessDenied />}
              >
                <AdminPanel />
              </ProtectedRoute>
            }
          />

          {/* ✅ Fallback route — send unknown routes to Home */}
          <Route path="*" element={<Home />} />
        </Routes>

        {/* Floating Section Controller overlay */}
        {shouldShowScrollNavigator && <ScrollNavigator />}

        {/* Global Footer */}
        {shouldShowFooter && <Footer />}

        <CustomCursor />
      </ErrorBoundary>
    </div>
  );
};

export default App;
