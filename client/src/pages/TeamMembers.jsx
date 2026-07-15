import React, { useState, useEffect, useCallback, useContext } from "react";
import Navbar from "../components/Navbar.jsx";
import { organizationApi, invitationApi } from "../services";
import {
  Users,
  Search,
  Filter,
  Mail,
  Calendar,
  Shield,
  Copy,
  X,
  ChevronDown,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Send,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";
import AppContent from "../context/AppContent";

const ROLE_STYLES = {
  admin:
    "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800",
  member:
    "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800",
};

const ROLE_LABELS = {
  admin: "Admin",
  member: "Member",
};

const TeamMembers = () => {
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy] = useState("name");
  const [sortOrder] = useState("asc");
  const [roleFilter, setRoleFilter] = useState("all");

  const { userData } = useContext(AppContent);
  const [activeTab, setActiveTab] = useState("members"); // "members" | "invitations"
  const [invitations, setInvitations] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteExpiresIn, setInviteExpiresIn] = useState(7);
  const [inviteMessage, setInviteMessage] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  const isAdmin = userData?.role === "admin" || userData?.role === "owner";

  const fetchInvitations = useCallback(async () => {
    if (!userData?.organization) return;
    const orgId = userData.organization._id || userData.organization;
    try {
      setInvitesLoading(true);
      const { data } = await invitationApi.getOrganizationInvitations(orgId);
      if (data.success) {
        setInvitations(data.invitations || []);
      }
    } catch (err) {
      console.error("Error fetching invitations:", err);
    } finally {
      setInvitesLoading(false);
    }
  }, [userData]);

  useEffect(() => {
    if (activeTab === "invitations" && isAdmin) {
      fetchInvitations();
    }
  }, [activeTab, fetchInvitations, isAdmin]);

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) {
      toast.error("Email is required");
      return;
    }
    const orgId = userData?.organization?._id || userData?.organization;
    if (!orgId) {
      toast.error("No active organization selected");
      return;
    }

    try {
      setSendingInvite(true);
      const { data } = await invitationApi.createInvitation({
        organizationId: orgId,
        email: inviteEmail,
        role: inviteRole,
        expiresIn: Number(inviteExpiresIn),
        message: inviteMessage,
      });

      if (data.success) {
        toast.success("Invitation sent successfully!");
        setShowInviteModal(false);
        setInviteEmail("");
        setInviteMessage("");
        setInviteRole("member");
        setInviteExpiresIn(7);
        if (activeTab === "invitations") {
          fetchInvitations();
        }
      }
    } catch (err) {
      console.error("Error sending invitation:", err);
      toast.error(err.response?.data?.message || "Failed to send invitation");
    } finally {
      setSendingInvite(false);
    }
  };

  const handleResendInvite = async (id) => {
    try {
      const { data } = await invitationApi.resendInvitation(id);
      if (data.success) {
        toast.success("Invitation resent successfully!");
        fetchInvitations();
      }
    } catch (err) {
      console.error("Error resending invitation:", err);
      toast.error(err.response?.data?.message || "Failed to resend invitation");
    }
  };

  const handleCancelInvite = async (id) => {
    try {
      const { data } = await invitationApi.revokeInvitation(id);
      if (data.success) {
        toast.success("Invitation cancelled successfully!");
        fetchInvitations();
      }
    } catch (err) {
      console.error("Error cancelling invitation:", err);
      toast.error(err.response?.data?.message || "Failed to cancel invitation");
    }
  };

  const handleExpireInvite = async (id) => {
    try {
      const { data } = await invitationApi.expireInvitation(id);
      if (data.success) {
        toast.success("Invitation expired successfully!");
        fetchInvitations();
      }
    } catch (err) {
      console.error("Error expiring invitation:", err);
      toast.error(err.response?.data?.message || "Failed to expire invitation");
    }
  };

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await organizationApi.getMembers();

      if (data.success) {
        setMembers(data.members);
        setFilteredMembers(data.members);
      } else {
        setError(data.message || "Failed to fetch members");
      }
    } catch (err) {
      console.error("Error fetching members:", err);
      setError("Failed to fetch members. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const applyFiltersAndSort = useCallback(() => {
    let result = [...members];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (member) =>
          member.name?.toLowerCase().includes(query) ||
          member.email?.toLowerCase().includes(query) ||
          member.role?.toLowerCase().includes(query),
      );
    }

    // Apply role filter
    if (roleFilter !== "all") {
      result = result.filter((member) => member.role === roleFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "role":
          comparison = (a.role || "").localeCompare(b.role || "");
          break;
        case "joined":
          comparison = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    setFilteredMembers(result);
  }, [members, searchQuery, roleFilter, sortBy, sortOrder]);

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    toast.success("Email copied to clipboard");
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Navbar />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Navbar />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <XCircle className="h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Error Loading Members
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
            <button
              onClick={fetchMembers}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-600/20">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                Team Members
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold">
                {activeTab === "members" ? (
                  `${filteredMembers.length} ${filteredMembers.length === 1 ? "member" : "members"}`
                ) : (
                  `${invitations.length} ${invitations.length === 1 ? "invitation" : "invitations"}`
                )}
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Invite Member
            </button>
          )}
        </div>

        {/* Tabs */}
        {isAdmin && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
            <button
              onClick={() => setActiveTab("members")}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "members"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              Members
            </button>
            <button
              onClick={() => setActiveTab("invitations")}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "invitations"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              Invitations
            </button>
          </div>
        )}

        {activeTab === "members" ? (
          <>
            {/* Search and Filters */}
            <div className="mb-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                  />
                </button>

                {showFilters && (
                  <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Roles</option>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Members List */}
            {filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  No members found
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  {searchQuery || roleFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Your organization has no members yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMembers.map((member) => (
                  <div
                    key={member._id}
                    onClick={() => setSelectedMember(member)}
                    className="group relative flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all cursor-pointer"
                  >
                    {/* Avatar */}
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold text-lg">
                      {getInitials(member.name)}
                    </div>

                    {/* Member Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                          {member.name || "Unknown"}
                        </h3>
                        {member.isAccountVerified && (
                          <CheckCircle
                            className="h-4 w-4 text-green-500 shrink-0"
                            title="Verified"
                          />
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {member.email}
                      </p>
                    </div>

                    {/* Role Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${ROLE_STYLES[member.role?.toLowerCase()] || ROLE_STYLES.member}`}
                    >
                      <Shield className="h-3 w-3" />
                      {ROLE_LABELS[member.role?.toLowerCase()] ||
                        member.role ||
                        "Member"}
                    </span>

                    {/* Join Date */}
                    <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(member.createdAt)}</span>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyEmail(member.email);
                        }}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Copy email"
                      >
                        <Copy className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Invitations List */}
            {invitesLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600"></div>
              </div>
            ) : invitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Mail className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  No invitations sent
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm">
                  Invite members by email to onboard them into your organization.
                </p>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer font-semibold shadow-md shadow-blue-600/10 active:scale-95"
                >
                  Send Invitation
                </button>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in duration-200">
                {invitations.map((invite) => (
                  <div
                    key={invite._id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-xs transition-shadow"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {invite.email}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            invite.role === "admin"
                              ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800"
                              : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800"
                          }`}
                        >
                          {invite.role}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          Invited by {invite.invitedBy?.name || "Admin"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Expires {formatDate(invite.expiresAt)}
                        </span>
                      </div>
                      {invite.message && (
                        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 italic truncate max-w-xl">
                          "{invite.message}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 justify-between md:justify-end">
                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          invite.status === "pending"
                            ? "bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800"
                            : invite.status === "accepted"
                              ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                              : invite.status === "declined"
                                ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                                : invite.status === "expired"
                                  ? "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
                                  : "bg-slate-50 text-slate-500 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                        }`}
                      >
                        {invite.status === "pending" && <Clock className="w-3 h-3" />}
                        {invite.status === "accepted" && <CheckCircle className="w-3 h-3" />}
                        {invite.status === "declined" && <XCircle className="w-3 h-3" />}
                        {invite.status === "expired" && <AlertTriangle className="w-3 h-3" />}
                        {invite.status === "cancelled" && <Ban className="w-3 h-3" />}
                        <span className="capitalize">{invite.status}</span>
                      </span>

                      {/* Actions */}
                      {invite.status === "pending" && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleResendInvite(invite._id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                            title="Resend invitation"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleExpireInvite(invite._id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
                            title="Expire invitation"
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleCancelInvite(invite._id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600 hover:text-red-700 transition-colors cursor-pointer"
                            title="Cancel invitation"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Member Details Modal */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-xl animate-in zoom-in-95 slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute right-4 top-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            </button>

            {/* Modal Content */}
            <div className="p-6">
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-2xl mb-4">
                  {getInitials(selectedMember.name)}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedMember.name || "Unknown"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedMember.email}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Role
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${ROLE_STYLES[selectedMember.role?.toLowerCase()] || ROLE_STYLES.member}`}
                  >
                    {ROLE_LABELS[selectedMember.role?.toLowerCase()] ||
                      selectedMember.role ||
                      "Member"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Email
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyEmail(selectedMember.email)}
                    className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <span className="truncate max-w-[150px]">
                      {selectedMember.email}
                    </span>
                    <Copy className="h-4 w-4 shrink-0" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Joined
                    </span>
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {formatDate(selectedMember.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Status
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                    {selectedMember.isAccountVerified ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Verified
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-amber-500" />
                        Pending
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl animate-in zoom-in-95 slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute right-4 top-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            </button>

            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                Invite Team Member
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Send an email invitation to onboard a new member to your organization.
              </p>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSendInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Role *
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm cursor-pointer"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Expires In (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={inviteExpiresIn}
                    onChange={(e) => setInviteExpiresIn(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Personal Message
                </label>
                <textarea
                  placeholder="Hey, join our workspace on MeetOnMemory!"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  rows="3"
                  maxLength="500"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition-all text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingInvite}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:bg-blue-400 transition-all text-sm shadow-md shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {sendingInvite ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamMembers;
