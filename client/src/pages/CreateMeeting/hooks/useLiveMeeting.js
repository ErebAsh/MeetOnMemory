import { useState } from "react";
import { toast } from "react-toastify";
import { meetingApi } from "../../../services";
import { generateRoomId } from "../utils/utils";

export const useLiveMeeting = () => {
  const [liveParticipants, setLiveParticipants] = useState([]);
  const [newLiveParticipant, setNewLiveParticipant] = useState({
    name: "",
    email: "",
  });
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);

  const addLiveParticipant = () => {
    if (newLiveParticipant.name.trim() && newLiveParticipant.email.trim()) {
      setLiveParticipants([
        ...liveParticipants,
        { ...newLiveParticipant, id: Date.now() },
      ]);
      setNewLiveParticipant({ name: "", email: "" });
      toast.success("Participant added");
    } else {
      toast.error("Please enter both name and email");
    }
  };

  const removeLiveParticipant = (id) => {
    setLiveParticipants(liveParticipants.filter((p) => p.id !== id));
  };

  const handleStartLiveMeeting = () => {
    if (liveParticipants.length === 0) {
      toast.warning("Add at least one participant before starting the meeting");
      return;
    }
    setShowRecordingDialog(true);
  };

  const handleRecordingChoice = async (willRecord) => {
    setShowRecordingDialog(false);

    const recordingStatus = willRecord
      ? "with recording enabled"
      : "without recording";
    toast.success(`🎥 Starting live meeting ${recordingStatus}...`);

    const roomId = generateRoomId();

    // Notify backend to push notifications
    if (liveParticipants.length > 0) {
      meetingApi
        .notifyLive({
          roomId,
          participants: liveParticipants,
        })
        .catch((error) => {
          console.error("Failed to notify participants:", error);
        });
    }

    // Open meeting room window during user gesture
    const queryParams = new URLSearchParams({
      recording: willRecord.toString(),
    }).toString();

    window.open(`/meeting-room/${roomId}?${queryParams}`, "_blank");

    setLiveParticipants([]);
  };

  return {
    liveParticipants,
    newLiveParticipant,
    setNewLiveParticipant,
    showRecordingDialog,
    setShowRecordingDialog,
    addLiveParticipant,
    removeLiveParticipant,
    handleStartLiveMeeting,
    handleRecordingChoice,
  };
};
