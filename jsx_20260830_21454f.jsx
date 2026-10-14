import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  Users,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  AlertTriangle,
  BarChart3,
  Download,
  RefreshCw,
  Loader2,
  TrendingUp,
  PieChart,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const API_PREFIX = "/api";

const api = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("clerk_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

const MeetingAnalytics = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [id]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/analytics/meetings/${id}`);
      if (response.data.success) {
        setAnalytics(response.data.data);
      } else {
        setError(response.data.error || "Failed to load analytics");
      }
    } catch (err) {
      console.error("Analytics fetch error:", err);
      if (err.response?.status === 403) {
        setError(
          "You do not have permission to view analytics for this meeting",
        );
      } else if (err.response?.status === 404) {
        setError("Meeting not found");
      } else {
        setError(
          err.response?.data?.error ||
            "Failed to load analytics. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format = "csv") => {
    setExporting(true);
    try {
      const response = await api.get(`/analytics/meetings/${id}/export`, {
        params: { format },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `meeting_analytics_${id}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export analytics");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertTriangle className="w-8 h-8" />
            <h2 className="text-xl font-semibold">Error</h2>
          </div>
          <p className="text-gray-700">{error}</p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={fetchAnalytics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center text-gray-600">
          <p>No analytics data available</p>
        </div>
      </div>
    );
  }

  const {
    meeting,
    attendance,
    transcript,
    actionItems,
    engagement,
    icebreakers,
    summary,
  } = analytics;

  // Prepare chart data
  const attendanceData = [
    { name: "Present", value: attendance.present || 0 },
    { name: "Absent", value: attendance.absent || 0 },
    { name: "Excused", value: attendance.excused || 0 },
  ];

  const actionItemsData = [
    { name: "Completed", value: actionItems.completed || 0 },
    { name: "In Progress", value: actionItems.inProgress || 0 },
    { name: "Pending", value: actionItems.pending || 0 },
  ];

  const COLORS = ["#22c55e", "#eab308", "#ef4444"];
  const ENGAGEMENT_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b"];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <button
              onClick={() => navigate(`/meetings/${id}`)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Meeting
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              {meeting.title}
            </h1>
            <p className="text-sm text-gray-500">
              {new Date(meeting.startTime).toLocaleDateString()} •
              {meeting.duration
                ? ` ${meeting.duration} min`
                : " No duration data"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchAnalytics()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Users className="w-4 h-4" />
              <span>Participants</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {summary.totalParticipants}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {attendance.completionRate}% attendance rate
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Completion Rate</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {summary.completionRate}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {attendance.present || 0} present
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <FileText className="w-4 h-4 text-blue-500" />
              <span>Action Items</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {actionItems.total || 0}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {actionItems.completionRate}% completed
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span>Engagement Score</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {summary.engagementScore}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {engagement.totalIcebreakers || 0} icebreakers
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Attendance Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Attendance Breakdown
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={attendanceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {attendanceData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Action Items Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Action Items Status
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={actionItemsData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {actionItemsData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h4 className="font-medium text-gray-700 mb-3">Transcript</h4>
            {transcript.hasTranscript ? (
              <div>
                <p className="text-sm text-gray-600">
                  Word count:{" "}
                  <span className="font-semibold">{transcript.wordCount}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Length:{" "}
                  <span className="font-semibold">
                    {transcript.length} characters
                  </span>
                </p>
                {transcript.isEncrypted && (
                  <p className="text-sm text-yellow-600 flex items-center gap-1 mt-2">
                    <AlertTriangle className="w-3 h-3" />
                    Encrypted
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No transcript available</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h4 className="font-medium text-gray-700 mb-3">
              Action Items by Priority
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-red-600">High</span>
                <span className="font-semibold">
                  {actionItems.byPriority?.high || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-yellow-600">Medium</span>
                <span className="font-semibold">
                  {actionItems.byPriority?.medium || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Low</span>
                <span className="font-semibold">
                  {actionItems.byPriority?.low || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h4 className="font-medium text-gray-700 mb-3">Engagement</h4>
            <div>
              <p className="text-sm text-gray-600">
                Total Icebreakers:{" "}
                <span className="font-semibold">
                  {engagement.totalIcebreakers || 0}
                </span>
              </p>
              <p className="text-sm text-gray-600">
                Total Responses:{" "}
                <span className="font-semibold">
                  {engagement.totalResponses || 0}
                </span>
              </p>
              <p className="text-sm text-gray-600">
                Average Responses:{" "}
                <span className="font-semibold">
                  {engagement.averageResponses || 0}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Recent Icebreakers */}
        {icebreakers?.recent?.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Recent Icebreakers
            </h3>
            <div className="space-y-3">
              {icebreakers.recent.map((ib, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {ib.question}
                    </p>
                    <p className="text-xs text-gray-400">
                      {ib.type} • {new Date(ib.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-sm text-gray-600">
                    {ib.responseCount} responses
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overall Score */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-sm p-6 border border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">
                Overall Meeting Score
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Based on attendance, action items, and engagement metrics
              </p>
            </div>
            <div className="text-4xl font-bold text-blue-600">
              {summary.overallScore}%
            </div>
          </div>
          <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 rounded-full h-2 transition-all duration-500"
              style={{ width: `${summary.overallScore}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingAnalytics;
