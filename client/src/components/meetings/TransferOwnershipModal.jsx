import React, { useState, useEffect } from "react";
import { X, Search, Check, AlertCircle } from "lucide-react";
import { toast } from "react-toastify";
import { organizationApi, meetingOwnershipTransferApi } from "../../services";

const TransferOwnershipModal = ({ isOpen, onClose, meetingId, onSuccess }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
      setSearchQuery("");
      setSelectedUser(null);
      setError(null);
    }
  }, [isOpen]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response = await organizationApi.getMembers();
      if (response.data?.success) {
        setMembers(response.data.members || []);
      }
    } catch (err) {
      console.error("Failed to fetch organization members:", err);
      toast.error("Failed to load organization members");
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(
    (member) =>
      (member.name || member.user?.name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (member.email || member.user?.email || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

  const handleSubmit = async () => {
    if (!selectedUser) return;

    setSubmitting(true);
    setError(null);

    try {
      const targetUserId = selectedUser.user?._id || selectedUser._id;
      const response = await meetingOwnershipTransferApi.requestTransfer(
        meetingId,
        targetUserId,
      );

      if (response.data?.success) {
        toast.success("Transfer request sent successfully");
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError(response.data?.message || "Failed to send transfer request");
      }
    } catch (err) {
      console.error("Transfer error:", err);
      setError(err.response?.data?.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Transfer Ownership
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Transferring ownership will give the selected user full control over
            this meeting. They must accept the request within 7 days.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 -mx-2 px-2">
            {loading ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Loading members...
              </div>
            ) : filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const userObj = member.user || member;
                const isSelected = selectedUser?._id === userObj._id;

                return (
                  <button
                    key={userObj._id}
                    onClick={() => setSelectedUser(userObj)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {userObj.avatarUrl ? (
                        <img
                          src={userObj.avatarUrl}
                          alt=""
                          className="w-8 h-8 rounded-full bg-slate-200 object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center font-medium text-xs">
                          {(userObj.name || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {userObj.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {userObj.email}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                No members found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedUser || submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              "Send Request"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferOwnershipModal;
