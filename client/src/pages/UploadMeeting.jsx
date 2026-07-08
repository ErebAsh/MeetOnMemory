import React, { useState, useContext, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  UploadCloud,
  Calendar,
  Type,
  FileAudio,
  FileText,
  Sparkles,
  Loader2,
  Trash2,
  Copy,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent";
import useExport from "../hooks/useExport.js";

const UploadMeeting = () => {
  const { backendUrl, userData } = useContext(AppContent);

  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [meetingId, setMeetingId] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { exportMeeting, isExporting } = useExport();

  const fileInputRef = useRef(null);

  // New fields for required date + optional title
  const [meetingDate, setMeetingDate] = useState(() => {
    // default to today's date in yyyy-mm-dd for input[type=date]
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [title, setTitle] = useState("");

  const allowedTypes = [
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/x-m4a",
    "audio/mp4",
    "audio/m4a",
  ];

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateAndSetFile = (f) => {
    if (!f) return;
    const fileExt = f.name.split(".").pop().toLowerCase();
    const allowedExtensions = ["wav", "mp3", "m4a", "mp4"];

    if (
      !allowedTypes.includes(f.type) &&
      !allowedExtensions.includes(fileExt)
    ) {
      toast.error("Unsupported file type. Please use WAV, MP3, or M4A files.");
      return;
    }
    setFile(f);
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) validateAndSetFile(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSetFile(f);
  };

  const handleReset = () => {
    setFile(null);
    setTranscript("");
    setSummary("");
    setMeetingId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.info("Upload settings reset.");
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select an audio file first.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setTranscript("");
      setSummary("");
      setMeetingId(null);

      const formData = new FormData();
      formData.append("file", file);
      // don't force title here; user may leave it blank -> backend will auto-generate later
      if (title) formData.append("title", title);

      const res = await axios.post(
        `${backendUrl}/api/meetings/upload`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            setUploadProgress(percent);
          },
        },
      );

      if (res.data?.success) {
        toast.success("Transcription complete!");
        setTranscript(res.data.transcript || "");
        setMeetingId(res.data.meetingId || null);
        // if backend returns an auto title, populate it (optional)
        if (res.data.autoTitle) setTitle(res.data.autoTitle);
      } else {
        toast.error(res.data?.message || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Server error during upload",
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Generate structured MoM (minutes of meeting) using backend (Gemini or HF fallback)
  const handleGenerateSummary = async () => {
    if (!transcript && !meetingId) {
      toast.error("No transcript available. Upload a meeting first.");
      return;
    }
    // meeting date is required
    if (!meetingDate) {
      toast.error("Please select a meeting date (required).");
      return;
    }

    try {
      setIsSummarizing(true);
      setSummary("");

      // Prefer to send meetingId (backend will lookup transcript in DB); also send date + optional title
      const payload = {
        meetingId: meetingId || undefined,
        transcript: meetingId ? undefined : transcript,
        date: meetingDate,
        title: title || undefined, // backend will auto-generate if missing
      };

      const res = await axios.post(
        `${backendUrl}/api/meetings/summarize`,
        payload,
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
          timeout: 120000,
        },
      );

      if (res.data?.success) {
        // backend returns structured object plus a human readable summary text
        setSummary(
          res.data.momText ||
            res.data.summary ||
            JSON.stringify(res.data.mom || res.data),
        );
        toast.success("Minutes of Meeting created!");
      } else {
        toast.error(res.data?.message || "Failed to generate summary");
      }
    } catch (err) {
      console.error("Summarize error:", err);
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          err.message ||
          "AI summarization failed",
      );
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleExport = (format) => {
    setShowExportMenu(false);
    // Use the temporary generated mom object or saved object
    const meetingToExport = {
      _id: meetingId,
      title: title,
      structuredMoM: summary,
    };
    exportMeeting(meetingToExport, format);
  };

  const handleDownloadTranscript = () => {
    if (!transcript) return;
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${userData?.name || "meeting"}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-blue-50/50 flex flex-col font-sans">
      <Navbar />
      <div className="flex-grow pt-28 pb-16 px-4 sm:px-6 lg:px-8 animate-fade-in">
        <div className="max-w-5xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-10 fade-in-up">
            <div className="inline-flex items-center justify-center p-3 bg-blue-50/80 rounded-2xl mb-4 border border-blue-100 shadow-inner">
              <UploadCloud className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Upload Recorded Meeting
            </h1>
            <p className="text-gray-500 mt-2 max-w-xl mx-auto text-sm sm:text-base">
              Upload meeting recordings (WAV, MP3, M4A). We'll transcribe it
              using AI, then generate structured Minutes of Meeting (MoM).
            </p>
          </div>

          {/* Main Upload Card (Glassmorphic) */}
          <div className="bg-white/90 backdrop-blur-md shadow-xl rounded-2xl border border-gray-100 p-6 md:p-8 mb-10 transition-all duration-300 hover:shadow-2xl fade-in-up stagger-1">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Left Column: Form Inputs */}
              <div className="flex flex-col justify-between space-y-5">
                <div>
                  <label
                    htmlFor="meeting-title"
                    className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5"
                  >
                    <Type className="w-4 h-4 text-blue-500" />
                    Optional Title
                  </label>
                  <div className="relative">
                    <input
                      id="meeting-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="AI will auto-generate if left blank"
                      className="block w-full text-sm text-gray-700 bg-gray-50/50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl py-3 px-4 transition-all duration-200 outline-none focus:ring-4 focus:ring-blue-500/10 placeholder-gray-400 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="meeting-date"
                    className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5"
                  >
                    <Calendar className="w-4 h-4 text-blue-500" />
                    Meeting Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="meeting-date"
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="block w-full sm:w-56 text-sm text-gray-700 bg-gray-50/50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl py-3 px-4 transition-all duration-200 outline-none focus:ring-4 focus:ring-blue-500/10 font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 text-xs text-gray-400 leading-relaxed flex items-start gap-1.5">
                  <AlertCircle className="w-4.5 h-4.5 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    Meeting date is required for compiling summaries. Accepted
                    audio formats include <strong>WAV</strong>,{" "}
                    <strong>MP3</strong>, and <strong>M4A</strong>.
                  </span>
                </div>
              </div>

              {/* Right Column: Audio Drag & Drop Area */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <FileAudio className="w-4 h-4 text-blue-500" />
                  Choose Meeting Audio
                </label>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 text-center select-none min-h-[190px] ${
                    isDragging
                      ? "border-blue-500 bg-blue-50/60 shadow-inner scale-[0.99]"
                      : file
                        ? "border-emerald-200 bg-emerald-50/10 hover:bg-emerald-50/20"
                        : "border-gray-200 bg-gray-50/30 hover:border-blue-400 hover:bg-blue-50/10"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {file ? (
                    <div className="flex flex-col items-center animate-fade-in">
                      <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-3 shadow-sm">
                        <FileAudio className="w-7 h-7" />
                      </div>
                      <p className="text-sm font-bold text-gray-800 max-w-[240px] truncate mb-1">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 font-medium mb-3">
                        {formatFileSize(file.size)} •{" "}
                        {file.type || "Audio File"}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold bg-red-50 hover:bg-red-100/85 px-3 py-1.5 rounded-lg transition-colors duration-150"
                      >
                        <X className="w-3.5 h-3.5" />
                        Remove File
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                        <UploadCloud className="w-7 h-7" />
                      </div>
                      <p className="text-sm font-bold text-gray-700 mb-1">
                        Drag and drop your audio file here
                      </p>
                      <p className="text-xs text-gray-400 font-medium mb-3">
                        or click to browse local files
                      </p>
                      <span className="text-[11px] text-gray-400 bg-gray-100/80 border border-gray-200/50 rounded-full px-3 py-1 font-semibold">
                        WAV, MP3, M4A
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions inside Card */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-start order-2 sm:order-1">
                <button
                  onClick={handleUpload}
                  disabled={isUploading || !file}
                  className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                    isUploading || !file
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-gray-200"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/10 hover:shadow-blue-500/25 hover:-translate-y-0.5 active:translate-y-0"
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Uploading ({uploadProgress}%)</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload & Transcribe</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleReset}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 hover:text-gray-800 transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Reset
                </button>
              </div>

              <div className="text-sm font-semibold text-gray-500 flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto justify-center sm:justify-start">
                {file ? (
                  <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready to transcribe
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs font-medium">
                    No file selected
                  </span>
                )}
              </div>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="mt-6 w-full animate-pulse">
                <div className="flex justify-between text-xs text-gray-500 mb-2 font-bold">
                  <span>Sending audio package to server...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Grid of Results: Transcript & MoM */}
          <div className="grid md:grid-cols-2 gap-8 fade-in-up stagger-2">
            {/* Transcript Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 flex flex-col min-h-[440px] transition-all duration-300 hover:shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-3">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Meeting Transcript
                </h3>
                {transcript && (
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Generated
                  </span>
                )}
              </div>

              <div className="flex-grow flex flex-col justify-between">
                {transcript ? (
                  <>
                    <div className="text-gray-700 whitespace-pre-wrap max-h-[280px] overflow-y-auto border border-gray-100 p-4 rounded-xl bg-gray-50/50 text-sm leading-relaxed mb-4 scrollbar-thin">
                      {transcript}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleDownloadTranscript}
                        className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(transcript);
                          toast.success("Transcript copied to clipboard.");
                        }}
                        className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                      <button
                        onClick={handleGenerateSummary}
                        disabled={isSummarizing}
                        className={`ml-auto px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSummarizing ? "opacity-70 cursor-not-allowed" : ""
                        }`}
                      >
                        {isSummarizing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Generate Minutes (MoM)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mb-3 text-gray-400">
                      <FileText className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-gray-700 mb-1">
                      No Transcript Yet
                    </h4>
                    <p className="text-xs text-gray-400 max-w-[240px] leading-relaxed">
                      Provide meeting details, upload a recorded meeting audio
                      file, and run transcription to begin.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* AI Minutes Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 flex flex-col min-h-[440px] transition-all duration-300 hover:shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-3">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                  AI Minutes of Meeting (MoM)
                </h3>
                {summary && (
                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Compiled
                  </span>
                )}
              </div>

              <div className="flex-grow flex flex-col justify-between">
                {isSummarizing ? (
                  <div className="flex-grow flex flex-col items-center justify-center py-10 text-center animate-pulse">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-500">
                        <Sparkles
                          className="w-8 h-8 animate-spin"
                          style={{ animationDuration: "3s" }}
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white border-2 border-white shadow">
                        <Loader2 className="w-3 h-3 animate-spin" />
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-indigo-800 mb-1.5">
                      Analyzing Meeting Details
                    </h4>
                    <p className="text-xs text-indigo-500 max-w-[280px] leading-relaxed mb-4">
                      Gemini is parsing the transcript, organizing action
                      points, and structuring details. This may take up to a
                      minute...
                    </p>
                    {/* Visual Skeleton Bars */}
                    <div className="w-full max-w-[240px] space-y-2 mt-2">
                      <div className="h-2 bg-gray-100 rounded-full w-full"></div>
                      <div className="h-2 bg-gray-100 rounded-full w-5/6"></div>
                      <div className="h-2 bg-gray-100 rounded-full w-4/5"></div>
                      <div className="h-2 bg-gray-100 rounded-full w-2/3"></div>
                    </div>
                  </div>
                ) : summary ? (
                  <>
                    <div className="text-gray-700 whitespace-pre-wrap max-h-[280px] overflow-y-auto border border-gray-100 p-4 rounded-xl bg-gray-50/50 text-sm leading-relaxed mb-4 scrollbar-thin">
                      {summary}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(summary);
                          toast.success("Minutes copied to clipboard.");
                        }}
                        className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>

                      <div className="relative">
                        <button
                          onClick={() => setShowExportMenu(!showExportMenu)}
                          disabled={isExporting}
                          className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isExporting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          {isExporting ? "Exporting..." : "Export MoM"}
                        </button>
                        {showExportMenu && (
                          <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                            <button
                              onClick={() => handleExport("pdf")}
                              className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors font-medium border-b border-gray-50"
                            >
                              Export as PDF
                            </button>
                            <button
                              onClick={() => handleExport("docx")}
                              className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors font-medium border-b border-gray-50"
                            >
                              Export as DOCX
                            </button>
                            <button
                              onClick={() => handleExport("md")}
                              className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                            >
                              Export as Markdown
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() =>
                          toast.info(
                            "Meeting saved (already saved during summarization).",
                          )
                        }
                        className="ml-auto px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Saved
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mb-3 text-gray-400">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h4 className="text-sm font-bold text-gray-700 mb-1">
                      AI Minutes Awaiting
                    </h4>
                    <p className="text-xs text-gray-400 max-w-[240px] leading-relaxed">
                      Once your meeting is uploaded and transcribed, run the MoM
                      generator to automatically structure minutes.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="text-center mt-10 text-xs text-gray-400 flex items-center justify-center gap-1.5 fade-in-up stagger-3">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>
              💡 For best results, ensure clear, noise-free recording quality.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadMeeting;
