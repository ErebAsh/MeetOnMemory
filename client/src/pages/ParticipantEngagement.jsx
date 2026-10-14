import React, { useState, useEffect, useCallback } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import Navbar from "../components/Navbar.jsx";
import api from "../services/apiClient";

const ParticipantEngagement = () => {
  const [scorecard, setScorecard] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState(null);

  const fetchScorecard = useCallback(async (userId) => {
    if (!userId) return;
    try {
      setError(null);
      const scorecardRes = await api.get(
        `/api/engagement/participant/${userId}`,
      );
      if (scorecardRes.data.success) {
        setScorecard(scorecardRes.data.data);
      } else {
        setError(scorecardRes.data.message || "Failed to load scorecard");
      }
    } catch (err) {
      console.error("Error fetching scorecard", err);
      setError("Failed to load scorecard. Please try again.");
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rankingsRes = await api.get(
        "/api/engagement/organization/rankings",
      );
      if (
        rankingsRes.data.success &&
        rankingsRes.data.data.rankings &&
        rankingsRes.data.data.rankings.length > 0
      ) {
        setRankings(rankingsRes.data.data.rankings);
        const firstUserId = rankingsRes.data.data.rankings[0].userId?._id;

        if (firstUserId) {
          await fetchScorecard(firstUserId);
        }
      } else if (rankingsRes.data.success) {
        setRankings([]);
      } else {
        setError(rankingsRes.data.message || "Failed to load engagement data");
      }
    } catch (err) {
      console.error("Error fetching engagement data", err);
      setError("Failed to load engagement data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fetchScorecard]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRecalculateScorecard = async () => {
    const targetUserId = scorecard?.userId?._id;
    if (!targetUserId) return;
    try {
      setRecalculating(true);
      const res = await api.post(
        `/api/engagement/participant/${targetUserId}/recalculate`,
      );
      if (res.data.success) {
        setScorecard(res.data.data);
      }
    } catch (err) {
      console.error("Error recalculating scorecard:", err);
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
        <Navbar />
        <div className="pt-28 p-8 text-center text-gray-500">
          Loading Engagement Dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
        <Navbar />
        <div className="pt-28 pb-16 px-4 max-w-md mx-auto text-center">
          <div
            data-testid="engagement-error-state"
            className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 border border-red-200 dark:border-red-800"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Failed to Load Dashboard
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {error}
            </p>
            <button
              data-testid="retry-button"
              onClick={fetchDashboardData}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const radarData = scorecard?.dimensionalScores
    ? [
        {
          subject: "Speaking",
          A: scorecard.dimensionalScores.speaking || 0,
          fullMark: 100,
        },
        {
          subject: "Action Items",
          A: scorecard.dimensionalScores.actionItems || 0,
          fullMark: 100,
        },
        {
          subject: "Decisions",
          A: scorecard.dimensionalScores.decisions || 0,
          fullMark: 100,
        },
        {
          subject: "Attendance",
          A: scorecard.dimensionalScores.attendance || 0,
          fullMark: 100,
        },
        {
          subject: "AI Quality",
          A: scorecard.dimensionalScores.aiQuality || 0,
          fullMark: 100,
        },
      ]
    : [];

  const trendData = scorecard?.historicalTrends
    ? scorecard.historicalTrends.map((t) => ({
        name: new Date(t.date).toLocaleDateString(),
        score: t.score,
      }))
    : [];

  const metrics = scorecard?.metrics || {};

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar />
      <div className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Participant Engagement
          </h1>
          {scorecard && (
            <button
              onClick={handleRecalculateScorecard}
              disabled={recalculating}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              {recalculating ? "Recalculating..." : "Recalculate Real Metrics"}
            </button>
          )}
        </div>

        {scorecard && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile & Overall Score */}
            <div
              role="region"
              aria-label="Participant Overview"
              className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex flex-col items-center justify-center"
            >
              {scorecard.userId?.profilePic ? (
                <img
                  src={scorecard.userId.profilePic}
                  alt="Profile"
                  className="w-24 h-24 rounded-full mb-4"
                />
              ) : (
                <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl text-indigo-600">
                    {scorecard.userId?.name?.charAt(0) || "U"}
                  </span>
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                {scorecard.userId?.name}
              </h2>
              <p className="text-gray-500">{scorecard.userId?.email}</p>
              <div className="mt-4 text-center">
                <span className="text-5xl font-black text-indigo-600">
                  {scorecard.overallScore}
                </span>
                <p className="text-sm text-gray-500 uppercase tracking-wide mt-1">
                  Overall Score
                </p>
              </div>

              {/* Real Aggregated Metrics Sub-panel */}
              <div className="w-full mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-2 text-center text-xs">
                <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                  <span className="font-bold text-gray-800 dark:text-gray-100 block">
                    {metrics.meetingsAttended || 0}
                  </span>
                  <span className="text-gray-500">Meetings</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                  <span className="font-bold text-gray-800 dark:text-gray-100 block">
                    {metrics.totalSpeakingTimeMinutes || 0} min
                  </span>
                  <span className="text-gray-500">Spoken</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                  <span className="font-bold text-gray-800 dark:text-gray-100 block">
                    {metrics.actionItemsCompleted || 0} /{" "}
                    {metrics.actionItemsAssigned || 0}
                  </span>
                  <span className="text-gray-500">Action Items</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                  <span className="font-bold text-gray-800 dark:text-gray-100 block">
                    {metrics.decisionsInvolved || 0}
                  </span>
                  <span className="text-gray-500">Decisions</span>
                </div>
              </div>
            </div>

            {/* Radar Chart */}
            <div
              role="region"
              aria-label="Dimensional Breakdown Chart"
              className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex flex-col"
            >
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Dimensional Breakdown
              </h3>
              <div className="flex-grow w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="80%"
                    data={radarData}
                  >
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar
                      name="Score"
                      dataKey="A"
                      stroke="#4f46e5"
                      fill="#4f46e5"
                      fillOpacity={0.6}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI Insights */}
            <div
              role="region"
              aria-label="AI Insights"
              className="bg-white dark:bg-gray-800 rounded-xl shadow p-6"
            >
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                AI Insights
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-green-600 uppercase">
                    Strengths
                  </h4>
                  <ul className="mt-2 list-disc list-inside text-gray-700 dark:text-gray-300">
                    {scorecard.aiInsights?.strengths?.map((s, i) => (
                      <li key={i}>{s}</li>
                    )) || <li>No insights available</li>}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-600 uppercase">
                    Growth Areas
                  </h4>
                  <ul className="mt-2 list-disc list-inside text-gray-700 dark:text-gray-300">
                    {scorecard.aiInsights?.growthAreas?.map((g, i) => (
                      <li key={i}>{g}</li>
                    )) || <li>No insights available</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trend Line Chart */}
        {scorecard && trendData.length > 0 && (
          <div
            role="region"
            aria-label="Engagement Trend Chart"
            className="bg-white dark:bg-gray-800 rounded-xl shadow p-6"
          >
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
              Engagement Trend
            </h3>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#4f46e5"
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Rankings Table */}
        <div
          role="region"
          aria-label="Organization Rankings Table"
          className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden"
        >
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Organization Rankings
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
                <tr>
                  <th scope="col" className="px-6 py-4 font-medium text-sm">
                    Participant
                  </th>
                  <th scope="col" className="px-6 py-4 font-medium text-sm">
                    Overall Score
                  </th>
                  <th scope="col" className="px-6 py-4 font-medium text-sm">
                    Speaking
                  </th>
                  <th scope="col" className="px-6 py-4 font-medium text-sm">
                    Action Items
                  </th>
                  <th scope="col" className="px-6 py-4 font-medium text-sm">
                    Decisions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rankings.map((row) => {
                  const isActive = row.userId?._id === scorecard?.userId?._id;
                  return (
                    <tr
                      key={row._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => fetchScorecard(row.userId?._id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          fetchScorecard(row.userId?._id);
                        }
                      }}
                      aria-label={`View scorecard for ${row.userId?.name}`}
                      aria-current={isActive ? "true" : "false"}
                      className={`cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset ${
                        isActive
                          ? "bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-100/40 dark:hover:bg-indigo-900/30"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {row.userId?.profilePic ? (
                            <img
                              src={row.userId.profilePic}
                              alt=""
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                              {row.userId?.name?.charAt(0) || "?"}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {row.userId?.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {row.userId?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-bold">
                        {row.overallScore}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {row.dimensionalScores?.speaking || 0}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {row.dimensionalScores?.actionItems || 0}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {row.dimensionalScores?.decisions || 0}
                      </td>
                    </tr>
                  );
                })}
                {rankings.length === 0 && (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No rankings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantEngagement;
