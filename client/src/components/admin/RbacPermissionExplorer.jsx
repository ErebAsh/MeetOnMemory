import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Check,
  X,
  Filter,
  RefreshCw,
  Loader2,
  Info,
  ChevronDown,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { adminRbacApi } from "../../services/adminRbacApi.js";
import { toast } from "react-toastify";

const ROLE_BADGE_STYLES = {
  owner:
    "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  admin:
    "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  moderator:
    "bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  member:
    "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  viewer:
    "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  guest:
    "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
};

const RbacPermissionExplorer = () => {
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [expandedResources, setExpandedResources] = useState({});
  const [auditSimulatorRole, setAuditSimulatorRole] = useState("viewer");
  const [simulatorResource, setSimulatorResource] = useState("");
  const [simulatorAction, setSimulatorAction] = useState("");

  const loadMatrix = async () => {
    setLoading(true);
    try {
      const res = await adminRbacApi.getMatrix();
      if (res.data?.success && res.data?.data) {
        setMatrixData(res.data.data);
      } else {
        toast.error("Failed to load RBAC permissions matrix");
      }
    } catch (error) {
      console.error("Error loading RBAC matrix:", error);
      toast.error(
        error.response?.data?.message || "Failed to load RBAC matrix",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatrix();
  }, []);

  const roles = useMemo(() => {
    if (!matrixData?.roles) return [];
    return [...matrixData.roles].sort((a, b) => b.level - a.level);
  }, [matrixData]);

  const permissions = useMemo(() => {
    return matrixData?.permissions || {};
  }, [matrixData]);

  const resourceKeys = useMemo(() => {
    return Object.keys(permissions);
  }, [permissions]);

  const activeResource = simulatorResource || resourceKeys[0] || "";

  useEffect(() => {
    if (resourceKeys.length > 0 && !simulatorResource) {
      setSimulatorResource(resourceKeys[0]);
    }
  }, [resourceKeys, simulatorResource]);

  const availableSimulatorActions = useMemo(() => {
    if (!activeResource || !permissions[activeResource]) return [];
    return Object.keys(permissions[activeResource]);
  }, [permissions, activeResource]);

  const activeAction = simulatorAction || availableSimulatorActions[0] || "";

  useEffect(() => {
    if (availableSimulatorActions.length > 0) {
      if (
        !simulatorAction ||
        !availableSimulatorActions.includes(simulatorAction)
      ) {
        setSimulatorAction(availableSimulatorActions[0]);
      }
    } else {
      setSimulatorAction("");
    }
  }, [availableSimulatorActions, simulatorAction]);

  const toggleResource = (resource) => {
    setExpandedResources((prev) => ({
      ...prev,
      [resource]: !prev[resource],
    }));
  };

  const filteredResources = useMemo(() => {
    return resourceKeys.filter((resource) => {
      const matchesQuery =
        !searchQuery.trim() ||
        resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
        Object.keys(permissions[resource] || {}).some((act) =>
          act.toLowerCase().includes(searchQuery.toLowerCase()),
        );
      return matchesQuery;
    });
  }, [resourceKeys, searchQuery, permissions]);

  const simulationResult = useMemo(() => {
    if (!activeResource || !activeAction || !permissions[activeResource]) {
      return null;
    }
    const allowedRoles = permissions[activeResource][activeAction] || [];
    const isAllowed = allowedRoles.includes(auditSimulatorRole);
    return {
      allowed: isAllowed,
      allowedRoles,
    };
  }, [permissions, auditSimulatorRole, activeResource, activeAction]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading RBAC permission matrix...
        </p>
      </div>
    );
  }

  if (!matrixData) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          Unable to load permissions matrix
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Please check your admin permissions or retry loading.
        </p>
        <button
          type="button"
          onClick={loadMatrix}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {roles.map((r) => (
          <div
            key={r.key}
            className={`p-4 rounded-xl border bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between transition-all ${
              ROLE_BADGE_STYLES[r.key] ||
              "border-slate-200 dark:border-slate-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-sm capitalize">{r.name}</span>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white/70 dark:bg-slate-950/60 shadow-2xs">
                  Lvl {r.level}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {r.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Permission Auditor / Access Denied Explainer Simulator */}
      <div className="p-5 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-linear-to-br from-blue-50/60 via-white to-indigo-50/30 dark:from-blue-950/20 dark:via-slate-900 dark:to-indigo-950/10 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Access Audit & Denial Explainer
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Simulate any action to audit why a user role is permitted or
              blocked by the server RBAC middleware.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Role
            </label>
            <select
              value={auditSimulatorRole}
              onChange={(e) => setAuditSimulatorRole(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name} ({r.key})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Resource
            </label>
            <select
              value={simulatorResource}
              onChange={(e) => setSimulatorResource(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none capitalize"
            >
              {resourceKeys.map((res) => (
                <option key={res} value={res}>
                  {res.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Action
            </label>
            <select
              value={simulatorAction}
              onChange={(e) => setSimulatorAction(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none capitalize"
            >
              {availableSimulatorActions.map((act) => (
                <option key={act} value={act}>
                  {act.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        {simulationResult && (
          <div
            className={`mt-4 p-3.5 rounded-xl border flex items-start gap-3 ${
              simulationResult.allowed
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
            }`}
          >
            {simulationResult.allowed ? (
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <X className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm">
                {simulationResult.allowed
                  ? "Access Permitted"
                  : "Access Blocked (403 Forbidden)"}
              </p>
              <p>
                {simulationResult.allowed ? (
                  <span>
                    Role{" "}
                    <strong className="capitalize">{auditSimulatorRole}</strong>{" "}
                    is explicitly granted the <code>{simulatorAction}</code>{" "}
                    permission on <code>{simulatorResource}</code>.
                  </span>
                ) : (
                  <span>
                    Role{" "}
                    <strong className="capitalize">{auditSimulatorRole}</strong>{" "}
                    is missing the <code>{simulatorAction}</code> permission on{" "}
                    <code>{simulatorResource}</code>. Required roles:{" "}
                    <strong>{simulationResult.allowedRoles.join(", ")}</strong>.
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Matrix Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search resource or action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="text-xs px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
            >
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={loadMatrix}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Matrix
          </button>
        </div>
      </div>

      {/* Roles x Permissions Matrix Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Role × Permissions Matrix (Server Mirror)
            </h3>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            {filteredResources.length} Resources Mapped
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4 min-w-[200px]">Resource / Action</th>
                {roles
                  .filter(
                    (r) =>
                      selectedRoleFilter === "all" ||
                      r.key === selectedRoleFilter,
                  )
                  .map((r) => (
                    <th
                      key={r.key}
                      className="py-3.5 px-3 text-center min-w-[100px]"
                    >
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold capitalize ${
                          ROLE_BADGE_STYLES[r.key] ||
                          "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {r.name}
                      </span>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredResources.map((resource) => {
                const actions = Object.keys(permissions[resource] || {});
                const isExpanded = expandedResources[resource] !== false; // default open

                return (
                  <React.Fragment key={resource}>
                    {/* Resource Group Header */}
                    <tr
                      onClick={() => toggleResource(resource)}
                      className="bg-slate-50/40 dark:bg-slate-800/20 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 cursor-pointer font-bold transition-colors"
                    >
                      <td
                        colSpan={
                          1 +
                          roles.filter(
                            (r) =>
                              selectedRoleFilter === "all" ||
                              r.key === selectedRoleFilter,
                          ).length
                        }
                        className="py-2.5 px-4 text-slate-900 dark:text-white"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                          <span className="capitalize text-sm tracking-wide">
                            {resource.replace(/_/g, " ")}
                          </span>
                          <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                            ({actions.length} action
                            {actions.length === 1 ? "" : "s"})
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Action Rows */}
                    {isExpanded &&
                      actions.map((action) => {
                        const allowedRoles =
                          permissions[resource][action] || [];

                        return (
                          <tr
                            key={`${resource}-${action}`}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-2.5 px-4 pl-10 text-slate-700 dark:text-slate-300 font-medium">
                              <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                                {action}
                              </span>
                            </td>
                            {roles
                              .filter(
                                (r) =>
                                  selectedRoleFilter === "all" ||
                                  r.key === selectedRoleFilter,
                              )
                              .map((r) => {
                                const hasAccess = allowedRoles.includes(r.key);

                                return (
                                  <td
                                    key={r.key}
                                    className="py-2.5 px-3 text-center align-middle"
                                  >
                                    {hasAccess ? (
                                      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600">
                                        <X className="w-3.5 h-3.5 stroke-[2]" />
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RbacPermissionExplorer;
