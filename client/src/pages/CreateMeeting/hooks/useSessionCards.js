import { useState } from "react";
import { toast } from "react-toastify";
import { meetingApi } from "../../../services";

export const useSessionCards = () => {
  const [sessionData, setSessionData] = useState({
    eventName: "",
    sessionTitle: "",
    speaker: "",
    speakerBio: "",
    speakerTitle: "",
  });
  const [slideFiles, setSlideFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [generatedSessions, setGeneratedSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSessionChange = (e) => {
    const { name, value } = e.target;
    setSessionData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSlideUpload = (e) => {
    const files = Array.from(e.target.files);
    setSlideFiles([...slideFiles, ...files]);
    toast.success(`${files.length} slide file(s) uploaded`);
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      toast.success(`Video "${file.name}" selected`);
    }
  };

  const removeSlideFile = (index) => {
    setSlideFiles(slideFiles.filter((_, i) => i !== index));
  };

  const handleSessionSubmit = async (e) => {
    e.preventDefault();
    if (!sessionData.sessionTitle.trim() || slideFiles.length === 0) {
      toast.error("Session title and at least one slide file are required");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("eventName", sessionData.eventName);
      formData.append("sessionTitle", sessionData.sessionTitle);
      formData.append("speaker", sessionData.speaker);
      formData.append("speakerBio", sessionData.speakerBio);
      formData.append("speakerTitle", sessionData.speakerTitle);

      slideFiles.forEach((file) => {
        formData.append("slides", file);
      });

      if (videoFile) {
        formData.append("video", videoFile);
      }

      const response = await meetingApi.generateSession(formData);

      if (response.data?.success) {
        toast.success("✨ AI Session card generated successfully!");
        setGeneratedSessions([response.data.session, ...generatedSessions]);

        // Reset form
        setSessionData({
          eventName: "",
          sessionTitle: "",
          speaker: "",
          speakerBio: "",
          speakerTitle: "",
        });
        setSlideFiles([]);
        setVideoFile(null);
      } else {
        toast.error(response.data?.message || "Failed to create session");
      }
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error(error.response?.data?.message || "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  return {
    sessionData,
    slideFiles,
    videoFile,
    generatedSessions,
    loading,
    handleSessionChange,
    handleSlideUpload,
    handleVideoUpload,
    removeSlideFile,
    handleSessionSubmit,
  };
};
