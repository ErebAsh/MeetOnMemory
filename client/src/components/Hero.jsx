import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowRight,
  FaPlay,
  FaRobot,
  FaSearch,
  FaFileAlt,
  FaBuilding,
} from "react-icons/fa";

// Reusable hook for IntersectionObserver fade-in
const useFadeIn = () => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
};

const StatItem = ({ emoji, label, sub }) => (
  <div className="text-center">
    <div className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
      {emoji}
    </div>
    <div className="text-sm font-semibold text-gray-800 mt-0.5">{label}</div>
    <div className="text-xs text-gray-500">{sub}</div>
  </div>
);

const Hero = () => {
  const navigate = useNavigate();
  const contentRef = useFadeIn();
  const mockupRef = useFadeIn();

  const handleGetStarted = () => {
    navigate("/login?mode=signup");
  };

  const handleLearnMore = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-linear-to-br from-blue-50 via-white to-purple-50 pt-16"
    >
      {/* Decorative background blobs */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-72 h-72 sm:w-96 sm:h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-72 h-72 sm:w-96 sm:h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 sm:w-96 sm:h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-16 items-center">
          {/* Left — Text Content */}
          <div ref={contentRef} className="fade-in-up text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6 border border-blue-200">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              AI-Powered Knowledge Management
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-6">
              Never Lose{" "}
              <span className="bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Meeting Knowledge
              </span>{" "}
              Again
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              MeetOnMemory is an AI-powered platform that transforms meeting
              recordings and transcripts into searchable, structured knowledge.
              Preserve institutional memory and make every conversation count.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              <button
                onClick={handleGetStarted}
                id="hero-get-started-btn"
                className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-base hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 active:scale-100 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label="Get Started with MeetOnMemory"
              >
                Get Started
                <FaArrowRight className="group-hover:translate-x-1 transition-transform duration-300" />
              </button>
              <button
                onClick={handleLearnMore}
                id="hero-learn-more-btn"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-gray-700 rounded-xl font-semibold text-base border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 hover:shadow-lg active:scale-100 transition-all duration-300 hover:scale-105 focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Learn more about MeetOnMemory features"
              >
                <FaPlay className="text-blue-600 text-sm" />
                Learn More
              </button>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mt-12 pt-8 border-t border-gray-200">
              <StatItem
                emoji="⚡"
                label="AI-Powered"
                sub="Intelligent Processing"
              />
              <StatItem
                emoji="🔍"
                label="Instant Search"
                sub="Semantic Retrieval"
              />
              <StatItem
                emoji="📝"
                label="Auto-Summaries"
                sub="Meeting Minutes"
              />
              <StatItem emoji="🏢" label="500+ Orgs" sub="Trust MeetOnMemory" />
            </div>
          </div>

          {/* Right — Dashboard Mockup */}
          <div
            ref={mockupRef}
            className="fade-in-up stagger-3 relative flex justify-center items-center"
            aria-hidden="true"
          >
            <div className="relative w-full max-w-sm sm:max-w-md animate-float">
              {/* Glow rings */}
              <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-blue-400/20 to-purple-400/20 blur-2xl scale-110" />

              {/* Dashboard card */}
              <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 sm:p-6">
                {/* Mockup browser chrome */}
                <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
                  <div className="w-3 h-3 bg-red-400 rounded-full" />
                  <div className="w-3 h-3 bg-yellow-400 rounded-full" />
                  <div className="w-3 h-3 bg-green-400 rounded-full" />
                  <div className="flex-1 mx-3 h-6 bg-gray-100 rounded-md flex items-center px-3">
                    <span className="text-xs text-gray-400 truncate">
                      meetonmemory.app/dashboard
                    </span>
                  </div>
                </div>

                {/* Mockup content rows */}
                <div className="space-y-3">
                  {[
                    {
                      icon: <FaRobot className="text-blue-600 text-lg" />,
                      bg: "bg-blue-50",
                      label: "AI Meeting Summary",
                      sub: "Q4 Planning Meeting",
                      badge: "New",
                      badgeColor: "bg-blue-100 text-blue-700",
                    },
                    {
                      icon: <FaSearch className="text-purple-600 text-lg" />,
                      bg: "bg-purple-50",
                      label: "Smart Search",
                      sub: '"budget 2025"',
                      badge: "3 results",
                      badgeColor: "bg-purple-100 text-purple-700",
                    },
                    {
                      icon: <FaFileAlt className="text-green-600 text-lg" />,
                      bg: "bg-green-50",
                      label: "Policy Document",
                      sub: "v2.3 • Updated today",
                      badge: "Updated",
                      badgeColor: "bg-green-100 text-green-700",
                    },
                    {
                      icon: <FaBuilding className="text-orange-600 text-lg" />,
                      bg: "bg-orange-50",
                      label: "Institutional Memory",
                      sub: "1,847 records stored",
                      badge: "Active",
                      badgeColor: "bg-orange-100 text-orange-700",
                    },
                  ].map(({ icon, bg, label, sub, badge, badgeColor }) => (
                    <div
                      key={label}
                      className={`flex items-center gap-3 ${bg} p-3 rounded-xl hover:scale-[1.02] transition-transform duration-200`}
                    >
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-800 truncate">
                          {label}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {sub}
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${badgeColor}`}
                      >
                        {badge}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Subtle footer */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    Last synced: just now
                  </span>
                  <span className="text-xs font-medium text-blue-600 cursor-pointer hover:underline">
                    View all →
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
