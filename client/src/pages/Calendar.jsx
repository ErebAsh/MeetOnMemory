import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { meetingApi } from "../services";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Video,
  ExternalLink,
  MapPin,
  Clock,
  Briefcase,
  Layers,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Loader2,
  Inbox,
  X,
} from "lucide-react";

const Calendar = () => {
  const navigate = useNavigate();

  // States
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month"); // 'month' | 'week' | 'day'
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  // Filter States
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");

  // Fetch Meetings
  useEffect(() => {
    const fetchMeetings = async () => {
      setLoading(true);
      try {
        const { data } = await meetingApi.getAllMeetings();
        if (data.success) {
          setMeetings(data.meetings || []);
        } else {
          toast.error(data.message || "Failed to fetch meetings.");
        }
      } catch (err) {
        console.error("Fetch meetings error:", err);
        toast.error("Error loading calendar data.");
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, []);

  // Handle outside click to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedMeeting(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter Logic
  const filteredMeetings = meetings.filter((meeting) => {
    const matchesStatus =
      statusFilter === "all" || meeting.status === statusFilter;
    const matchesType =
      typeFilter === "all" || meeting.meetingType === typeFilter;

    // Filter by organization: if user has organization or meeting has one
    let matchesOrg = true;
    if (orgFilter !== "all") {
      if (orgFilter === "personal") {
        matchesOrg = !meeting.organization;
      } else {
        matchesOrg =
          meeting.organization === orgFilter ||
          (meeting.organization?._id &&
            meeting.organization._id === orgFilter) ||
          (meeting.organization?.name &&
            meeting.organization.name === orgFilter);
      }
    }

    return matchesStatus && matchesType && matchesOrg;
  });

  // Extract unique organizations for filters
  const uniqueOrgs = Array.from(
    new Set(
      meetings
        .map((m) => m.organization?.name || m.organization)
        .filter(Boolean),
    ),
  );

  // Navigation helpers
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else if (view === "week") {
      newDate.setDate(currentDate.getDate() - 7);
    } else {
      newDate.setDate(currentDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(currentDate.getMonth() + 1);
    } else if (view === "week") {
      newDate.setDate(currentDate.getDate() + 7);
    } else {
      newDate.setDate(currentDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Date Parsing Helpers
  const isSameDay = (d1, d2) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Status Styling Utilities
  const getStatusStyle = (status) => {
    switch (status) {
      case "completed":
        return {
          bg: "bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200 text-emerald-800",
          dot: "bg-emerald-500",
          badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
          icon: CheckCircle,
        };
      case "processing":
        return {
          bg: "bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-amber-800 animate-pulse",
          dot: "bg-amber-500",
          badge: "bg-amber-50 text-amber-700 border-amber-100",
          icon: Loader2,
        };
      case "failed":
        return {
          bg: "bg-rose-50 hover:bg-rose-100/80 border-rose-200 text-rose-800",
          dot: "bg-rose-500",
          badge: "bg-rose-50 text-rose-700 border-rose-100",
          icon: AlertCircle,
        };
      default: // uploaded / upcoming
        return {
          bg: "bg-blue-50 hover:bg-blue-100/80 border-blue-200 text-blue-800",
          dot: "bg-blue-500",
          badge: "bg-blue-50 text-blue-700 border-blue-100",
          icon: HelpCircle,
        };
    }
  };

  // Get start/end dates for calculations
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  // Week days calculator (Sunday to Saturday)
  const getWeekDays = (date) => {
    const startOfWeek = new Date(date);
    const day = date.getDay();
    const diff = date.getDate() - day; // adjust to Sunday
    startOfWeek.setDate(diff);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const wDay = new Date(startOfWeek);
      wDay.setDate(startOfWeek.getDate() + i);
      week.push(wDay);
    }
    return week;
  };

  // Build grid of days for month view
  const buildMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const totalDays = getDaysInMonth(currentDate);
    const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1...

    const prevMonthDate = new Date(year, month, 0);
    const prevMonthDays = prevMonthDate.getDate();

    const cells = [];

    // Prepend previous month's trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Append next month's leading days to complete grid rows
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      cells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return cells;
  };

  // Convert "HH:MM" String offset to minutes
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 9 * 60; // default 09:00 AM (540 mins)
    const parts = timeStr.split(":");
    if (parts.length < 2) return 9 * 60;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };

  // Format Time Slot helper (e.g. "09:30 AM")
  const formatTimeSlot = (timeStr) => {
    if (!timeStr) return "09:00 AM";
    const parts = timeStr.split(":");
    if (parts.length < 2) return timeStr;
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  };

  // Format Date string title
  const getHeaderDateString = () => {
    if (view === "month") {
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    } else if (view === "week") {
      const week = getWeekDays(currentDate);
      const start = week[0];
      const end = week[6];
      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString("en-US", { month: "short" })} ${start.getFullYear()}`;
      } else {
        return `${start.toLocaleDateString("en-US", { month: "short" })} - ${end.toLocaleDateString("en-US", { month: "short" })} ${end.getFullYear()}`;
      }
    } else {
      return currentDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 flex flex-col font-sans select-none">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 flex flex-col">
        {/* Navigation & Toolbar Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-5 border-b border-slate-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <CalendarIcon className="w-7 h-7 text-blue-600" />
              Calendar & Schedule
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs sm:text-sm">
              Visualize your upcoming schedule, review minutes, and manage
              meeting timelines.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => {
                window.location.href =
                  "http://localhost:4000/api/auth/google-calendar";
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 rounded-xl transition-all shadow-sm cursor-pointer w-full md:w-auto justify-center"
            >
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              Sync Google Calendar
            </button>
            <button
              onClick={() => navigate("/create-meeting")}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10 cursor-pointer w-full md:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              Schedule Meeting
            </button>
          </div>
        </div>

        {/* Calendar Nav + Filters Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Prev/Next buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs shrink-0">
                <button
                  onClick={handlePrev}
                  className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700 cursor-pointer"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToday}
                  className="px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer bg-white dark:bg-slate-900"
                >
                  Today
                </button>
                <button
                  onClick={handleNext}
                  className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700 cursor-pointer"
                  aria-label="Next"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-sans tracking-tight ml-2">
                {getHeaderDateString()}
              </h2>
            </div>

            {/* View togglers */}
            <div className="bg-slate-100/80 dark:bg-slate-800 p-0.5 rounded-xl flex border border-slate-200/40 dark:border-slate-700 w-full sm:w-auto shadow-inner">
              {["month", "week", "day"].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg capitalize transition-all cursor-pointer ${
                    view === v
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs border border-slate-200/20"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filters:</span>
            </div>

            {/* Date filter (Jump to Date) */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 select-none">
              <span className="text-[10px] text-slate-400 uppercase font-bold mr-1">
                Date:
              </span>
              <input
                type="date"
                value={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`}
                onChange={(e) => {
                  if (e.target.value) {
                    setCurrentDate(new Date(e.target.value + "T00:00:00"));
                  }
                }}
                className="bg-transparent border-none text-slate-700 dark:text-slate-300 outline-none cursor-pointer text-xs font-semibold"
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 outline-none transition-all cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="uploaded">Uploaded / Upcoming</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 outline-none transition-all cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="conference">Conference</option>
              <option value="policy">Policy</option>
              <option value="event">Event</option>
              <option value="internal">Internal</option>
            </select>

            {/* Org Filter */}
            <select
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 outline-none transition-all cursor-pointer"
            >
              <option value="all">All Organizations</option>
              <option value="personal">Personal Meetings (None)</option>
              {uniqueOrgs.map((org) => (
                <option key={org} value={org}>
                  {org}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex-1 min-h-[400px] flex flex-col justify-center items-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
            <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
            <span className="ml-3 text-slate-500 dark:text-slate-400 font-medium mt-2">
              Fetching meetings...
            </span>
          </div>
        ) : filteredMeetings.length === 0 ? (
          /* Empty State */
          <div className="flex-1 min-h-[400px] flex flex-col justify-center items-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xs">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700">
              <Inbox className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              No Scheduled Meetings
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 max-w-sm">
              There are no meetings scheduled matching the selected filters.
              Change filters or create a new meeting.
            </p>
            <button
              onClick={() => navigate("/create-meeting")}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Schedule New Meeting
            </button>
          </div>
        ) : (
          /* CALENDAR VIEWS */
          <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {/* MONTH VIEW */}
            {view === "month" && (
              <div className="flex flex-col h-full min-w-[700px]">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider py-3 text-center">
                  <div>Sun</div>
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                  <div>Fri</div>
                  <div>Sat</div>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 flex-1 min-h-[500px]">
                  {buildMonthGrid().map((cell, idx) => {
                    const dayEvents = filteredMeetings.filter((m) =>
                      isSameDay(new Date(m.date), cell.date),
                    );
                    const isToday = isSameDay(new Date(), cell.date);

                    return (
                      <div
                        key={idx}
                        className={`min-h-[100px] p-2 border-r border-b border-slate-100 dark:border-slate-800 last:border-r-0 flex flex-col justify-between transition-colors ${
                          cell.isCurrentMonth
                            ? "bg-white dark:bg-slate-900"
                            : "bg-slate-50/50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600"
                        }`}
                      >
                        {/* Day Number */}
                        <div className="flex justify-between items-center mb-1">
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded-full flex items-center justify-center ${
                              isToday
                                ? "bg-blue-600 text-white shadow-xs"
                                : cell.isCurrentMonth
                                  ? "text-slate-700 dark:text-slate-300"
                                  : "text-slate-400 dark:text-slate-600"
                            }`}
                          >
                            {cell.date.getDate()}
                          </span>
                        </div>

                        {/* Events list */}
                        <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[85px] py-1">
                          {dayEvents.slice(0, 3).map((event) => {
                            const style = getStatusStyle(event.status);
                            return (
                              <button
                                key={event._id}
                                onClick={() => setSelectedMeeting(event)}
                                className={`w-full text-left p-1.5 rounded-lg border text-[10px] font-semibold truncate flex items-center gap-1.5 transition-all cursor-pointer select-none ${style.bg}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`}
                                />
                                <span className="truncate">{event.title}</span>
                              </button>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <div className="text-[9px] font-bold text-blue-600 text-center py-0.5">
                              + {dayEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WEEK VIEW */}
            {view === "week" && (
              <div className="flex flex-col h-full min-w-[800px]">
                {/* Week Headers */}
                <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider py-3 text-center">
                  <div className="border-r border-slate-100 dark:border-slate-700">
                    Time
                  </div>
                  {getWeekDays(currentDate).map((day, idx) => {
                    const isToday = isSameDay(new Date(), day);
                    return (
                      <div
                        key={idx}
                        className="flex flex-col items-center justify-center gap-0.5"
                      >
                        <span>
                          {day.toLocaleDateString("en-US", {
                            weekday: "short",
                          })}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full flex items-center justify-center ${
                            isToday
                              ? "bg-blue-600 text-white font-bold"
                              : "text-slate-800"
                          }`}
                        >
                          {day.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Weekly Time Grid */}
                <div className="flex flex-col flex-1 h-[600px] overflow-y-auto">
                  <div className="grid grid-cols-8 relative h-[650px]">
                    {/* Y-Axis Hourly labels */}
                    <div className="col-span-1 border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col justify-between py-2 text-[10px] text-slate-400 font-bold text-right pr-3">
                      {Array.from({ length: 13 }).map((_, h) => (
                        <div
                          key={h}
                          className="h-[50px] flex items-start justify-end"
                        >
                          {h + 8 < 12
                            ? `${h + 8}:00 AM`
                            : h + 8 === 12
                              ? "12:00 PM"
                              : `${h + 8 - 12}:00 PM`}
                        </div>
                      ))}
                    </div>

                    {/* Weekday columns mapping slots */}
                    {getWeekDays(currentDate).map((day, dIdx) => {
                      const dayEvents = filteredMeetings.filter((m) =>
                        isSameDay(new Date(m.date), day),
                      );

                      return (
                        <div
                          key={dIdx}
                          className="col-span-1 border-r border-slate-100 dark:border-slate-800 last:border-r-0 relative bg-white dark:bg-slate-900 h-full"
                        >
                          {/* Hour Dividers in background */}
                          {Array.from({ length: 13 }).map((_, h) => (
                            <div
                              key={h}
                              className="absolute left-0 right-0 border-b border-slate-50"
                              style={{ top: `${h * 50}px`, height: "50px" }}
                            />
                          ))}

                          {/* Placed Events */}
                          {dayEvents.map((event) => {
                            const style = getStatusStyle(event.status);
                            const minutesFromMidnight = parseTimeToMinutes(
                              event.time,
                            );

                            // Map to start hour (08:00 = 480 mins). Hour size = 50px (50px / 60 mins = 0.83px/min)
                            const startMins = 8 * 60;
                            const top = Math.max(
                              0,
                              (minutesFromMidnight - startMins) * (50 / 60),
                            );
                            const duration = event.duration || 60;
                            const height = Math.max(35, duration * (50 / 60));

                            return (
                              <button
                                key={event._id}
                                onClick={() => setSelectedMeeting(event)}
                                className={`absolute left-1 right-1 p-2 rounded-xl border text-[10px] font-bold text-left overflow-hidden flex flex-col justify-between transition-all shadow-xs hover:z-10 cursor-pointer select-none ${style.bg}`}
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                }}
                              >
                                <div className="truncate pr-1">
                                  {event.title}
                                </div>
                                <div className="text-[8px] text-slate-500/80 font-semibold flex items-center gap-1 mt-0.5">
                                  <Clock className="w-2.5 h-2.5 shrink-0" />
                                  <span>{formatTimeSlot(event.time)}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* DAY VIEW */}
            {view === "day" && (
              <div className="flex flex-col h-full md:flex-row">
                {/* Left side Timeline Column */}
                <div className="flex-1 flex flex-col border-r border-slate-100 max-h-[600px] overflow-y-auto">
                  <div className="bg-slate-50/50 dark:bg-slate-800/50 py-3 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Timeline
                    </h3>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Hourly Schedule
                    </span>
                  </div>

                  <div className="relative h-[650px] p-4 pr-6 flex">
                    {/* Hourly scale */}
                    <div className="w-20 text-[10px] text-slate-400 font-bold text-right pr-3 flex flex-col justify-between py-2 shrink-0">
                      {Array.from({ length: 13 }).map((_, h) => (
                        <div
                          key={h}
                          className="h-[50px] flex items-start justify-end"
                        >
                          {h + 8 < 12
                            ? `${h + 8}:00 AM`
                            : h + 8 === 12
                              ? "12:00 PM"
                              : `${h + 8 - 12}:00 PM`}
                        </div>
                      ))}
                    </div>

                    {/* Timeline grid content */}
                    <div className="flex-1 relative border-l border-slate-100 pl-4 h-full">
                      {/* Hour Grid Dividers */}
                      {Array.from({ length: 13 }).map((_, h) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-b border-slate-100/50"
                          style={{ top: `${h * 50}px`, height: "50px" }}
                        />
                      ))}

                      {/* Day events mapped */}
                      {filteredMeetings
                        .filter((m) => isSameDay(new Date(m.date), currentDate))
                        .map((event) => {
                          const style = getStatusStyle(event.status);
                          const minutesFromMidnight = parseTimeToMinutes(
                            event.time,
                          );

                          const startMins = 8 * 60;
                          const top = Math.max(
                            0,
                            (minutesFromMidnight - startMins) * (50 / 60),
                          );
                          const duration = event.duration || 60;
                          const height = Math.max(40, duration * (50 / 60));

                          return (
                            <button
                              key={event._id}
                              onClick={() => setSelectedMeeting(event)}
                              className={`absolute left-2 right-4 p-3 rounded-xl border text-left flex flex-col justify-between transition-all shadow-xs hover:z-10 cursor-pointer select-none ${style.bg}`}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                              }}
                            >
                              <div className="font-bold text-xs truncate">
                                {event.title}
                              </div>
                              <div className="text-[10px] text-slate-500/80 font-bold flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {formatTimeSlot(event.time)} ({duration} mins)
                                </span>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* Right side chronological list card */}
                <div className="w-full md:w-80 bg-slate-50/50 dark:bg-slate-800/50 p-5 flex flex-col h-full max-h-[600px] overflow-y-auto">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4">
                    List Agenda
                  </h3>

                  <div className="space-y-3.5">
                    {filteredMeetings
                      .filter((m) => isSameDay(new Date(m.date), currentDate))
                      .sort(
                        (a, b) =>
                          parseTimeToMinutes(a.time) -
                          parseTimeToMinutes(b.time),
                      )
                      .map((event) => {
                        const style = getStatusStyle(event.status);
                        const StatusIcon = style.icon;

                        return (
                          <div
                            key={event._id}
                            onClick={() => setSelectedMeeting(event)}
                            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 p-4 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-start gap-3"
                          >
                            <div
                              className={`p-2 rounded-xl shrink-0 ${style.bg} border`}
                            >
                              <StatusIcon className="w-4 h-4" />
                            </div>
                            <div className="overflow-hidden space-y-1">
                              <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                                {event.title}
                              </h4>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">
                                {formatTimeSlot(event.time)}
                              </p>
                              {event.organization && (
                                <p className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1">
                                  <Briefcase className="w-3 h-3 text-slate-400" />
                                  {event.organization.name ||
                                    event.organization}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* QUICK DETAILS MODAL */}
      {selectedMeeting && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 relative overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedMeeting(null)}
              className="absolute right-4 top-4 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header info */}
            <div className="mb-5 pr-6">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-2 border ${getStatusStyle(selectedMeeting.status).badge}`}
              >
                {selectedMeeting.status}
              </span>
              <h3 className="text-xl font-bold text-slate-900 leading-tight">
                {selectedMeeting.title}
              </h3>
            </div>

            {/* Detail rows */}
            <div className="space-y-4 text-sm text-slate-600 border-t border-b border-slate-100 py-4 mb-5">
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-800">
                    {new Date(selectedMeeting.date).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-bold uppercase mt-0.5">
                    {formatTimeSlot(selectedMeeting.time)} (
                    {selectedMeeting.duration || 60} mins)
                  </div>
                </div>
              </div>

              {selectedMeeting.organization && (
                <div className="flex items-center gap-3">
                  <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800">
                      Organization:
                    </span>{" "}
                    {selectedMeeting.organization.name ||
                      selectedMeeting.organization}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-800">Type:</span>{" "}
                  <span className="capitalize">
                    {selectedMeeting.meetingType || "Conference"}
                  </span>
                </div>
              </div>

              {selectedMeeting.location && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800">
                      Location:
                    </span>{" "}
                    {selectedMeeting.location}
                  </div>
                </div>
              )}

              {selectedMeeting.description && (
                <div className="pt-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Description
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {selectedMeeting.description}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Actions buttons */}
            <div className="flex justify-end gap-3">
              {selectedMeeting.recordingType === "live" &&
                selectedMeeting.status !== "failed" && (
                  <button
                    onClick={() => {
                      setSelectedMeeting(null);
                      navigate("/meeting-room");
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Join Live Room
                  </button>
                )}
              <button
                onClick={() => {
                  setSelectedMeeting(null);
                  navigate(`/meeting/${selectedMeeting._id}`);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View full details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
