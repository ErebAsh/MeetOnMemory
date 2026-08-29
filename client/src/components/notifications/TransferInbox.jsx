import React, { useState, useEffect } from "react";
import { ArrowRightLeft, Check, X, Clock } from "lucide-react";
import { toast } from "react-toastify";
import { meetingOwnershipTransferApi } from "../../services";
import { Link } from "react-router-dom";

const TransferInbox = () => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // id of transfer being acted on

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const response = await meetingOwnershipTransferApi.getInbox();
      if (response.data?.success) {
        setTransfers(response.data.transfers || []);
      }
    } catch (error) {
      console.error("Failed to fetch transfers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (transferId, action) => {
    setActionLoading(transferId);
    try {
      let response;
      if (action === "accept") {
        response = await meetingOwnershipTransferApi.acceptTransfer(transferId);
      } else {
        response = await meetingOwnershipTransferApi.rejectTransfer(transferId);
      }

      if (response.data?.success) {
        toast.success(`Transfer request ${action}ed`);
        // Remove from list
        setTransfers((prev) => prev.filter((t) => t._id !== transferId));
      } else {
        toast.error(response.data?.message || `Failed to ${action} transfer`);
      }
    } catch (error) {
      console.error(`Transfer ${action} error:`, error);
      toast.error(
        error.response?.data?.message ||
          `An error occurred while ${action}ing the transfer`,
      );
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading && transfers.length === 0) {
    return (
      <div className="flex justify-center p-4">
        <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (transfers.length === 0) {
    return null; // Don't render anything if there are no pending transfers
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-blue-200 dark:border-blue-800/50 shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-3 bg-blue-50/50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/50 flex items-center gap-2">
        <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Meeting Ownership Transfers
        </h3>
        <span className="ml-auto bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {transfers.length}
        </span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[300px] overflow-y-auto">
        {transfers.map((transfer) => (
          <div
            key={transfer._id}
            className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="shrink-0 mt-1">
                {transfer.fromUser?.avatarUrl ? (
                  <img
                    src={transfer.fromUser.avatarUrl}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-medium border border-slate-200 dark:border-slate-600">
                    {(transfer.fromUser?.name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {transfer.fromUser?.name}
                  </span>{" "}
                  wants to transfer ownership of{" "}
                  <Link
                    to={`/meeting/${transfer.meeting?._id}`}
                    className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {transfer.meeting?.title || "a meeting"}
                  </Link>{" "}
                  to you.
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Expires {formatDate(transfer.expiresAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center w-full sm:w-auto">
              <button
                onClick={() => handleAction(transfer._id, "reject")}
                disabled={actionLoading === transfer._id}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                Decline
              </button>
              <button
                onClick={() => handleAction(transfer._id, "accept")}
                disabled={actionLoading === transfer._id}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                {actionLoading === transfer._id ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Accept
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransferInbox;
