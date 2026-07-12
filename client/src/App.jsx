import React, { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- Public Pages ---
import Home from "./pages/Home.jsx"; // 👈 Public landing page
import Login from "./pages/Login.jsx";
import EmailVerify from "./pages/EmailVerify.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import PublicOrganizationProfile from "./pages/PublicOrganizationProfile.jsx";

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
import TeamMembers from "./pages/TeamMembers.jsx";
import Profile from "./pages/Profile.jsx";
import Calendar from "./pages/Calendar.jsx";
import Notifications from "./pages/Notifications.jsx";
import Tasks from "./pages/Tasks.jsx";
import KnowledgeTimeline from "./pages/KnowledgeTimeline.jsx";
import PolicyCompliance from "./pages/PolicyCompliance.jsx";
import Settings from "./pages/Settings.jsx";
import Navbar from "./components/Navbar";
import ScrollNavigator from "./components/ScrollNavigator";

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

  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: fine)");
    setIsMobile(!mediaQuery.matches);
    if (!mediaQuery.matches) return;

    // Keep track of real mouse coordinates and rendering coordinates
    const mouse = { x: 0, y: 0 };
    const dot = { x: 0, y: 0 };
    const ring = { x: 0, y: 0 };

    // DOM references obtained directly for maximum frames-per-second performance
    let dotEl = null;
    let ringEl = null;
    let animationFrameId = null;

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseOver = (e) => {
      const target = e.target;
      if (
        target.tagName === "A" ||
        target.tagName === "BUTTON" ||
        target.closest("button") ||
        target.closest("a") ||
        target.getAttribute("role") === "button"
      ) {
        setIsHovered(true);
      } else {
        setIsHovered(false);
      }
    };

    // The Tick function handles the fluid physics loop
    const tick = () => {
      if (!dotEl) dotEl = document.querySelector(".custom-cursor");
      if (!ringEl) ringEl = document.querySelector(".custom-cursor-ring");

      if (dotEl && ringEl) {
        // Inner dot follows instantly (1:1 ratio)
        dot.x = mouse.x;
        dot.y = mouse.y;
        dotEl.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0) translate(-50%, -50%)`;

        // Outer circle glides smoothly lagging behind (using 15% interpolation speed)
        ring.x += (mouse.x - ring.x) * 0.15;
        ring.y += (mouse.y - ring.y) * 0.15;
        ringEl.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate(-50%, -50%)`;
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

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
          <Route path="/organizations/:slug" element={<PublicOrganizationProfile />} />

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
            path="/knowledge/:decisionId"
            element={
              <ProtectedRoute>
                <KnowledgeTimeline />
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
          <Route path="/meeting-room/:roomId" element={<MeetingRoom />} />
          <Route
            path="/meeting/:id"
            element={
              <ProtectedRoute>
                <MeetingDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team-members"
            element={
              <ProtectedRoute>
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
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/policy-compliance"
            element={
              <ProtectedRoute>
                <PolicyCompliance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
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

        {!isMobile && (
          <>
            <div className={`custom-cursor ${isHovered ? "hovered" : ""}`} />
            <div
              className={`custom-cursor-ring ${isHovered ? "hovered" : ""}`}
            />
          </>
        )}
      </ErrorBoundary>
    </div>
  );
};

export default App;
