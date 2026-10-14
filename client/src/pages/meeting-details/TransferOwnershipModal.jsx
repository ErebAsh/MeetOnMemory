import React, { useState, useEffect, useContext, useCallback } from "react";
import { toast } from "react-toastify";
import { X, Search, ShieldAlert } from "lucide-react";
import { transferApi } from "../../services";
import { organizationApi } from "../../services/organizationApi";
import AppContent from "../../context/AppContent";

const TransferOwnershipModal = ({
  isOpen,
  onClose,
  meetingId,
  meetingTitle,
}) => {
  const { userData } = useContext(AppContent) || {};
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const fetchMembers = useCallback(async () => {
    try {
      setLoadingMembers(true);
      const { data } = await organizationApi.getOrganizationMembers(
        userData?.currentOrganization,
      );
      if (data.success) {
        // Exclude current user from the list
        const filteredMembers = data.members.filter(
          (m) => m.user?._id !== userData?._id,
        );
        setMembers(filteredMembers);
      }
    } catch (error) {
      console.error("Error fetching organization members:", error);
      toast.error("Failed to load organization members");
    } finally {
      setLoadingMembers(false);
    }
  }, [userData?.currentOrganization, userData?._id]);

  useEffect(() => {
    if (isOpen && userData?.currentOrganization) {
      fetchMembers();
    }
  }, [isOpen, userData?.currentOrganization, fetchMembers]);

  const handleTransfer = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user to transfer ownership to.");
      return;
    }
    if (confirmText !== "TRANSFER") {
      toast.error('Please type "TRANSFER" to confirm.');
      return;
    }

    try {
      setIsSubmitting(true);
      const { data } = await transferApi.initiateTransfer(
        meetingId,
        selectedUserId,
      );
      if (data.success) {
        toast.success("Transfer request sent successfully.");
        onClose();
      }
    } catch (error) {
      console.error("Error initiating transfer:", error);
      toast.error(
        error.response?.data?.message || "Failed to initiate transfer",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredMembers = members.filter(
    (member) =>
      (member.user?.name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (member.user?.email || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Transfer Ownership
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You are initiating an ownership transfer for{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {meetingTitle}
            </span>
            . The target user must accept the request within 7 days.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select New Owner
            </label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search organization members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-y-auto max-h-48 bg-slate-50 dark:bg-slate-900/50">
              {loadingMembers ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  Loading...
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  No members found.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredMembers.map((m) => (
                    <button
                      key={m.user?._id}
                      onClick={() => setSelectedUserId(m.user?._id)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                        selectedUserId === m.user?._id
                          ? "bg-blue-50 dark:bg-blue-900/30"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {m.user?.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {m.user?.email}
                        </p>
                      </div>
                      {selectedUserId === m.user?._id && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Type "TRANSFER" to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="TRANSFER"
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={
              !selectedUserId || confirmText !== "TRANSFER" || isSubmitting
            }
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? "Initiating..." : "Initiate Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferOwnershipModal;
