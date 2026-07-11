import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import { toast } from "react-toastify";
import AppContent from "../context/AppContent";
import { analyticsApi } from "../services";
import { Bar, Line, Pie } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";
import { Loader2, Brain, BarChart4, PieChart } from "lucide-react";

Chart.register(...registerables);

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [aiInsights, setAiInsights] = useState("");

  useEffect(() => {
    // 🧠 Generate Gemini-based insights
    const fetchAIInsights = async (summary) => {
      try {
        const prompt = `Based on these platform stats, provide 2 actionable insights for productivity: ${JSON.stringify(summary)}`;
        const aiRes = await analyticsApi.askAnalyticsChat({ message: prompt });
        if (aiRes.data.success) {
          setAiInsights(aiRes.data.reply);
        } else {
          setAiInsights("AI insights unavailable — please try again later.");
        }
      } catch (err) {
        console.error("AI Insights error:", err);
        setAiInsights("AI insights unavailable — please try again later.");
      }
    };

    const fetchAnalytics = async () => {
      try {
        const res = await analyticsApi.getAnalytics();

        if (res.data.success) {
          setData(res.data);
          await fetchAIInsights(res.data.summary);
        } else {
          toast.error("Failed to load analytics");
        }
      } catch (error) {
        console.error("Error loading analytics:", error);
        toast.error("Error loading analytics");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex justify-center items-center">
        <Loader2 className="animate-spin w-8 h-8 text-gray-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading analytics...</span>
      </div>
    );

  if (!data)
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex justify-center items-center text-gray-600 dark:text-gray-400">
        No data available.
      </div>
    );

  const { summary, trends } = data;

  // Chart Data
  const meetingTrendData = {
    labels: trends.monthlyMeetings.map((t) => `Month ${t._id}`),
    datasets: [
      {
        label: "Meetings",
        data: trends.monthlyMeetings.map((t) => t.count),
        borderColor: "#4F46E5",
        backgroundColor: "rgba(99, 102, 241, 0.5)",
      },
    ],
  };

  const policyTrendData = {
    labels: trends.monthlyPolicies.map((t) => `Month ${t._id}`),
    datasets: [
      {
        label: "Policies",
        data: trends.monthlyPolicies.map((t) => t.count),
        backgroundColor: "rgba(16, 185, 129, 0.7)",
      },
    ],
  };

  const pieData = {
    labels: ["Completed Meetings", "Pending Meetings"],
    datasets: [
      {
        data: [
          summary.completedMeetings,
          summary.totalMeetings - summary.completedMeetings,
        ],
        backgroundColor: ["#6366F1", "rgba(148, 163, 184, 0.3)"],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200">
      <Navbar />
      <div className="max-w-6xl mx-auto text-center pt-24 pb-20 px-6">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 flex justify-center items-center gap-2">
          <BarChart4 className="text-indigo-600 w-8 h-8" /> Reports & Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-10">
          Visualize trends — meetings held, policies updated, and AI-powered
          insights.
        </p>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <StatCard
            title="Total Meetings"
            value={summary.totalMeetings}
            color="indigo"
          />
          <StatCard
            title="Completed Meetings"
            value={summary.completedMeetings}
            color="green"
          />
          <StatCard
            title="Total Policies"
            value={summary.totalPolicies}
            color="blue"
          />
          <StatCard
            title="Updated Policies"
            value={summary.updatedPolicies}
            color="purple"
          />
        </div>

        {/* Charts Section */}
        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-md border dark:border-gray-800">
            <h2 className="text-lg font-semibold dark:text-white mb-3">
              📈 Meetings Activity (6 Months)
            </h2>
            <Line data={meetingTrendData} />
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-md border dark:border-gray-800">
            <h2 className="text-lg font-semibold dark:text-white mb-3">
              📊 Policies Activity (6 Months)
            </h2>
            <Bar data={policyTrendData} />
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-md border dark:border-gray-800 max-w-2xl mx-auto mb-10">
          <h2 className="text-lg font-semibold dark:text-white mb-3 flex items-center justify-center gap-2">
            <PieChart className="text-indigo-600 w-5 h-5" /> Meetings Status
          </h2>
          <Pie data={pieData} />
        </div>

        {/* AI Insights Section */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-md border dark:border-gray-800 text-left">
          <h2 className="text-xl font-semibold dark:text-white mb-3 flex items-center gap-2">
            <Brain className="text-purple-600 w-6 h-6" /> AI Insights
          </h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {aiInsights}
          </p>
        </div>
      </div>
    </div>
  );
};

// 🔹 Stats Card Component
const StatCard = ({ title, value, color }) => {
  const colorMap = {
    indigo: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border dark:border-indigo-900/50",
    green: "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border dark:border-green-900/50",
    blue: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border dark:border-blue-900/50",
    purple: "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border dark:border-purple-900/50",
  };
  return (
    <div
      className={`p-5 rounded-xl shadow-sm ${colorMap[color]} font-semibold`}
    >
      <h3 className="text-sm">{title}</h3>
      <p className="text-2xl mt-2">{value}</p>
    </div>
  );
};

export default Reports;
