import React, { useState, useContext } from "react";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  User,
  Mail,
  Building2,
  Shield,
  Bell,
  Palette,
  Globe,
  Clock,
  LogOut,
  Lock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import CalendarIntegrations from "../components/CalendarIntegrations.jsx";

const Settings = () => {
  const { userData, logoutUser } = useContext(AppContent);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Notification preferences state (UI only - no backend support)
  const [notificationPrefs, setNotificationPrefs] = useState({
    meetingNotifications: true,
    organizationUpdates: true,
    aiProcessingUpdates: true,
    emailNotifications: true,
  });

  // Appearance preferences state (UI only - no backend support)
  const [appearancePrefs, setAppearancePrefs] = useState({
    theme: "light",
  });

  // Preferences state (UI only - placeholders)
  const [generalPrefs, setGeneralPrefs] = useState({
    language: "en",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: "MM/DD/YYYY",
  });

  if (!userData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
          <span className="ml-3 text-slate-500 font-medium">
            Loading settings...
          </span>
        </div>
      </div>
    );
  }

  const displayRole = userData.role
    ? userData.role.charAt(0).toUpperCase() +
      userData.role.slice(1).toLowerCase()
    : "Member";

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutUser();
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Failed to logout");
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationChange = (key) => {
    setNotificationPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleThemeChange = (theme) => {
    setAppearancePrefs((prev) => ({ ...prev, theme }));
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 text-slate-800 flex flex-col font-sans select-none">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Page title header */}
        <div className="text-center mb-8 fade-in-up stagger-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Settings
          </h1>
          <p className="text-slate-500 mt-2 text-sm max-w-md mx-auto">
            Manage your account preferences, notifications, and security
            settings.
          </p>
        </div>

        <div className="space-y-6">
          {/* Account Settings Section */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm fade-in-up stagger-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 rounded-xl">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Account Settings
                </h2>
                <p className="text-xs text-slate-500">
                  View and manage your account information
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Name
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {userData.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/profile")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  Edit Profile
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Email
                    </p>
                    <p className="text-sm font-semibold text-slate-900 break-all">
                      {userData.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Organization
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {userData.organization?.name || "No Organization"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Role
                    </p>
                    <p className="text-sm font-semibold text-slate-900 capitalize">
                      {displayRole}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm fade-in-up stagger-3">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-50 rounded-xl">
                <Palette className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Appearance</h2>
                <p className="text-xs text-slate-500">
                  Customize your application theme
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Theme</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose your preferred theme
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleThemeChange("light")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      appearancePrefs.theme === "light"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Light
                  </button>
                  <button
                    onClick={() => handleThemeChange("dark")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      appearancePrefs.theme === "dark"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Preferences Section */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm fade-in-up stagger-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-50 rounded-xl">
                <Bell className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Notification Preferences
                </h2>
                <p className="text-xs text-slate-500">
                  Manage how you receive notifications
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Meeting Notifications
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Get notified about meeting updates
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleNotificationChange("meetingNotifications")
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    notificationPrefs.meetingNotifications
                      ? "bg-blue-600"
                      : "bg-slate-200"
                  }`}
                  aria-pressed={notificationPrefs.meetingNotifications}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      notificationPrefs.meetingNotifications
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Organization Updates
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Updates about your organization
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleNotificationChange("organizationUpdates")
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    notificationPrefs.organizationUpdates
                      ? "bg-blue-600"
                      : "bg-slate-200"
                  }`}
                  aria-pressed={notificationPrefs.organizationUpdates}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      notificationPrefs.organizationUpdates
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    AI Processing Updates
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Notifications when AI processing completes
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleNotificationChange("aiProcessingUpdates")
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    notificationPrefs.aiProcessingUpdates
                      ? "bg-blue-600"
                      : "bg-slate-200"
                  }`}
                  aria-pressed={notificationPrefs.aiProcessingUpdates}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      notificationPrefs.aiProcessingUpdates
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Email Notifications
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Receive notifications via email
                  </p>
                </div>
                <button
                  onClick={() => handleNotificationChange("emailNotifications")}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    notificationPrefs.emailNotifications
                      ? "bg-blue-600"
                      : "bg-slate-200"
                  }`}
                  aria-pressed={notificationPrefs.emailNotifications}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      notificationPrefs.emailNotifications
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Integrations */}
          <CalendarIntegrations />

          {/* Security Section */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm fade-in-up stagger-5">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-50 rounded-xl">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Security</h2>
                <p className="text-xs text-slate-500">
                  Manage your account security settings
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => navigate("/reset-password")}
                className="w-full flex items-center justify-between py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">
                      Change Password
                    </p>
                    <p className="text-xs text-slate-500">
                      Update your password
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
              </button>

              <div className="w-full flex items-center justify-between py-3 px-4 rounded-xl opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">
                      Two-Factor Authentication
                    </p>
                    <p className="text-xs text-slate-500">Coming soon</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                  Soon
                </span>
              </div>

              <div className="w-full flex items-center justify-between py-3 px-4 rounded-xl opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">
                      Active Sessions
                    </p>
                    <p className="text-xs text-slate-500">
                      Manage your active sessions
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                  Soon
                </span>
              </div>

              <hr className="border-slate-100" />

              <button
                onClick={handleLogout}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4" />
                    Logging out...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    Logout from current session
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm fade-in-up stagger-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-50 rounded-xl">
                <Globe className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Preferences
                </h2>
                <p className="text-xs text-slate-500">
                  Configure your application preferences
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Language
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select your preferred language
                  </p>
                </div>
                <select
                  value={generalPrefs.language}
                  onChange={(e) =>
                    setGeneralPrefs((prev) => ({
                      ...prev,
                      language: e.target.value,
                    }))
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Time Zone
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Set your time zone
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600">
                    {generalPrefs.timeZone}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Date Format
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose your date format preference
                  </p>
                </div>
                <select
                  value={generalPrefs.dateFormat}
                  onChange={(e) =>
                    setGeneralPrefs((prev) => ({
                      ...prev,
                      dateFormat: e.target.value,
                    }))
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
