import React, { useState, useEffect, useContext } from "react";
import decisionVoteApi from "../../services/decisionVoteApi";
import AppContent from "../../context/AppContent";
import { toast } from "react-toastify";
import {
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  TrendingUp,
  Award,
  Users,
  CheckCircle,
  AlertOctagon,
  Scale,
  Percent,
} from "lucide-react";

const DecisionVotingPanel = ({ meetingId }) => {
  const { userData } = useContext(AppContent) || {};
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votingMap, setVotingMap] = useState({}); // Tracks user's own cast votes

  useEffect(() => {
    if (meetingId) {
      loadDecisions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const loadDecisions = async () => {
    try {
      setLoading(true);
      const res = await decisionVoteApi.getMeetingDecisionsConsensus(meetingId);
      if (res.success) {
        setDecisions(res.data || []);
        // Map user's current votes
        const initialVotes = {};
        res.data.forEach((item) => {
          const userVote = item.consensus?.votes?.find(
            (v) => String(v.userId) === String(userData?._id || userData?.id),
          );
          if (userVote) {
            initialVotes[item.decision._id] = userVote.vote;
          }
        });
        setVotingMap(initialVotes);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load decisions consensus");
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (decisionId, voteType) => {
    try {
      // Optimistic UI update
      setVotingMap((prev) => ({
        ...prev,
        [decisionId]: voteType,
      }));

      const res = await decisionVoteApi.castVote(decisionId, voteType);
      if (res.success) {
        toast.success("Vote recorded successfully");
        // Reload details to get exact recalculated weights
        loadDecisions();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to cast vote");
      loadDecisions(); // Rollback
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center py-10">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
        <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
          Loading decision consensus...
        </span>
      </div>
    );
  }

  if (decisions.length === 0) {
    return null; // Don't show if there are no decisions generated for this meeting
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case "passed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5" />
            Consensus Passed
          </span>
        );
      case "vetoed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
            <AlertOctagon className="w-3.5 h-3.5 animate-pulse" />
            Vetoed by Admin
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
            <AlertOctagon className="w-3.5 h-3.5" />
            Consensus Failed
          </span>
        );
      case "open":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
            <Scale className="w-3.5 h-3.5" />
            Voting Open
          </span>
        );
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <Scale className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        Collaborative Decision Consensus
      </h2>

      <div className="space-y-6">
        {decisions.map((item) => {
          const dec = item.decision;
          const cons = item.consensus || {};
          const stats = cons.stats || { approve: 0, reject: 0, abstain: 0 };
          const userVote = votingMap[dec._id];

          const totalWeighted = stats.approve + stats.reject + stats.abstain;
          const approvePercent =
            totalWeighted > 0 ? (stats.approve / totalWeighted) * 100 : 0;
          const rejectPercent =
            totalWeighted > 0 ? (stats.reject / totalWeighted) * 100 : 0;
          const abstainPercent =
            totalWeighted > 0 ? (stats.abstain / totalWeighted) * 100 : 0;

          return (
            <div
              key={dec._id}
              className="p-5 rounded-xl border border-gray-100 dark:border-gray-750 bg-gray-50/50 dark:bg-gray-900/20 flex flex-col md:flex-row gap-6 items-start justify-between"
              data-testid={`decision-card-${dec._id}`}
            >
              <div className="flex-1 space-y-4 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  {getStatusBadge(cons.status)}
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-250 dark:border-gray-700">
                    <Percent className="w-3.5 h-3.5" />
                    Consensus: {Math.round(cons.consensusRate || 0)}% (Req:{" "}
                    {cons.threshold}%)
                  </span>
                </div>

                <p className="text-sm font-semibold text-gray-850 dark:text-gray-100 leading-relaxed">
                  {dec.text}
                </p>

                {/* Consent breakdown bar chart */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                    <span>Vote Breakdown (Weighted Score)</span>
                    <span>Total Weighted: {totalWeighted}</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden flex bg-gray-200 dark:bg-gray-700">
                    {stats.approve > 0 && (
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${approvePercent}%` }}
                        title={`Approve: ${stats.approve}`}
                      ></div>
                    )}
                    {stats.reject > 0 && (
                      <div
                        className="bg-rose-500 h-full transition-all"
                        style={{ width: `${rejectPercent}%` }}
                        title={`Reject: ${stats.reject}`}
                      ></div>
                    )}
                    {stats.abstain > 0 && (
                      <div
                        className="bg-amber-400 h-full transition-all"
                        style={{ width: `${abstainPercent}%` }}
                        title={`Abstain: ${stats.abstain}`}
                      ></div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      Approve: {stats.approve}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      Reject: {stats.reject}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-450"></span>
                      Abstain: {stats.abstain}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vote Actions console */}
              <div className="flex flex-col gap-2.5 w-full md:w-auto self-stretch justify-center">
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                  Cast Your Vote
                </p>
                <div className="flex md:flex-col gap-2 w-full">
                  <button
                    onClick={() => handleVote(dec._id, "approve")}
                    className={`flex-1 md:w-40 px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                      userVote === "approve"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md scale-105"
                        : "bg-transparent text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    data-testid={`vote-approve-${dec._id}`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleVote(dec._id, "reject")}
                    className={`flex-1 md:w-40 px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                      userVote === "reject"
                        ? "bg-rose-600 text-white border-rose-600 shadow-md scale-105"
                        : "bg-transparent text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    data-testid={`vote-reject-${dec._id}`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleVote(dec._id, "abstain")}
                    className={`flex-1 md:w-40 px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                      userVote === "abstain"
                        ? "bg-amber-500 text-white border-amber-500 shadow-md scale-105"
                        : "bg-transparent text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    data-testid={`vote-abstain-${dec._id}`}
                  >
                    <HelpCircle className="w-4 h-4" />
                    Abstain
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DecisionVotingPanel;
