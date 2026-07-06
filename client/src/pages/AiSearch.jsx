import React, { useState, useContext } from "react";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent.js";  // ✅

// Modal Component for showing full details
const ResultModal = ({ result, onClose }) => {
  if (!result) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-gray-900">{result.title || "Untitled Meeting"}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Summary</h3>
            <p className="text-gray-700 mt-1 leading-relaxed">
              {result.summary || result.transcript || "No summary available."}
            </p>
          </div>

          {result.transcript && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase">Transcript</h3>
              <p className="text-gray-600 text-sm mt-1 leading-relaxed max-h-40 overflow-y-auto bg-gray-50 p-3 rounded-lg">
                {result.transcript}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Date</span>
              <p className="font-medium text-gray-800">
                {result.createdAt
                  ? new Date(result.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Unknown"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Similarity Score</span>
              <p className="font-medium text-gray-800">
                {result.similarityScore || "N/A"}
              </p>
            </div>
          </div>

          {result.tags && result.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase">Tags</h3>
              <div className="flex flex-wrap gap-2 mt-1">
                {result.tags.map((tag) => (
                  <span key={tag} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
};

const AiSearch = () => {
  const { backendUrl } = useContext(AppContent);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedResult, setSelectedResult] = useState(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch(`${backendUrl}/api/ai-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      // console.log("🔍 Search results from backend:", data);

      setResults(data.results || []);
      if (data.results?.length === 0) {
        setError("No matching meetings found. Try a different query.");
      }
    } catch (err) {
      console.error("❌ Search error:", err);
      
      // Network error handling
      if (err.message === "Failed to fetch") {
        setError("Unable to connect to the server. Please check your internet connection and try again.");
      } else if (err.message.includes("500")) {
        setError("Server error. Please try again later.");
      } else if (err.message.includes("404")) {
        setError("Search service not found. Please contact support.");
      } else {
        setError(err.message || "Failed to fetch results. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
      <Navbar />

      <div className="max-w-4xl mx-auto pt-28 px-6 flex flex-col items-center text-center">
        {/* Header */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-3 tracking-tight">
          🤖 Smart AI Meeting Search
        </h1>
        <p className="text-gray-600 mb-8 text-sm md:text-base max-w-2xl">
          Search across your <b>meeting transcripts</b>, <b>policies</b>, and{" "}
          <b>AI summaries</b> using natural language — powered by your intelligent semantic engine.
        </p>

        {/* Search Input */}
        <div className="w-full bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <input
              type="text"
              placeholder="Ask e.g. 'What decisions were made in the finance meeting?'"
              className="flex-grow px-5 py-3 text-sm md:text-base border border-gray-200 rounded-full shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 md:px-8 md:py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Searching...
                </span>
              ) : (
                "Search"
              )}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-left">
              <span className="font-semibold">⚠️ {error.includes("Unable to connect") ? "Connection Error" : "Error"}</span>
              <p className="mt-1">{error}</p>
            </div>
          )}
        </div>

        {/* Search Results Section */}
        <div className="mt-10 w-full text-left">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-3"></div>
              <p className="text-gray-600 font-medium">Searching your meetings...</p>
              <p className="text-gray-400 text-sm mt-1">This may take a few seconds</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-5">
              <div className="flex justify-between items-center mb-3">
                <p className="text-gray-600 font-medium">
                  Found {results.length} relevant meeting
                  {results.length > 1 ? "s" : ""}:
                </p>
                <button
                  onClick={() => setResults([])}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  Clear results
                </button>
              </div>

              {results.map((result, index) => (
                <div
                  key={result.meetingId || index}
                  className="group p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer"
                  onClick={() => setSelectedResult(result)}
                >
                  {/* Title */}
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition">
                      {result.title || "Untitled Meeting"}
                    </h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                      Score: {result.similarityScore || "N/A"}
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="text-gray-700 text-sm mt-2 leading-relaxed line-clamp-3">
                    {result.summary ||
                      result.transcript?.slice(0, 200) ||
                      "No summary available."}
                  </p>

                  {/* Metadata */}
                  <div className="flex justify-between items-center text-xs text-gray-500 mt-4">
                    <span>
                      📅{" "}
                      {result.createdAt
                        ? new Date(result.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Unknown date"}
                    </span>
                    <button className="text-blue-600 font-medium hover:underline">
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && results.length === 0 && !error && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">
                💬 Type your question above to start exploring with AI
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Result Modal */}
      {selectedResult && (
        <ResultModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </div>
  );
};

export default AiSearch;