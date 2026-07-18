import { useState, useRef } from "react";
import { toast } from "react-toastify";
import { meetingApi } from "../services";

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

const useMeetingUpload = () => {
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [meetingId, setMeetingId] = useState(null);

  // Expose refs if needed by UI
  const fileInputRef = useRef(null);

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

  const resetUpload = (setSummary, setTitle) => {
    setFile(null);
    setTranscript("");
    if (setSummary) setSummary("");
    setMeetingId(null);
    if (setTitle) setTitle("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async (title, setTitle) => {
    if (!file) {
      toast.error("Please select an audio file first.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setTranscript("");
      setMeetingId(null);

      const formData = new FormData();
      formData.append("file", file);
      if (title) formData.append("title", title);

      const res = await meetingApi.uploadMeeting(formData, {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          setUploadProgress(percent);
        },
      });

      if (res.data?.success) {
        toast.success("Transcription complete!");
        setTranscript(res.data.transcript || "");
        setMeetingId(res.data.meetingId || null);
        if (res.data.autoTitle && setTitle) setTitle(res.data.autoTitle);
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

  return {
    file,
    setFile,
    uploadProgress,
    isUploading,
    isDragging,
    transcript,
    setTranscript,
    meetingId,
    setMeetingId,
    fileInputRef,
    validateAndSetFile,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    resetUpload,
    handleUpload,
    formatFileSize,
  };
};

export default useMeetingUpload;
