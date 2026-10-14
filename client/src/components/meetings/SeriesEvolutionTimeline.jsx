import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient as api } from "../../services"; // assuming standard api utility
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArrowDown, Loader, Calendar, FileText } from "lucide-react";
import MeetingDiffView from "./MeetingDiffView";

const SeriesEvolutionTimeline = ({ seriesId }) => {
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDiffIndex, setSelectedDiffIndex] = useState(null); // to show diff view for a specific pair
  const [pairwiseDiff, setPairwiseDiff] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchTimeline = async () => {
      try {
        const response = await api.get(
          `/api/series-diff/${seriesId}/timeline`,
          {
            signal: abortController.signal,
          },
        );
        setTimelineData(response.data);
      } catch (err) {
        if (err.name === "CanceledError" || err.name === "AbortError") return;
        console.error("Failed to fetch timeline:", err);
        setError("Failed to load series timeline.");
      } finally {
        setLoading(false);
      }
    };
    if (seriesId) fetchTimeline();

    return () => {
      abortController.abort();
    };
  }, [seriesId]);

  const [abortControllerRef, setAbortControllerRef] = useState(null);

  const handleDiffClick = async (index, prevMeetingId, currMeetingId) => {
    if (selectedDiffIndex === index) {
      setSelectedDiffIndex(null);
      setPairwiseDiff(null);
      if (abortControllerRef) abortControllerRef.abort();
      return;
    }

    if (abortControllerRef) abortControllerRef.abort();
    const newController = new AbortController();
    setAbortControllerRef(newController);

    setLoadingDiff(true);
    setSelectedDiffIndex(index);
    try {
      const response = await api.get(
        `/api/series-diff/compare?m1Id=${prevMeetingId}&m2Id=${currMeetingId}`,
        { signal: newController.signal },
      );
      setPairwiseDiff(response.data);
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      console.error("Failed to load pairwise diff:", err);
    } finally {
      setLoadingDiff(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center p-12">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  if (error)
    return (
      <div className="p-6 text-center text-red-500 bg-red-50 rounded">
        {error}
      </div>
    );
  if (!timelineData || timelineData.timeline.length === 0)
    return (
      <div className="p-6 text-center text-gray-500">
        No meetings found in this series.
      </div>
    );

  const { timeline, trendMetrics } = timelineData;
  const chartData = timeline.map((m) => ({
    name: `Occ #${m.occurrence}`,
    added: m.diffSummary?.added || 0,
    removed: m.diffSummary?.removed || 0,
    completedActionItems: m.diffSummary?.completedActionItems || 0,
  }));

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-6">
          Series Evolution Trends
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-800 font-semibold mb-1">
              Action Item Completion Rate
            </p>
            <p className="text-3xl font-bold text-blue-600">
              {Number.isFinite(trendMetrics?.actionItemCompletionRate)
                ? (trendMetrics.actionItemCompletionRate * 100).toFixed(1)
                : "0.0"}
              %
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
            <p className="text-sm text-purple-800 font-semibold mb-1">
              Avg Decisions per Meeting
            </p>
            <p className="text-3xl font-bold text-purple-600">
              {Number.isFinite(trendMetrics?.decisionVelocity)
                ? trendMetrics.decisionVelocity.toFixed(1)
                : "0.0"}
            </p>
          </div>
        </div>

        {timeline.length > 1 && (
          <div className="h-48 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="added"
                  stroke="#10b981"
                  name="New Items (Decisions/Topics/AI)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="completedActionItems"
                  stroke="#3b82f6"
                  name="Completed Action Items"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="relative border-l-2 border-gray-200 ml-6 pl-8 space-y-12">
        {timeline.map((meeting, index) => {
          const isFirst = index === 0;
          return (
            <div key={meeting.meetingId} className="relative">
              {/* Diff Chip between meetings */}
              {!isFirst && meeting.diffSummary && (
                <div className="absolute -top-8 left-0 right-0 flex justify-center z-10 -ml-8">
                  <button
                    onClick={() =>
                      handleDiffClick(
                        index,
                        timeline[index - 1].meetingId,
                        meeting.meetingId,
                      )
                    }
                    className="bg-white px-4 py-1.5 rounded-full border border-gray-300 shadow-sm text-xs font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center space-x-2"
                  >
                    <ArrowDown className="w-3 h-3 text-gray-400" />
                    <span>+{meeting.diffSummary.added} Added</span>
                    <span>-{meeting.diffSummary.removed} Removed</span>
                    <span>{meeting.diffSummary.carriedOver} Carried Over</span>
                    <span className="text-blue-600">
                      {meeting.diffSummary.completedActionItems} Completed
                    </span>
                  </button>
                </div>
              )}

              {/* Diff View Expand */}
              {selectedDiffIndex === index && (
                <div className="absolute top-0 w-[800px] bg-white shadow-xl border border-gray-200 rounded-xl z-20 left-12 p-4 animate-in slide-in-from-top-4">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b">
                    <h3 className="font-semibold">Detailed Comparison</h3>
                    <button
                      onClick={() => setSelectedDiffIndex(null)}
                      className="text-gray-400 hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>
                  {loadingDiff ? (
                    <div className="flex justify-center p-8">
                      <Loader className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="max-h-[600px] overflow-y-auto">
                      <MeetingDiffView diffData={pairwiseDiff} />
                    </div>
                  )}
                </div>
              )}

              {/* Node Marker */}
              <div className="absolute -left-[41px] top-1.5 w-5 h-5 bg-blue-500 rounded-full border-4 border-white shadow-sm"></div>

              {/* Meeting Card */}
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      {meeting.title}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500 mt-1 space-x-4">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />{" "}
                        {new Date(meeting.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center">
                        <FileText className="w-4 h-4 mr-1" /> Occurrence #
                        {meeting.occurrence}
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/meeting/${meeting.meetingId}`}
                    data-testid={`view-meeting-${meeting.meetingId}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View Meeting
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SeriesEvolutionTimeline;
