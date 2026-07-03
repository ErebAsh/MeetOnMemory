import React from 'react';
import { FaArrowRight, FaPlay, FaRobot, FaSearch, FaFileAlt, FaBuilding } from 'react-icons/fa';

const Hero = () => {
  // Handle CTA button clicks
  const handleGetStarted = () => {
    // Navigate to signup or dashboard
    window.location.href = '/signup';
    // Or if using React Router:
    // navigate('/signup');
  };

  const handleLearnMore = () => {
    // Scroll to features section or navigate to about
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
    // Or if using React Router:
    // navigate('/about');
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-linear-to-br from-blue-50 via-white to-purple-50">
      {/* Background decorative elements - hidden from screen readers */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* Blob 1 */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        {/* Blob 2 */}
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        {/* Blob 3 */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              AI-Powered Knowledge Management
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Never Lose{' '}
              <span className="bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Meeting Knowledge
              </span>{' '}
              Again
            </h1>

            {/* Description */}
            <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0">
              MeetOnMemory is an AI-powered platform that transforms meeting recordings and transcripts 
              into searchable, structured knowledge. Preserve institutional memory and make every 
              conversation count.
            </p>

            {/* CTA Buttons - Now with functionality */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button 
                onClick={handleGetStarted}
                className="group px-8 py-4 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
                aria-label="Get Started with MeetOnMemory"
              >
                Get Started
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={handleLearnMore}
                className="px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
                aria-label="Learn more about MeetOnMemory"
              >
                <FaPlay className="text-blue-600" />
                Learn More
              </button>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-12 pt-8 border-t border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">⚡ AI-Powered</div>
                <div className="text-sm text-gray-500">Intelligent Processing</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">🔍 Instant Search</div>
                <div className="text-sm text-gray-500">Semantic Retrieval</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">📝 Auto-Summaries</div>
                <div className="text-sm text-gray-500">Meeting Minutes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">🏢 500+</div>
                <div className="text-sm text-gray-500">Organizations</div>
              </div>
            </div>
          </div>

          {/* Right - Illustration/Visual */}
          <div className="relative flex justify-center items-center" aria-hidden="true">
            <div className="relative w-full max-w-md">
              {/* Dashboard Mockup */}
              <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-100">
                {/* Mockup header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <div className="flex-1"></div>
                  <div className="text-xs text-gray-400">MeetOnMemory</div>
                </div>
                
                {/* Mockup content */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg">
                    <FaRobot className="text-blue-600 text-xl" />
                    <div>
                      <div className="font-semibold text-sm">AI Meeting Summary</div>
                      <div className="text-xs text-gray-500">Q4 Planning Meeting</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-purple-50 p-3 rounded-lg">
                    <FaSearch className="text-purple-600 text-xl" />
                    <div>
                      <div className="font-semibold text-sm">Smart Search</div>
                      <div className="text-xs text-gray-500">"budget 2025"</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-green-50 p-3 rounded-lg">
                    <FaFileAlt className="text-green-600 text-xl" />
                    <div>
                      <div className="font-semibold text-sm">Policy Document</div>
                      <div className="text-xs text-gray-500">v2.3 • Updated today</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-orange-50 p-3 rounded-lg">
                    <FaBuilding className="text-orange-600 text-xl" />
                    <div>
                      <div className="font-semibold text-sm">Institutional Memory</div>
                      <div className="text-xs text-gray-500">1,847 records stored</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating decorative elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-linear-to-br from-blue-400 to-purple-400 rounded-2xl opacity-20 blur-2xl"></div>
              <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-linear-to-br from-purple-400 to-pink-400 rounded-2xl opacity-20 blur-2xl"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;