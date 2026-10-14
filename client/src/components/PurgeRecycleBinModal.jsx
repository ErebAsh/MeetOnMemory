import React, { useEffect, useState, useCallback } from "react";
import { AlertTriangle, X, Loader2, Info } from "lucide-react";
import { meetingApi } from "../services/meetingApi.js";
import { toast } from "react-toastify";

const PurgeRecycleBinModal = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirmInput, setConfirmInput] = useState("");

  const fetchPreview = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await meetingApi.getPurgePreview();
      if (data.success) {
        setPreview(data.data);
      }
    } catch (error) {
      console.error("Error fetching purge preview:", error);
      toast.error("Failed to fetch purge preview data.");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      fetchPreview();
      setConfirmInput("");
    }
  }, [isOpen, fetchPreview]);

  const handlePurge = async () => {
    if (confirmInput !== "PURGE") return;
    try {
      setPurging(true);
      const { data } = await meetingApi.purgeTrash();
      if (data.success) {
        toast.success(
          `Successfully purged ${data.data?.deletedCount || 0} meetings from recycle bin.`,
        );
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (error) {
      console.error("Error purging recycle bin:", error);
      toast.error(
        error.response?.data?.message || "Failed to purge recycle bin.",
      );
    } finally {
      setPurging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-6 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 mb-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Purge Recycle Bin Preview
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Review data retention sweep impact and bulk purge preview
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={purging}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Loader2 className="animate-spin w-8 h-8 text-blue-600 mb-2" />
              <span className="text-sm font-medium">
                Loading retention policy preview...
              </span>
            </div>
          ) : (
            <>
              {/* Org Policy Header */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/80 rounded-xl text-blue-800 dark:text-blue-300 text-xs flex gap-2">
                <Info size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">
                    Active Org Data Retention Policy
                  </span>
                  <span>
                    Status: {preview?.policy?.enabled ? "Enabled" : "Disabled"}{" "}
                    | Retention Period: {preview?.policy?.retentionPeriodDays}{" "}
                    days | Grace Period: {preview?.policy?.gracePeriodDays} days
                  </span>
                </div>
              </div>

              {/* Data Retention Sweep Preview Section */}
              <div className="space-y-2">
                <span className="font-semibold text-xs text-gray-500 uppercase tracking-wider block">
                  Upcoming Sweep Deletions (Grace Period Expiry)
                </span>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-baseline mb-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Total Expired Meetings to Hard Delete:
                    </span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-400">
                      {preview?.sweep?.totalCount || 0}
                    </span>
                  </div>

                  {/* Types breakdown */}
                  {preview?.sweep?.totalCount > 0 && (
                    <div className="mb-4">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                        Breakdown by type:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(preview?.sweep?.countsByType || {}).map(
                          ([type, count]) => (
                            <span
                              key={type}
                              className="px-2 py-0.5 rounded-lg text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium capitalize"
                            >
                              {type}: {count}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sample list */}
                  {preview?.sweep?.samples?.length > 0 ? (
                    <div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                        Oldest expired meetings sample:
                      </span>
                      <ul className="space-y-1.5">
                        {preview.sweep.samples.map((sample, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-gray-700 dark:text-gray-300 truncate list-disc list-inside"
                          >
                            <span className="font-semibold capitalize">
                              [{sample.meetingType}]
                            </span>{" "}
                            {sample.title} (Created:{" "}
                            {new Date(sample.createdAt).toLocaleDateString()})
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium block">
                      No meetings are currently past the expiration threshold.
                    </span>
                  )}
                </div>
              </div>

              {/* Recycle Bin manual purge Section */}
              <div className="space-y-2">
                <span className="font-semibold text-xs text-gray-500 uppercase tracking-wider block">
                  Manual Purge Preview (All Trash Items)
                </span>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-baseline mb-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Total Trash Meetings to Permanently Purge:
                    </span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-400">
                      {preview?.trash?.totalCount || 0}
                    </span>
                  </div>

                  {/* Types breakdown */}
                  {preview?.trash?.totalCount > 0 && (
                    <div className="mb-4">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                        Breakdown by type:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(preview?.trash?.countsByType || {}).map(
                          ([type, count]) => (
                            <span
                              key={type}
                              className="px-2 py-0.5 rounded-lg text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium capitalize"
                            >
                              {type}: {count}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sample list */}
                  {preview?.trash?.samples?.length > 0 ? (
                    <div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                        Trash meetings sample:
                      </span>
                      <ul className="space-y-1.5">
                        {preview.trash.samples.map((sample, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-gray-700 dark:text-gray-300 truncate list-disc list-inside"
                          >
                            <span className="font-semibold capitalize">
                              [{sample.meetingType}]
                            </span>{" "}
                            {sample.title} (Deleted:{" "}
                            {new Date(sample.deletedAt).toLocaleDateString()})
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500 block font-medium">
                      Recycle bin is currently empty.
                    </span>
                  )}
                </div>
              </div>

              {/* Typed confirm verification field */}
              <div className="pt-2 border-t dark:border-gray-800 space-y-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block">
                  To confirm permanent purge, type{" "}
                  <code className="text-red-600 dark:text-red-400 font-mono font-bold bg-red-50 dark:bg-red-950/30 px-1 py-0.5 rounded">
                    PURGE
                  </code>{" "}
                  below:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder='Type "PURGE" to verify bulk delete'
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium text-sm transition-all"
                  disabled={purging || preview?.trash?.totalCount === 0}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t pt-4 mt-4 dark:border-gray-800 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={purging}
            className="px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePurge}
            disabled={
              purging ||
              confirmInput !== "PURGE" ||
              preview?.trash?.totalCount === 0
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-500 rounded-xl transition-colors disabled:cursor-not-allowed cursor-pointer shadow-md shadow-red-500/10"
          >
            {purging && <Loader2 size={16} className="animate-spin" />}
            <span>Purge Recycle Bin</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurgeRecycleBinModal;
