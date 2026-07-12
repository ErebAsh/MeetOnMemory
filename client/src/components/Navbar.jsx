// client/src/components/Navbar.jsx
import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AppContent from "../context/AppContent";
import useTheme from "../context/useTheme.jsx";
import { toast } from "react-toastify";
import { notificationApi, authApi } from "../services";
import { io } from "socket.io-client";
import {
  Menu,
  X,
  LayoutDashboard,
  Calendar,
  CalendarDays,
  Building2,
  Search,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Sparkles,
  Users,
  CheckSquare,
  ShieldAlert,
  Moon,
  Sun,
} from "lucide-react";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
  { label: "FAQ", href: "#faq" },
];

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { backendUrl, userData, setUserData, setIsLoggedin } =
    useContext(AppContent);
  const { theme, toggleTheme, mounted } = useTheme();

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNotifOpen, setMobileNotifOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [userData?.profilePic]);

  // Fetch unread count from backend
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    if (userData && backendUrl) {
      const fetchUnreadCount = async () => {
        try {
          const { data } = await notificationApi.getUnreadCount();
          if (data.success) {
            setUnreadCount(data.unreadCount);
          }
        } catch (err) {
          console.error("Error fetching unread count:", err);
        }
      };

      const fetchRecentNotifications = async () => {
        try {
          const { data } = await notificationApi.getNotifications();
          if (data.success) {
            setNotifications(
              data.notifications.slice(0, 5).map((n) => ({
                id: n.id,
                title: n.title,
                description: n.description,
                time: formatTimeAgo(n.createdAt),
                unread: !n.isRead,
              })),
            );
          }
        } catch (err) {
          console.error("Error fetching notifications:", err);
        }
      };

      fetchUnreadCount();
      fetchRecentNotifications();
    }
  }, [userData, backendUrl]);

  // Real-time notifications via Socket.IO
  useEffect(() => {
    if (userData && backendUrl) {
      const socket = io(backendUrl, {
        withCredentials: true,
      });

      socket.on("connect", () => {
        console.log(
          "🟢 Real-time notifications connected. Socket ID:",
          socket.id,
        );
      });

      socket.on("connect_error", (err) => {
        console.error("🔴 Real-time notifications connect_error:", err.message);
      });

      socket.on("notification:new", (newNotif) => {
        setUnreadCount((prev) => prev + 1);
        setNotifications((prev) => {
          const formattedNotif = {
            id: newNotif.id,
            title: newNotif.title,
            description: newNotif.description,
            time: "Just now",
            unread: true,
          };
          // Keep only top 5 recent notifications
          return [formattedNotif, ...prev].slice(0, 5);
        });
        toast.info(`🔔 ${newNotif.title}`);
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [userData, backendUrl]);

  const menuRef = useRef();
  const mobileMenuRef = useRef();
  const notificationsRef = useRef();

  // Detect scroll for navbar style
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const listener = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target)
      ) {
        setNotificationsOpen(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target) &&
        !e.target.closest("button[aria-expanded]")
      ) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);

  // Close menus on resize / route change
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
        setMobileNotifOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setNotificationsOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn(
        "Backend logout cookie clearance skipped locally:",
        err.message,
      );
    } finally {
      setUserData(null);
      localStorage.removeItem("userData");
      setIsLoggedin(false);
      toast.success("Logged out successfully");

      navigate("/");
    }
  };

  const handleNavLinkClick = (href) => {
    setMobileOpen(false);
    if (href.startsWith("#")) {
      if (location.pathname !== "/") {
        navigate("/" + href);
      } else {
        const el = document.querySelector(href);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    } else {
      navigate(href);
    }
  };

  const isTabActive = (tabPath) => {
    const currentPath = location.pathname;
    if (tabPath === "/dashboard") {
      return currentPath === "/dashboard";
    }
    if (tabPath === "/meetings") {
      return (
        currentPath.startsWith("/meetings") ||
        currentPath === "/create-meeting" ||
        currentPath === "/upload-meeting" ||
        currentPath === "/summaries" ||
        currentPath === "/reports" ||
        currentPath === "/policies"
      );
    }
    if (tabPath === "/organizations") {
      return (
        currentPath === "/organizations" ||
        currentPath === "/create-organization" ||
        currentPath === "/join-organization"
      );
    }
    if (tabPath === "/ai-search") {
      return currentPath === "/ai-search";
    }
    return currentPath === tabPath;
  };

  const appLinks = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Meetings", href: "/meetings", icon: Calendar },
    { label: "Tasks", href: "/tasks", icon: CheckSquare },
    { label: "Compliance", href: "/policy-compliance", icon: ShieldAlert },
    { label: "Calendar", href: "/calendar", icon: CalendarDays },
    { label: "Team Members", href: "/team-members", icon: Users },
    { label: "Organizations", href: "/organizations", icon: Building2 },
    { label: "AI Search", href: "/ai-search", icon: Search },
  ];

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-md border-b border-gray-100/80 dark:border-gray-800/80"
          : "bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer group focus-visible:outline-none"
            onClick={() => navigate("/")}
            role="link"
            aria-label="MeetOnMemory Home"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate("/")}
          >
            <div className="flex items-center justify-center">
              {/* Clean Extra Large Native Option A Infinity Symbol with scale only */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 100 100"
                className="relative w-16 h-16 transition-transform duration-300 group-hover:scale-105"
              >
                <defs>
                  <linearGradient
                    id="navInfinityGrad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stop-color="#2563eb" />
                    <stop offset="100%" stop-color="#7c3aed" />
                  </linearGradient>
                </defs>
                <path
                  d="M25,50 C25,35 38,30 50,50 C62,70 75,65 75,50 C75,35 62,30 50,50 C38,70 25,65 25,50 Z"
                  fill="none"
                  stroke="url(#navInfinityGrad)"
                  stroke-width="11"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <circle cx="25" cy="50" r="6.5" fill="#2563eb" />
                <circle cx="75" cy="50" r="6.5" fill="#7c3aed" />
              </svg>
            </div>
            {/* Clean, Consistent Text Layout (Hover effects removed) */}
            <span className="font-bold text-2xl text-gray-900 dark:text-gray-100 tracking-tight">
              MeetOn
              <span className="text-blue-600 dark:text-blue-400">Memory</span>
            </span>
          </div>
          {/* Desktop Navigation */}
          {userData ? (
            /* Logged In Desktop App Nav */
            <nav
              className="hidden md:flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 p-1 rounded-2xl"
              aria-label="Application navigation"
            >
              {appLinks.map((link) => {
                const Icon = link.icon;
                const active = isTabActive(link.href);
                return (
                  <button
                    key={link.href}
                    onClick={() => navigate(link.href)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                      active
                        ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs border border-gray-100/50 dark:border-gray-600/50"
                        : "text-gray-600 dark:text-gray-300 border border-transparent hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/60 dark:hover:bg-gray-700/60"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 transition-transform duration-200 ${
                        active
                          ? "scale-110 text-blue-600 dark:text-blue-400"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                    />
                    <span>{link.label}</span>
                  </button>
                );
              })}
            </nav>
          ) : (
            /* Logged Out Desktop Marketing Nav */
            <nav
              className="hidden md:flex items-center gap-1.5"
              aria-label="Marketing navigation"
            >
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavLinkClick(link.href)}
                  className="px-3.5 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 rounded-xl hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/70 dark:hover:bg-blue-900/30 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                >
                  {link.label}
                </button>
              ))}
            </nav>
          )}

          {/* Right Side Controls */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label={
                mounted
                  ? theme === "light"
                    ? "Switch to dark mode"
                    : "Switch to light mode"
                  : "Toggle theme"
              }
            >
              {mounted && theme === "light" ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>

            {userData ? (
              <>
                {/* Desktop Notification Area */}
                <div
                  className="relative hidden sm:block"
                  ref={notificationsRef}
                >
                  <button
                    onClick={() => setNotificationsOpen((s) => !s)}
                    className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                      notificationsOpen
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                    aria-expanded={notificationsOpen}
                    aria-haspopup="true"
                    aria-label="Open notifications menu"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-gray-800 animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notifications Popover */}
                  {notificationsOpen && (
                    <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden z-50">
                      <div className="px-4 py-3.5 bg-gray-50/80 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-600 flex items-center justify-between">
                        <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                          Notifications
                        </span>
                        <button
                          onClick={() => {
                            setNotificationsOpen(false);
                            navigate("/notifications");
                          }}
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer"
                        >
                          View All
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
                        {notifications.length > 0 ? (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className={`p-3.5 hover:bg-blue-50/20 dark:hover:bg-blue-900/20 transition-colors text-left ${
                                notif.unread
                                  ? "bg-blue-50/5 dark:bg-blue-900/10"
                                  : ""
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2 mb-1">
                                <p className="font-semibold text-xs text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                                  {notif.unread && (
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0"></span>
                                  )}
                                  {notif.title}
                                </p>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">
                                  {notif.time}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                {notif.description}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
                            No notifications yet
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile / Dropdown Menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((s) => !s)}
                    className="flex items-center gap-1.5 p-1 pr-2.5 rounded-xl border border-gray-200/60 dark:border-gray-600/60 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer"
                    aria-expanded={menuOpen}
                    aria-haspopup="true"
                    aria-label="Open user menu"
                  >
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0">
                      <div className="absolute inset-0 bg-linear-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        {userData?.name
                          ? userData.name.charAt(0).toUpperCase()
                          : "U"}
                      </div>
                      {userData?.profilePic && !imgFailed && (
                        <img
                          src={userData.profilePic}
                          alt={userData.name}
                          className="absolute inset-0 w-full h-full object-cover border border-gray-200/40"
                          onError={() => setImgFailed(true)}
                        />
                      )}
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${
                        menuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {menuOpen && (
                    <div className="absolute right-0 mt-3 w-60 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden z-50">
                      <div className="px-4 py-3.5 bg-gray-50/80 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-600">
                        <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                          Signed in as
                        </p>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">
                          {userData?.name || "User"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {userData?.email || "user@example.com"}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded-full capitalize">
                            {userData?.role || "Member"}
                          </span>
                          {userData?.organization?.name && (
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full truncate max-w-[120px] uppercase">
                              {userData.organization.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-1">
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate("/dashboard");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                          Dashboard
                        </button>

                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate("/profile");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <User className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                          My Profile
                        </button>

                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            navigate("/settings");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <Settings className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                          Settings
                        </button>

                        {userData?.role === "admin" && (
                          <button
                            onClick={() => {
                              setMenuOpen(false);
                              navigate("/admin-panel");
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-xl transition-colors text-left cursor-pointer"
                            role="menuitem"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                            Admin Panel
                          </button>
                        )}
                      </div>

                      <div className="border-t border-gray-100 dark:border-gray-600 p-1">
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <LogOut className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="px-5 py-2.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer"
                aria-label="Login to MeetOnMemory"
              >
                Login
              </button>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
              onClick={() => setMobileOpen((s) => !s)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <div
        ref={mobileMenuRef}
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 ${
          mobileOpen
            ? "max-h-[600px] opacity-100 shadow-lg"
            : "max-h-0 opacity-0"
        }`}
        aria-hidden={!mobileOpen}
      >
        <nav
          className="px-4 py-5 flex flex-col gap-1.5"
          aria-label="Mobile navigation"
        >
          {userData ? (
            /* Logged In Mobile Nav List */
            <>
              <div className="px-3.5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100/60 dark:border-gray-700 flex items-center gap-3 rounded-2xl mb-2">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0">
                  <div className="absolute inset-0 bg-linear-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                    {userData?.name
                      ? userData.name.charAt(0).toUpperCase()
                      : "U"}
                  </div>
                  {userData?.profilePic && !imgFailed && (
                    <img
                      src={userData.profilePic}
                      alt={userData.name}
                      className="absolute inset-0 w-full h-full object-cover border border-gray-200/40"
                      onError={() => setImgFailed(true)}
                    />
                  )}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">
                    {userData?.name || "User"}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                    {userData?.email || "user@example.com"}
                  </p>
                </div>
              </div>

              {appLinks.map((link) => {
                const Icon = link.icon;
                const active = isTabActive(link.href);
                return (
                  <button
                    key={link.href}
                    onClick={() => {
                      setMobileOpen(false);
                      navigate(link.href);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                      active
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${active ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}
                    />
                    <span>{link.label}</span>
                  </button>
                );
              })}

              {/* Mobile Notifications Section Toggle */}
              <button
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/notifications");
                }}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                  mobileNotifOpen
                    ? "bg-blue-50/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bell
                    className={`w-4 h-4 ${mobileNotifOpen ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}
                  />
                  <span>Notifications</span>
                </div>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {unreadCount} New
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/profile");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 rounded-xl transition-all cursor-pointer"
              >
                <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span>My Profile</span>
              </button>

              <button
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/settings");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 rounded-xl transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span>Settings</span>
              </button>

              <hr className="my-1.5 border-gray-100 dark:border-gray-700" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-500 dark:text-red-400" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            /* Logged Out Mobile Nav List */
            <>
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavLinkClick(link.href)}
                  className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {link.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/login?mode=signup");
                }}
                className="mt-3 w-full px-4 py-3 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all duration-200 text-center cursor-pointer"
              >
                Get Started — It&apos;s Free
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
