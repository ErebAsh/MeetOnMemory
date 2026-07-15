import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useContext,
} from "react";
import Navbar from "../components/Navbar.jsx";
import { toast } from "react-toastify";
import { policyApi } from "../services";
import AppContent from "../context/AppContent";
import {
  Upload,
  FileText,
  History,
  Download,
  Eye,
  GitBranch,
  MessageSquare,
  Loader2,
  Trash2,
  UserCircle,
  Search,
  RefreshCw,
  Columns2,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  X,
  ChevronDown,
  ChevronUp,
  Tag,
  AlertCircle,
  Sparkles,
  FilePlus,
} from "lucide-react";

// ──────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────
const formatDate = (d) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const formatRelative = (d) => {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
};

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

/** Status pill with colour-coded processing state */
const StatusBadge = ({ status }) => {
  const map = {
    uploading: {
      icon: Upload,
      label: "Uploading",
      cls: "bg-blue-50 text-blue-700 border-blue-200",
    },
    processing: {
      icon: Cpu,
      label: "Processing AI",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    ready: {
      icon: CheckCircle2,
      label: "Ready",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    failed: {
      icon: XCircle,
      label: "Failed",
      cls: "bg-red-50 text-red-700 border-red-200",
    },
  };
  const cfg = map[status] || map.ready;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

/** Generic keyword / version pill */
const Pill = ({ children, tone = "indigo" }) => {
  const toneMap = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneMap[tone] || toneMap.indigo}`}
    >
      {children}
    </span>
  );
};

/** Upload progress bar */
const ProgressBar = ({ progress, stage }) => {
  const stageLabels = {
    idle: "",
    uploading: `Uploading… ${progress}%`,
    processing: "Generating AI summary…",
    done: "Complete!",
    error: "Upload failed",
  };
  if (stage === "idle") return null;

  const barColor =
    stage === "done"
      ? "bg-emerald-500"
      : stage === "error"
        ? "bg-red-500"
        : stage === "processing"
          ? "bg-amber-400"
          : "bg-blue-500";

  const displayProgress =
    stage === "processing"
      ? 90
      : stage === "done"
        ? 100
        : stage === "error"
          ? 100
          : progress;

  return (
    <div className="mt-4 space-y-1">
      <div className="flex items-center justify-between text-xs font-medium text-gray-600">
        <span className="flex items-center gap-1">
          {stage === "processing" && (
            <Loader2 className="w-3 h-3 animate-spin" />
          )}
          {stage === "done" && (
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          )}
          {stage === "error" && <XCircle className="w-3 h-3 text-red-500" />}
          {stageLabels[stage]}
        </span>
        <span>{displayProgress}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor} ${stage === "processing" ? "animate-pulse" : ""}`}
          style={{ width: `${displayProgress}%` }}
        />
      </div>
    </div>
  );
};

/** Skeleton card for loading state */
const SkeletonRow = () => (
  <div className="px-6 py-4 animate-pulse flex gap-4 items-start border-b last:border-0">
    <div className="w-5 h-5 rounded bg-gray-200 mt-0.5 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-gray-200 rounded w-2/5" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
      <div className="flex gap-2 mt-1">
        <div className="h-5 bg-gray-100 rounded-full w-14" />
        <div className="h-5 bg-gray-100 rounded-full w-20" />
      </div>
    </div>
    <div className="w-20 h-4 bg-gray-200 rounded" />
    <div className="w-28 h-4 bg-gray-200 rounded" />
    <div className="flex gap-2">
      <div className="w-10 h-6 bg-gray-100 rounded" />
      <div className="w-16 h-6 bg-gray-100 rounded" />
    </div>
  </div>
);

/** Empty state */
const Empty = (props) => {
  const { icon: IconComponent, title, subtitle, action } = props;
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
        <IconComponent className="w-8 h-8 text-indigo-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      {subtitle && (
        <p className="text-gray-500 mt-2 max-w-sm text-sm leading-relaxed">
          {subtitle}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};

/** Modal wrapper */
const Modal = ({ children, onClose, maxWidth = "max-w-3xl" }) => (
  <div
    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-start z-50 p-4 pt-16 overflow-y-auto"
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div
      className={`bg-white w-full ${maxWidth} rounded-2xl shadow-2xl relative`}
    >
      <button
        onClick={onClose}
        aria-label="Close modal"
        className="absolute top-4 right-4 z-10 p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
      >
        <X className="w-5 h-5" />
      </button>
      {children}
    </div>
  </div>
);

// ──────────────────────────────────────────────
// Drag-and-Drop Upload Zone
// ──────────────────────────────────────────────
const DropZone = ({ onFile, disabled, selectedFile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload policy file"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) =>
        e.key === "Enter" && !disabled && inputRef.current?.click()
      }
      className={`
        relative flex flex-col items-center justify-center gap-3 px-6 py-10 rounded-xl border-2 border-dashed cursor-pointer transition-all
        ${disabled ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50" : ""}
        ${isDragging ? "border-indigo-400 bg-indigo-50 scale-[1.01]" : !disabled ? "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40 bg-gray-50" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          // Reset input so same file can be re-selected
          e.target.value = "";
        }}
      />
      <div
        className={`p-3 rounded-full transition ${isDragging ? "bg-indigo-100" : "bg-white shadow-sm"}`}
      >
        <Upload
          className={`w-6 h-6 ${isDragging ? "text-indigo-600" : "text-gray-400"}`}
        />
      </div>
      {selectedFile ? (
        <div className="text-center">
          <p className="font-medium text-gray-800 text-sm">
            {selectedFile.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {(selectedFile.size / 1024).toFixed(0)} KB · Click to change
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="font-medium text-gray-700 text-sm">
            {isDragging ? "Drop to upload" : "Drag & drop or click to select"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            PDF, DOCX, or TXT · Max 20 MB
          </p>
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
const Policies = () => {
  const { userData } = useContext(AppContent);
  const isAdmin = userData?.role === "admin" || userData?.role === "owner";

  // Upload state
  const [file, setFile] = useState(null);
  const [commitMsg, setCommitMsg] = useState("");
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [existingPolicy, setExistingPolicy] = useState(null);
  const [uploadStage, setUploadStage] = useState("idle"); // idle | uploading | processing | done | error
  const [uploadProgress, setUploadProgress] = useState(0);

  // Data
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [showHistoryFor, setShowHistoryFor] = useState(null);
  const [comparePair, setComparePair] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("desc");

  // Ref to upload card for empty-state scroll
  const uploadCardRef = useRef(null);

  const isUploading =
    uploadStage === "uploading" || uploadStage === "processing";

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await policyApi.getPolicies();
      if (res.data.success) setPolicies(res.data.policies || []);
      else toast.error(res.data.message || "Failed to load policies.");
    } catch (err) {
      if (err.response) {
        toast.error(
          `Server error (${err.response.status}): Could not fetch policies.`,
        );
      } else if (err.request) {
        toast.error(
          "Network error: Unable to reach the server. Check your connection.",
        );
      } else {
        toast.error("Failed to load policies.");
      }
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // ── File selection (smart duplicate detection) ──
  const handleFileSelect = useCallback(
    (f) => {
      if (!f) return;
      setFile(f);
      setUploadProgress(0);
      setUploadStage("idle");

      const found = policies.find((p) => p.name === f.name);
      if (found) {
        setExistingPolicy(found);
        setShowUpdatePrompt(true);
      } else {
        setExistingPolicy(null);
        setShowUpdatePrompt(false);
      }
    },
    [policies],
  );

  // ── Scroll to upload card (used by empty-state button) ──
  const scrollToUpload = useCallback(() => {
    uploadCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    uploadCardRef.current?.querySelector("div[role='button']")?.focus();
  }, []);

  // ── Upload handler ──
  const handleUpload = async (isUpdate = false) => {
    if (!file) return toast.error("Please select a file first.");
    if (isUploading) return;

    const formData = new FormData();
    formData.append("file", file);
    if (isUpdate && commitMsg.trim()) formData.append("commitMsg", commitMsg);

    setUploadStage("uploading");
    setUploadProgress(0);

    try {
      const res = await policyApi.uploadPolicy(formData, isUpdate, {
        onUploadProgress: (event) => {
          if (event.total) {
            const pct = Math.round((event.loaded * 100) / event.total);
            setUploadProgress(Math.min(pct, 85)); // cap at 85 — rest is AI processing
          }
        },
      });

      if (res.data.success) {
        setUploadStage("done");
        setUploadProgress(100);
        toast.success(
          isUpdate
            ? "✅ New version uploaded and analyzed successfully!"
            : "✅ Policy uploaded and analyzed successfully!",
        );

        // Brief pause so user sees "done" state
        setTimeout(() => {
          setFile(null);
          setCommitMsg("");
          setShowUpdatePrompt(false);
          setExistingPolicy(null);
          setUploadStage("idle");
          setUploadProgress(0);
          fetchPolicies();
        }, 1500);
      } else {
        setUploadStage("error");
        toast.error(res.data.message || "Upload failed. Please try again.");
        setTimeout(() => setUploadStage("idle"), 3000);
      }
    } catch (err) {
      setUploadStage("error");
      console.error("Upload error:", err);

      if (err.response) {
        const msg = err.response.data?.message;
        if (err.response.status === 401) {
          toast.error("Session expired. Please log in and try again.");
        } else if (err.response.status === 400) {
          toast.error(
            msg || "Invalid file. Please check the file type and size.",
          );
        } else if (err.response.status === 413) {
          toast.error("File too large. Maximum allowed size is 20 MB.");
        } else {
          toast.error(msg || "Server error during upload. Please try again.");
        }
      } else if (err.request) {
        toast.error("Network error: Upload could not reach the server.");
      } else {
        toast.error("Unexpected error. Please try again.");
      }
      setTimeout(() => setUploadStage("idle"), 3000);
    }
  };

  // ── Download ──
  const handleDownload = async (policyId, filename = "policy.pdf") => {
    try {
      const res = await policyApi.downloadPolicy(policyId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error("File not found on the server.");
      } else {
        toast.error("Download failed. Please try again.");
      }
    }
  };

  // ── Delete ──
  const handleDelete = async (policyId) => {
    try {
      const res = await policyApi.deletePolicy(policyId);
      if (res.data.success) {
        toast.success("Policy deleted.");
        setConfirmDelete(null);
        // If deleted policy is open in modal, close it
        if (selectedPolicy?._id === policyId) setSelectedPolicy(null);
        fetchPolicies();
      } else {
        toast.error(res.data.message || "Delete failed.");
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 404) {
        toast.error("Policy not found — it may have already been deleted.");
        setConfirmDelete(null);
        fetchPolicies();
      } else {
        toast.error("Delete failed. Please try again.");
      }
    }
  };

  // ── Re-analyze ──
  const handleReanalyze = async (policyId) => {
    toast.info("🤖 Re-analyzing policy with AI…");
    try {
      const res = await policyApi.analyzePolicy(policyId);
      if (res.data.success) {
        toast.success("✅ AI analysis complete!");
        fetchPolicies();
      } else {
        toast.error(res.data.message || "AI processing failed.");
      }
    } catch (err) {
      console.error("Re-analyze error:", err);
      toast.error("AI processing failed. Please try again later.");
    }
  };

  // ── Filtered & sorted list ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...policies];
    if (q) {
      list = list.filter((p) =>
        [p.name, p.summary, (p.keywords || []).join(" "), p?.uploadedBy?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey] || a.updatedAt || a.createdAt || "";
      const bv = b[sortKey] || b.updatedAt || b.createdAt || "";
      return av > bv ? dir : av < bv ? -dir : 0;
    });
    return list;
  }, [policies, query, sortKey, sortDir]);

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar />

      <div className="max-w-7xl mx-auto w-full pt-24 pb-20 px-4 sm:px-6">
        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </span>
              Policy Repository
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
              Upload, version, and track policy documents with AI-powered
              summaries.
            </p>
          </div>

          <button
            onClick={fetchPolicies}
            className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium transition self-start md:self-auto"
            aria-label="Refresh policy list"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* ── Upload Card (Admin Only) ── */}
        {isAdmin && (
          <div
            ref={uploadCardRef}
            className="bg-white dark:bg-gray-800 shadow-sm rounded-2xl mb-8 border border-gray-100 dark:border-gray-700 overflow-hidden"
          >
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
                <FilePlus className="w-5 h-5 text-indigo-500" />
                Upload Policy Document
              </h2>

              <DropZone
                onFile={handleFileSelect}
                disabled={isUploading}
                selectedFile={file}
              />

              <ProgressBar progress={uploadProgress} stage={uploadStage} />
            </div>

            {/* Duplicate → update prompt */}
            {showUpdatePrompt && existingPolicy && (
              <div className="mx-6 mt-4 mb-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-1 text-sm">
                  <GitBranch className="w-4 h-4" />
                  This file already exists — currently at v
                  {existingPolicy.version || "1.0"}
                </h3>
                <p className="text-xs text-amber-700 mb-3">
                  Upload as a <strong>new version</strong> with a commit message,
                  or rename your file to upload as a separate policy.
                </p>
                <input
                  type="text"
                  placeholder="Describe the changes (e.g., Updated Section 2: Staff Policy)"
                  value={commitMsg}
                  onChange={(e) => setCommitMsg(e.target.value)}
                  disabled={isUploading}
                  className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleUpload(true)}
                    disabled={isUploading}
                    className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <GitBranch className="w-4 h-4" />
                    )}
                    {isUploading ? "Processing…" : "Commit & Upload New Version"}
                  </button>
                  <button
                    onClick={() => {
                      setShowUpdatePrompt(false);
                      setExistingPolicy(null);
                      setFile(null);
                      setUploadStage("idle");
                    }}
                    disabled={isUploading}
                    className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Primary upload button (only when no duplicate prompt) */}
            {!showUpdatePrompt && (
              <div className="px-6 pb-6 pt-4 flex gap-2">
                <button
                  onClick={() => handleUpload(false)}
                  disabled={isUploading || !file}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />{" "}
                      {uploadStage === "processing"
                        ? "AI Processing…"
                        : "Uploading…"}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" /> Upload
                    </>
                  )}
                </button>
                {file && !isUploading && (
                  <button
                    onClick={() => {
                      setFile(null);
                      setUploadStage("idle");
                      setShowUpdatePrompt(false);
                    }}
                    className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Search policies, keywords, authors…"
              aria-label="Search policies"
            />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 shrink-0">Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              aria-label="Sort field"
            >
              <option value="updatedAt">Last updated</option>
              <option value="createdAt">Created</option>
              <option value="name">Name</option>
            </select>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              aria-label="Sort direction"
            >
              <option value="desc">Newest</option>
              <option value="asc">Oldest</option>
            </select>
          </div>
        </div>

        {/* ── Policy List ── */}
        <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
          {/* Table header (desktop) */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs uppercase tracking-wider text-gray-400 bg-gray-50 border-b font-medium">
            <div className="col-span-5">Document</div>
            <div className="col-span-2">Version</div>
            <div className="col-span-3">Uploaded by</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : filtered.length === 0 ? (
            <Empty
              icon={FileText}
              title={query ? "No matching policies" : "No policy documents yet"}
              subtitle={
                query
                  ? `No policies match "${query}". Try a different search term.`
                  : "Upload your first policy to get AI summaries, keywords, and full version tracking."
              }
              action={
                !query ? (
                  <button
                    onClick={scrollToUpload}
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                  >
                    <Upload className="w-4 h-4" /> Upload a Policy
                  </button>
                ) : null
              }
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((p) => (
                <PolicyRow
                  key={p._id}
                  policy={p}
                  onView={() => setSelectedPolicy(p)}
                  onHistory={() => setShowHistoryFor(p)}
                  onDownload={() => handleDownload(p._id, p.name)}
                  onDelete={() => setConfirmDelete(p)}
                  onReanalyze={() => handleReanalyze(p._id)}
                  isAdmin={isAdmin}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Results count */}
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-gray-400 mt-3 text-right">
            {filtered.length} {filtered.length === 1 ? "policy" : "policies"}{" "}
            {query ? "found" : "total"}
          </p>
        )}
      </div>

      {/* ── View / Detail Modal ── */}
      {selectedPolicy && (
        <Modal onClose={() => setSelectedPolicy(null)} maxWidth="max-w-3xl">
          <PolicyDetailModal
            policy={selectedPolicy}
            onClose={() => setSelectedPolicy(null)}
            onDownload={handleDownload}
            onReanalyze={handleReanalyze}
            onCompare={(older) => {
              setComparePair({ older, newer: selectedPolicy });
              setSelectedPolicy(null);
            }}
          />
        </Modal>
      )}

      {/* ── Version History Modal ── */}
      {showHistoryFor && (
        <Modal onClose={() => setShowHistoryFor(null)} maxWidth="max-w-4xl">
          <HistoryModal
            policy={showHistoryFor}
            onClose={() => setShowHistoryFor(null)}
            onDownload={handleDownload}
            onCompare={(older) => {
              setComparePair({ older, newer: showHistoryFor });
              setShowHistoryFor(null);
            }}
          />
        </Modal>
      )}

      {/* ── Compare Modal ── */}
      {comparePair && (
        <Modal onClose={() => setComparePair(null)} maxWidth="max-w-6xl">
          <CompareModal
            pair={comparePair}
            onClose={() => setComparePair(null)}
          />
        </Modal>
      )}

      {/* ── Delete Confirm Modal ── */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} maxWidth="max-w-md">
          <DeleteConfirmModal
            policy={confirmDelete}
            onClose={() => setConfirmDelete(null)}
            onConfirm={() => handleDelete(confirmDelete._id)}
          />
        </Modal>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────
// Policy Row
// ──────────────────────────────────────────────
const PolicyRow = ({
  policy: p,
  onView,
  onHistory,
  onDownload,
  onDelete,
  onReanalyze,
  isAdmin,
}) => {
  const authorName = p?.uploadedBy?.name || p?.lastEditedBy?.name || "Unknown";
  const needsReanalysis =
    !p.summary ||
    p.summary.includes("unavailable") ||
    p.summary.includes("failed") ||
    p.status === "failed";

  return (
    <li className="px-4 sm:px-6 py-4 grid md:grid-cols-12 gap-3 items-start hover:bg-gray-50/70 transition-colors">
      {/* Name & meta — 5 cols */}
      <div className="md:col-span-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 shrink-0">
            <FileText className="w-4 h-4 text-indigo-500" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onView}
                className="text-sm font-semibold text-gray-900 hover:text-indigo-700 text-left leading-snug"
              >
                {p.name}
              </button>
              <StatusBadge status={p.status || "ready"} />
              {needsReanalysis && p.status !== "processing" && (
                <button
                  onClick={onReanalyze}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  title="Retry AI analysis"
                >
                  <Sparkles className="w-3 h-3" /> Retry AI
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Updated {formatRelative(p.updatedAt || p.createdAt)}
            </p>
            {p.keywords?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {p.keywords.slice(0, 5).map((tag, i) => (
                  <span
                    key={i}
                    className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100"
                  >
                    #{tag}
                  </span>
                ))}
                {p.keywords.length > 5 && (
                  <span className="text-xs text-gray-400">
                    +{p.keywords.length - 5} more
                  </span>
                )}
              </div>
            )}
            {p.summary && !needsReanalysis && (
              <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                {p.summary}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Version — 2 cols */}
      <div className="md:col-span-2 flex items-center gap-2">
        <Pill tone="indigo">v{p.version || "1.0"}</Pill>
        {p.previousVersions?.length > 0 && (
          <button
            className="text-xs text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-0.5"
            onClick={onHistory}
          >
            <History className="w-3 h-3" />
            {p.previousVersions.length}
          </button>
        )}
      </div>

      {/* Author — 3 cols */}
      <div className="md:col-span-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-700">
          <UserCircle className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="truncate">{authorName}</span>
        </div>
        {p.commitMsg && (
          <p
            className="text-xs text-gray-400 mt-0.5 truncate"
            title={p.commitMsg}
          >
            {p.commitMsg}
          </p>
        )}
      </div>

      {/* Actions — 2 cols */}
      <div className="md:col-span-2 flex md:justify-end gap-1.5 flex-wrap">
        <ActionBtn onClick={onView} icon={Eye} label="View" color="blue" />
        <ActionBtn
          onClick={onDownload}
          icon={Download}
          label="Download"
          color="indigo"
        />
        <ActionBtn
          onClick={onHistory}
          icon={History}
          label="History"
          color="purple"
        />
        {isAdmin && (
          <ActionBtn
            onClick={onDelete}
            icon={Trash2}
            label="Delete"
            color="red"
          />
        )}
      </div>
    </li>
  );
};

const ActionBtn = (props) => {
  const { onClick, icon: IconBtn, label, color = "gray" } = props;
  const colorMap = {
    blue: "hover:text-blue-600 hover:bg-blue-50",
    indigo: "hover:text-indigo-600 hover:bg-indigo-50",
    purple: "hover:text-purple-600 hover:bg-purple-50",
    red: "hover:text-red-600 hover:bg-red-50",
    gray: "hover:text-gray-900 hover:bg-gray-100",
  };
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-lg text-gray-500 transition ${colorMap[color] || colorMap.gray}`}
    >
      <IconBtn className="w-4 h-4" />
    </button>
  );
};

// ──────────────────────────────────────────────
// Policy Detail Modal
// ──────────────────────────────────────────────
const PolicyDetailModal = ({
  policy: p,
  onClose,
  onDownload,
  onReanalyze,
  onCompare,
}) => {
  const authorName = p?.uploadedBy?.name || "Unknown";
  const editorName = p?.lastEditedBy?.name;
  const hasAiContent =
    p.summary &&
    !p.summary.includes("unavailable") &&
    !p.summary.includes("failed");

  return (
    <div className="p-6">
      {/* Header */}
      <div className="pr-8 mb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
          <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
          {p.name}
        </h2>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
          <span>
            Version <Pill tone="indigo">v{p.version || "1.0"}</Pill>
          </span>
          <StatusBadge status={p.status || "ready"} />
          <span>Uploaded {formatDate(p.createdAt)}</span>
          <span className="flex items-center gap-1">
            <UserCircle className="w-4 h-4" /> {authorName}
          </span>
          {editorName && editorName !== authorName && (
            <span className="text-xs text-gray-400">
              Last edited by {editorName}
            </span>
          )}
        </div>
      </div>

      {/* Keywords */}
      {p.keywords?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {p.keywords.map((kw, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100"
            >
              <Tag className="w-3 h-3" />#{kw}
            </span>
          ))}
        </div>
      )}

      {/* AI Summary */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
          <Sparkles className="w-4 h-4 text-amber-500" /> AI Summary
        </h3>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
          {p.summary || "No summary available for this document."}
        </div>
        {!hasAiContent && (
          <button
            onClick={() => {
              onReanalyze(p._id);
              onClose();
            }}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            <Sparkles className="w-3 h-3" /> Retry AI Analysis
          </button>
        )}
      </div>

      {/* Key Changes */}
      {p.key_changes?.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
            <MessageSquare className="w-4 h-4 text-indigo-500" /> Key Changes
          </h3>
          <ul className="text-sm text-gray-600 list-disc ml-5 space-y-1">
            {p.key_changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Commit message */}
      {p.commitMsg && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-sm text-amber-800">
          <span className="font-medium">Commit:</span> {p.commitMsg}
        </div>
      )}

      {/* Previous Versions */}
      {p.previousVersions?.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
            <History className="w-4 h-4 text-purple-500" /> Previous Versions
          </h3>
          <ul className="space-y-2">
            {p.previousVersions.map((v, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-sm bg-gray-50 border rounded-lg px-3 py-2 gap-3"
              >
                <span className="text-gray-700 truncate">
                  <Pill tone="gray">v{v.version || "?"}</Pill>
                  <span className="ml-2 text-gray-500">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                  {v?.uploadedBy?.name && (
                    <span className="text-gray-400 ml-1">
                      · {v.uploadedBy.name}
                    </span>
                  )}
                  {v.commitMsg && (
                    <span className="text-gray-400 ml-1 italic">
                      · {v.commitMsg}
                    </span>
                  )}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="text-xs text-indigo-700 hover:underline flex items-center gap-1"
                    onClick={() => onCompare(v)}
                  >
                    <Columns2 className="w-3 h-3" /> Compare
                  </button>
                  <button
                    className="text-xs text-gray-600 hover:text-blue-600 flex items-center gap-1"
                    onClick={() => onDownload(v._id, v.name)}
                  >
                    <Download className="w-3 h-3" /> Download
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-100 mt-2">
        <button
          onClick={() => onDownload(p._id, p.name)}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          <Download className="w-4 h-4" /> Download
        </button>
        <button
          onClick={onClose}
          className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// Version History Modal
// ──────────────────────────────────────────────
const HistoryModal = ({ policy: p, onDownload, onCompare }) => {
  const [expandedIdx, setExpandedIdx] = useState(null);

  return (
    <div className="p-6">
      <div className="pr-8 mb-5">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5 text-purple-600" />
          Version History
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {p.name} · Current: <Pill tone="indigo">v{p.version || "1.0"}</Pill>
          <span className="ml-2">{formatDate(p.updatedAt || p.createdAt)}</span>
        </p>
      </div>

      {/* Current version entry */}
      <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-indigo-800">
              v{p.version || "1.0"}
            </span>
            <span className="text-xs text-indigo-600 ml-2">(current)</span>
            <span className="text-xs text-gray-500 ml-2">
              {formatDate(p.updatedAt || p.createdAt)}
            </span>
            {p.uploadedBy?.name && (
              <span className="text-xs text-gray-400 ml-2">
                · {p.uploadedBy.name}
              </span>
            )}
          </div>
          <button
            onClick={() => onDownload(p._id, p.name)}
            className="text-xs text-indigo-700 hover:underline flex items-center gap-1"
          >
            <Download className="w-3 h-3" /> Download
          </button>
        </div>
        {p.commitMsg && (
          <p className="text-xs text-indigo-700 mt-1 italic">{p.commitMsg}</p>
        )}
        {p.summary && (
          <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">
            {p.summary}
          </p>
        )}
      </div>

      {/* Previous versions */}
      {p.previousVersions?.length > 0 ? (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {[...p.previousVersions].reverse().map((v, i) => {
            const isExpanded = expandedIdx === i;
            return (
              <div
                key={v._id || v.createdAt || i}
                className="border rounded-xl bg-gray-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">
                        v{v.version || "?"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(v.createdAt)}
                      </span>
                      {v.uploadedBy?.name && (
                        <span className="text-xs text-gray-400">
                          · {v.uploadedBy.name}
                        </span>
                      )}
                    </div>
                    {v.commitMsg && (
                      <p className="text-xs text-gray-500 mt-0.5 italic">
                        {v.commitMsg}
                      </p>
                    )}
                    {v.keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {v.keywords.slice(0, 4).map((kw, ki) => (
                          <span
                            key={ki}
                            className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(v.summary || v.key_changes?.length > 0) && (
                      <button
                        onClick={() => setExpandedIdx(isExpanded ? null : i)}
                        className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-0.5"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      className="text-xs text-indigo-700 hover:underline flex items-center gap-1"
                      onClick={() => onCompare(v)}
                    >
                      <Columns2 className="w-3 h-3" /> Compare
                    </button>
                    <button
                      className="text-xs text-gray-600 hover:text-blue-600 flex items-center gap-1"
                      onClick={() => onDownload(v._id, v.name)}
                    >
                      <Download className="w-3 h-3" /> Download
                    </button>
                  </div>
                </div>
                {/* Expandable AI summary */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 bg-white">
                    {v.summary && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" /> AI
                          Summary
                        </p>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {v.summary}
                        </p>
                      </div>
                    )}
                    {v.key_changes?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-600 mb-1">
                          Key Changes
                        </p>
                        <ul className="list-disc ml-4 text-xs text-gray-600 space-y-0.5">
                          {v.key_changes.map((c, ci) => (
                            <li key={ci}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400 text-sm">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No previous versions yet. Upload a new version to start tracking
          history.
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────
// Compare Modal
// ──────────────────────────────────────────────
const CompareModal = ({ pair, onClose }) => (
  <div className="p-6">
    <div className="pr-8 mb-5">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <Columns2 className="w-5 h-5 text-indigo-600" />
        Compare Versions
      </h3>
      <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
        <Pill tone="gray">v{pair.older.version || "?"}</Pill>
        <span>→</span>
        <Pill tone="indigo">v{pair.newer.version || "?"}</Pill>
        <span>(current)</span>
      </div>
    </div>

    <div className="grid md:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
      {[
        { label: "Older", v: pair.older },
        { label: "Newer (current)", v: pair.newer },
      ].map(({ label, v }) => (
        <div key={label} className="border rounded-xl p-4 bg-gray-50">
          <div className="mb-3">
            <h4 className="font-semibold text-gray-800">
              {label} —{" "}
              <Pill tone={label === "Older" ? "gray" : "indigo"}>
                v{v.version || "?"}
              </Pill>
            </h4>
            <p className="text-xs text-gray-400 mt-1">
              {formatDate(v.createdAt)}
              {v?.uploadedBy?.name ? ` · by ${v.uploadedBy.name}` : ""}
            </p>
            {v.commitMsg && (
              <p className="text-xs italic text-gray-500 mt-0.5">
                {v.commitMsg}
              </p>
            )}
          </div>

          {v.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {v.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="text-xs bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full"
                >
                  #{kw}
                </span>
              ))}
            </div>
          )}

          <div className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> AI Summary
          </div>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
            {v.summary || "(No summary available for this version)"}
          </pre>

          {v.key_changes?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-600 mb-1">
                Key Changes
              </p>
              <ul className="list-disc ml-4 text-xs text-gray-600 space-y-0.5">
                {v.key_changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>

    <div className="mt-4 flex justify-end">
      <button
        onClick={onClose}
        className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
      >
        Close
      </button>
    </div>
  </div>
);

// ──────────────────────────────────────────────
// Delete Confirm Modal
// ──────────────────────────────────────────────
const DeleteConfirmModal = ({ policy, onClose, onConfirm }) => (
  <div className="p-6">
    <div className="flex items-start gap-3 mb-4">
      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100 shrink-0">
        <Trash2 className="w-5 h-5 text-red-600" />
      </span>
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Delete policy?</h3>
        <p className="text-sm text-gray-500 mt-1">
          You are about to permanently delete{" "}
          <strong className="text-gray-800">{policy.name}</strong>
          {policy.previousVersions?.length > 0 && (
            <span className="text-red-600">
              {" "}
              and all {policy.previousVersions.length} previous version
              {policy.previousVersions.length !== 1 ? "s" : ""}
            </span>
          )}
          . This action cannot be undone.
        </p>
      </div>
    </div>
    <div className="flex justify-end gap-2">
      <button
        onClick={onClose}
        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
      >
        Delete Permanently
      </button>
    </div>
  </div>
);

export default Policies;
