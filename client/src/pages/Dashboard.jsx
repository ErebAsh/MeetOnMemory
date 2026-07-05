import React, { useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppContent from "../context/AppContent";
import {
  Building2,
  FileText,
  Upload,
  BarChart3,
  Brain,
  Database,
  Search,
  ArrowRight,
  Sparkles,
  Shield,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";

/* ─── Role Badge ──────────────────────────────────────────────────────────── */
const ROLE_STYLES = {
  admin: "bg-violet-500/20 text-violet-300 border border-violet-500/30",
  manager: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  member: "bg-sky-500/20 text-sky-300 border border-sky-500/30",
  guest: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
};

/* ─── Feature Card Config ─────────────────────────────────────────────────── */
const FEATURE_CARDS = [
  {
    id: "upload-meeting",
    icon: Upload,
    title: "Upload Recorded Meetings",
    description:
      "Upload and transcribe past meetings automatically using AI-powered speech-to-text.",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    accentBorder: "group-hover:border-blue-200",
    accentGlow: "group-hover:shadow-blue-100/60",
    tag: "Transcription",
    tagColor: "bg-blue-50 text-blue-600",
  },
  {
    id: "create-meeting",
    icon: FileText,
    title: "Meeting & Event Hub",
    description:
      "Schedule, upload, and organise events or sessions for instant AI-driven summaries.",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    accentBorder: "group-hover:border-emerald-200",
    accentGlow: "group-hover:shadow-emerald-100/60",
    tag: "Scheduling",
    tagColor: "bg-emerald-50 text-emerald-600",
  },
  {
    id: "summaries",
    icon: Brain,
    title: "AI Summarization",
    description:
      "Generate professional Minutes of Meeting with decisions, action points, and key insights.",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    accentBorder: "group-hover:border-violet-200",
    accentGlow: "group-hover:shadow-violet-100/60",
    tag: "AI-Powered",
    tagColor: "bg-violet-50 text-violet-600",
  },
  {
    id: "policies",
    icon: Shield,
    title: "Policies & Rules Repository",
    description:
      "Upload, version, and audit organisational policies with AI-powered insights and search.",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    accentBorder: "group-hover:border-amber-200",
    accentGlow: "group-hover:shadow-amber-100/60",
    tag: "Compliance",
    tagColor: "bg-amber-50 text-amber-600",
  },
  {
    id: "reports",
    icon: BarChart3,
    title: "Reports & Analytics",
    description:
      "Visualise organisational metrics — meetings, updates, and performance trends at a glance.",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    accentBorder: "group-hover:border-indigo-200",
    accentGlow: "group-hover:shadow-indigo-100/60",
    tag: "Analytics",
    tagColor: "bg-indigo-50 text-indigo-600",
  },
];

/* ─── Dashboard ───────────────────────────────────────────────────────────── */
const Dashboard = () => {
  const { userData } = useContext(AppContent);
  const navigate = useNavigate();
  const gridRef = useRef(null);

  const organizationName =
    userData?.organization?.name?.toUpperCase() || "ORGANIZATION";

  const rawRole = userData?.role || "member";
  const displayRole =
    rawRole.charAt(0).toUpperCase() + rawRole.slice(1).toLowerCase();
  const roleStyle =
    ROLE_STYLES[rawRole.toLowerCase()] || ROLE_STYLES.member;

  /* ── Route map for feature cards ── */
  const ROUTE_MAP = {
    "upload-meeting": "/upload-meeting",
    "create-meeting": "/create-meeting",
    summaries: "/summaries",
    policies: "/policies",
    reports: "/reports",
  };

  /* ── Intersection observer for staggered card entrance ── */
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll(".dash-card");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  /* ── Handlers ── */
  const handleAISearch = () => navigate("/ai-search");
  const handleCardClick = (id) => navigate(ROUTE_MAP[id]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* ══════════════════════════════════════════
          ZONE 1 — Dark Hero Header
      ══════════════════════════════════════════ */}
      <section
        aria-label="Dashboard hero"
        className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 pt-28 pb-20 px-6"
      >
        {/* Decorative background blobs */}
        <div
          aria-hidden="true"
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 right-0 w-80 h-80 rounded-full bg-violet-600/10 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-900/20 blur-3xl pointer-events-none"
        />

        <div className="relative max-w-4xl mx-auto flex flex-col items-center text-center gap-6">
          {/* ── Org Icon + Name ── */}
          <div className="flex flex-col items-center gap-4 fade-in-up stagger-1">
            {/* Icon pill */}
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
              <Building2 className="w-8 h-8 text-white" aria-hidden="true" />
            </div>

            {/* Org name */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              {organizationName}
            </h1>

            {/* Role badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${roleStyle}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-current opacity-70"
                aria-hidden="true"
              />
              {displayRole}
            </span>

            {/* Welcome message */}
            <p className="text-slate-400 text-base sm:text-lg max-w-md leading-relaxed">
              Welcome back,{" "}
              <span className="text-white font-semibold">
                {userData?.name || "there"}
              </span>
              . Everything you need is right here.
            </p>
          </div>

          {/* ── AI Smart Search Hero Card ── */}
          <div
            className="w-full max-w-lg mt-4 fade-in-up stagger-3"
            role="region"
            aria-label="AI Smart Search"
          >
            {/* Outer shimmer glow ring */}
            <div className="relative rounded-2xl p-px bg-gradient-to-r from-blue-500 via-violet-500 to-indigo-500 shadow-2xl shadow-blue-500/20">
              <div className="relative bg-slate-900/90 backdrop-blur-md rounded-2xl px-7 py-6 flex flex-col items-center gap-4">
                {/* Badge */}
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                    AI-Powered
                  </span>
                </div>

                {/* Title + description */}
                <div className="text-center">
                  <h2 className="text-lg font-bold text-white mb-1 flex items-center justify-center gap-2">
                    <Search className="w-5 h-5 text-blue-400" aria-hidden="true" />
                    Smart Search
                  </h2>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Instantly find insights across your meetings, summaries, and
                    policies — powered by AI.
                  </p>
                </div>

                {/* CTA */}
                <button
                  id="dashboard-ai-search-btn"
                  onClick={handleAISearch}
                  aria-label="Open AI Smart Search"
                  className="group/btn flex items-center gap-2 px-7 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:from-blue-500 hover:to-indigo-500 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 cursor-pointer"
                >
                  Open AI Search
                  <ArrowRight
                    className="w-4 h-4 transition-transform duration-200 group-hover/btn:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom fade into light zone */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none"
        />
      </section>

      {/* ══════════════════════════════════════════
          ZONE 2 — Feature Cards Grid
      ══════════════════════════════════════════ */}
      <section
        aria-label="Dashboard features"
        className="flex-1 bg-slate-50 px-6 pt-8 pb-20"
      >
        <div className="max-w-6xl mx-auto">
          {/* Section heading */}
          <div className="mb-8 fade-in-up stagger-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
              Features
            </h2>
            <p className="text-slate-700 font-semibold text-lg">
              Everything you need, in one place
            </p>
          </div>

          {/* Cards grid */}
          <div
            ref={gridRef}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {FEATURE_CARDS.map((card, index) => {
              const Icon = card.icon;
              const staggerClass = `stagger-${Math.min(index + 1, 6)}`;
              return (
                <div
                  key={card.id}
                  id={`dashboard-card-${card.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Navigate to ${card.title}`}
                  onClick={() => handleCardClick(card.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardClick(card.id);
                    }
                  }}
                  className={`dash-card fade-in-up ${staggerClass} group relative bg-white rounded-2xl border border-slate-200/80 shadow-sm cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${card.accentGlow} ${card.accentBorder} hover:border-opacity-100 p-6 flex flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}
                >
                  {/* Top row: icon + tag */}
                  <div className="flex items-start justify-between">
                    {/* Icon chip */}
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-xl ${card.iconBg} transition-transform duration-300 group-hover:scale-110`}
                    >
                      <Icon
                        className={`w-6 h-6 ${card.iconColor}`}
                        aria-hidden="true"
                      />
                    </div>

                    {/* Feature tag */}
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${card.tagColor} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                    >
                      {card.tag}
                    </span>
                  </div>

                  {/* Text */}
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-slate-800 mb-1.5 leading-snug">
                      {card.title}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {card.description}
                    </p>
                  </div>

                  {/* Footer CTA arrow */}
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors duration-200 pt-1 border-t border-slate-100">
                    <span>Open</span>
                    <ArrowRight
                      className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
