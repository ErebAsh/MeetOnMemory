import React, { useCallback } from "react";
import { Link } from "react-router-dom";
import { Github, ArrowUp } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleNavLink = (href) => {
    if (href.startsWith("#")) {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <footer className="bg-white border-t border-gray-200 pt-16 pb-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">

         {/* Column 1: Project Info */}
          <div className="flex flex-col gap-4 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center">
                {/* Clean Native Option A Infinity Symbol tuned for Footer Sizing */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-10 h-10 transition-transform duration-300">
                  <defs>
                    <linearGradient id="footerInfinityGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#2563eb" />
                      <stop offset="100%" stop-color="#7c3aed" />
                    </linearGradient>
                  </defs>
                  <path d="M25,50 C25,35 38,30 50,50 C62,70 75,65 75,50 C75,35 62,30 50,50 C38,70 25,65 25,50 Z" 
                        fill="none" stroke="url(#footerInfinityGrad)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="25" cy="50" r="6.5" fill="#2563eb" />
                  <circle cx="75" cy="50" r="6.5" fill="#7c3aed" />
                </svg>
              </div>
              <span className="font-bold text-xl text-gray-900 tracking-tight">
                MeetOn<span className="text-blue-600">Memory</span>
              </span>
            </div>
            <p className="text-gray-600 text-sm font-medium leading-snug">
              AI-Powered Meeting Memory &amp; Management Platform
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Transform meetings, discussions, and organizational knowledge into
              a searchable and structured repository using AI.
            </p>
            {/* GitHub social link */}
            <a
              href="https://github.com/imuniqueshiv/MeetOnMemory"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MeetOnMemory GitHub repository"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors duration-200 mt-1 group w-fit"
            >
              <Github className="w-4 h-4 group-hover:scale-110 transition-transform" />
              View on GitHub
            </a>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-5">
              Quick Links
            </h3>
            <ul className="flex flex-col gap-3">
              <li>
                <Link
                  to="/"
                  className="text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200 inline-block"
                >
                  Home
                </Link>
              </li>
              <li>
                <button
                  onClick={() => handleNavLink("#features")}
                  className="text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200 inline-block text-left"
                  aria-label="Scroll to Features section"
                >
                  Features
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavLink("#how-it-works")}
                  className="text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200 inline-block text-left"
                  aria-label="Scroll to How It Works section"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNavLink("#about")}
                  className="text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200 inline-block text-left"
                  aria-label="Scroll to About section"
                >
                  About
                </button>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200 inline-block"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200 inline-block"
                >
                  Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-5">
              Resources
            </h3>
            <ul className="flex flex-col gap-3">
              <li>
                <a
                  href="https://github.com/imuniqueshiv/MeetOnMemory"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="MeetOnMemory GitHub repository (opens in new tab)"
                  className="text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200 inline-block"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/imuniqueshiv/MeetOnMemory/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Report issues on GitHub (opens in new tab)"
                  className="text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200 inline-block"
                >
                  Report Issues
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/imuniqueshiv/MeetOnMemory/blob/main/CONTRIBUTING.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Contributing guide (opens in new tab)"
                  className="text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200 inline-block"
                >
                  Contributing
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/imuniqueshiv/MeetOnMemory/blob/main/CODE_OF_CONDUCT.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Code of Conduct (opens in new tab)"
                  className="text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200 inline-block"
                >
                  Code of Conduct
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Built with */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-5">
              Built with
            </h3>
            <ul className="flex flex-col gap-2.5">
              {[
                "React",
                "Node.js",
                "Express",
                "MongoDB",
                "Google Gemini",
                "Pinecone",
              ].map((tech) => (
                <li key={tech} className="flex items-center gap-2 text-sm text-gray-500">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-linear-to-br from-blue-600 to-violet-600 flex-shrink-0"
                    aria-hidden="true"
                  />
                  {tech}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-sm">
            &copy; {currentYear} MeetOnMemory. All rights reserved.
          </p>
          <p className="text-gray-400 text-sm">
            Built with ❤️ by the MeetOnMemory Community.
          </p>
          {/* Back to top */}
          <button
            onClick={scrollToTop}
            aria-label="Scroll back to top"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-600 transition-colors duration-200 group focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md px-1"
          >
            <ArrowUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform duration-200" />
            Back to top
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
