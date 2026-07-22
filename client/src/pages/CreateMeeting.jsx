import React, { useState } from "react";
import Navbar from "../components/Navbar.jsx";
import MeetingTabs from "./CreateMeeting/components/MeetingTabs";
import ScheduleMeeting from "./CreateMeeting/components/ScheduleMeeting/ScheduleMeeting";
import LiveMeeting from "./CreateMeeting/components/LiveMeeting/LiveMeeting";
import SessionCards from "./CreateMeeting/components/SessionCards/SessionCards";

import { useScheduleMeeting } from "./CreateMeeting/hooks/useScheduleMeeting";
import { useLiveMeeting } from "./CreateMeeting/hooks/useLiveMeeting";
import { useSessionCards } from "./CreateMeeting/hooks/useSessionCards";

const CreateMeeting = () => {
  const [activeSection, setActiveSection] = useState("live");
  const [loading, setLoading] = useState(false);

  // ========== SECTION 1: SCHEDULE MEETINGS ==========
  const [scheduleData, setScheduleData] = useState({
    title: "",
    description: "",
    meetingType: "conference",
    date: "",
    time: "",
    duration: "",
    location: "",
    venue: "",
    syncToCalendar: true,
  });
  const [participants, setParticipants] = useState([]);
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "" });
  const [agendaItems, setAgendaItems] = useState([]);
  const [newAgenda, setNewAgenda] = useState("");
  const [attachments, setAttachments] = useState([]);

  // ========== SECTION 2: LIVE MEETING ==========
  const [liveParticipants, setLiveParticipants] = useState([]);
  const [newLiveParticipant, setNewLiveParticipant] = useState({
    name: "",
    email: "",
  });
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);

  // ========== SECTION 3: SESSION CARDS (CONFERENCE/SEMINAR) ==========
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

  // ========== HANDLERS: SECTION 1 - SCHEDULE ==========
  const handleScheduleChange = (e) => {
    const { name, value } = e.target;
    setScheduleData((prev) => ({ ...prev, [name]: value }));
  };

  const addParticipant = () => {
    if (newParticipant.name.trim() && newParticipant.email.trim()) {
      setParticipants([...participants, { ...newParticipant, id: Date.now() }]);
      setNewParticipant({ name: "", email: "" });
      toast.success("Participant added");
    } else {
      toast.error("Please enter both name and email");
    }
  };

  const removeParticipant = (id) => {
    setParticipants(participants.filter((p) => p.id !== id));
  };

  const addAgendaItem = () => {
    if (newAgenda.trim()) {
      setAgendaItems([...agendaItems, { text: newAgenda, id: Date.now() }]);
      setNewAgenda("");
      toast.success("Agenda item added");
    }
  };

  const removeAgendaItem = (id) => {
    setAgendaItems(agendaItems.filter((a) => a.id !== id));
  };

  const handleAttachmentUpload = (e) => {
    const files = Array.from(e.target.files);
    setAttachments([...attachments, ...files]);
    toast.success(`${files.length} file(s) attached`);
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduleData.title.trim()) {
      toast.error("Meeting title is required");
      return;
    }

    if (!scheduleData.date || !scheduleData.time) {
      toast.error("Date and time are required");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...scheduleData,
        participants,
        agendaItems,
      };

      const response = await meetingApi.scheduleMeeting(payload);

      if (response.data?.success) {
        toast.success("✅ Meeting scheduled and synced to calendars!");

        // Trigger calendar integration
        if (response.data.calendarLinks) {
          toast.info("📅 Calendar invites sent to all participants!");
        }

        // Reset form
        setScheduleData({
          title: "",
          description: "",
          meetingType: "conference",
          date: "",
          time: "",
          duration: "",
          location: "",
          venue: "",
          syncToCalendar: true,
        });
        setParticipants([]);
        setAgendaItems([]);
        setAttachments([]);
      } else {
        toast.error(response.data?.message || "Failed to schedule meeting");
      }
    } catch (error) {
      console.error("Error scheduling meeting:", error);
      toast.error(
        error.response?.data?.message || "Unable to schedule meeting",
      );
    } finally {
      setLoading(false);
    }
  };

  // ========== HANDLERS: SECTION 2 - LIVE MEETING ==========
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

  const scheduleMeetingHooks = useScheduleMeeting();
  const liveMeetingHooks = useLiveMeeting();
  const sessionCardsHooks = useSessionCards();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-slate-800 dark:text-slate-200">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            📝 Meeting & Event Hub
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Schedule meetings with calendar integration, start live meetings
            with AI transcription, or create session cards for conferences.
          </p>
        </div>

        {/* Section Tabs */}
        <MeetingTabs
          activeSection={activeSection}
          setActiveSection={setActiveSection}
        />

        {/* ========== SECTION 1: SCHEDULE MEETINGS ========== */}
        {activeSection === "schedule" && (
          <div className="bg-white shadow-lg rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="text-blue-600" size={28} />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Schedule Meeting
                </h2>
                <p className="text-sm text-gray-600">
                  Create and manage meeting schedules with automatic calendar
                  integration
                </p>
              </div>
            </div>

            <form onSubmit={handleScheduleSubmit}>
              {/* Meeting Type */}
              <div className="mb-6">
                <label className="block mb-3 font-semibold text-gray-700">
                  Meeting Type
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {["conference", "policy", "event", "internal"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setScheduleData({ ...scheduleData, meetingType: type })
                      }
                      className={`px-4 py-2 rounded-lg border-2 transition capitalize ${
                        scheduleData.meetingType === type
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Description */}
              <div className="mb-6">
                <label className="block mb-2 font-semibold text-gray-700">
                  Meeting Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={scheduleData.title}
                  onChange={handleScheduleChange}
                  placeholder="e.g., Q4 Board Meeting, Policy Review"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block mb-2 font-semibold text-gray-700">
                  Description & Objective
                </label>
                <textarea
                  name="description"
                  value={scheduleData.description}
                  onChange={handleScheduleChange}
                  placeholder="Brief overview and expected outcomes..."
                  rows="3"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                ></textarea>
              </div>

              {/* Date & Time */}
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block mb-2 font-semibold text-gray-700">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={scheduleData.date}
                    onChange={handleScheduleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-gray-700">
                    Time *
                  </label>
                  <input
                    type="time"
                    name="time"
                    value={scheduleData.time}
                    onChange={handleScheduleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-gray-700">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    name="duration"
                    value={scheduleData.duration}
                    onChange={handleScheduleChange}
                    placeholder="60"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block mb-2 font-semibold text-gray-700">
                    Location/Platform
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={scheduleData.location}
                    onChange={handleScheduleChange}
                    placeholder="e.g., Zoom, Conference Room A"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-gray-700">
                    Venue Details
                  </label>
                  <input
                    type="text"
                    name="venue"
                    value={scheduleData.venue}
                    onChange={handleScheduleChange}
                    placeholder="Address or meeting link"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                </div>
              </div>

              {/* Sync to Calendar */}
              <div className="mb-6 flex items-center gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <input
                  type="checkbox"
                  id="syncToCalendar"
                  name="syncToCalendar"
                  checked={scheduleData.syncToCalendar}
                  onChange={(e) =>
                    setScheduleData({
                      ...scheduleData,
                      syncToCalendar: e.target.checked,
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label
                  htmlFor="syncToCalendar"
                  className="text-sm font-medium text-slate-800 cursor-pointer"
                >
                  Sync to my connected calendars (Google/Outlook)
                </label>
              </div>

              {/* Participants */}
              <div className="mb-6">
                <label className="block mb-3 font-semibold text-gray-700 flex items-center gap-2">
                  <Users size={18} /> Invite Participants
                </label>
                <div className="grid md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={newParticipant.name}
                    onChange={(e) =>
                      setNewParticipant({
                        ...newParticipant,
                        name: e.target.value,
                      })
                    }
                    placeholder="Full Name"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                  <input
                    type="email"
                    value={newParticipant.email}
                    onChange={(e) =>
                      setNewParticipant({
                        ...newParticipant,
                        email: e.target.value,
                      })
                    }
                    placeholder="Email Address"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={addParticipant}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <UserPlus size={16} /> Add Participant
                </button>

                {participants.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {participants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg"
                      >
                        <span className="text-sm">
                          <strong>{p.name}</strong> - {p.email}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeParticipant(p.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Agenda */}
              <div className="mb-6">
                <label className="block mb-3 font-semibold text-gray-700">
                  Meeting Agenda
                </label>
                <div className="flex gap-3 mb-3">
                  <input
                    type="text"
                    value={newAgenda}
                    onChange={(e) => setNewAgenda(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addAgendaItem())
                    }
                    placeholder="Add agenda item..."
                    className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={addAgendaItem}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {agendaItems.length > 0 && (
                  <ul className="space-y-2">
                    {agendaItems.map((item, index) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg"
                      >
                        <span className="text-sm">
                          {index + 1}. {item.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAgendaItem(item.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Attachments */}
              <div className="mb-6">
                <label className="block mb-3 font-semibold text-gray-700 flex items-center gap-2">
                  <Paperclip size={18} /> Attach Supporting Documents
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleAttachmentUpload}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400"
                />
                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg"
                      >
                        <span className="text-sm">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Calendar Integration Notice */}
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle
                  className="text-green-600 flex-shrink-0"
                  size={20}
                />
                <div className="text-sm text-gray-700">
                  <strong>Auto Calendar Sync:</strong> This meeting will be
                  automatically added to Google Calendar, Outlook, and
                  participant calendars with email invites.
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Scheduling & Syncing Calendars...
                  </>
                ) : (
                  <>
                    <Send size={18} /> Schedule Meeting & Send Invites
                  </>
                )}
              </button>
            </form>
          </div>
          <ScheduleMeeting hookProps={scheduleMeetingHooks} />
        )}

        {/* ========== SECTION 2: LIVE MEETING ========== */}
        {activeSection === "live" && (
          <LiveMeeting hookProps={liveMeetingHooks} />
        )}

        {/* ========== SECTION 3: SESSION CARDS ========== */}
        {activeSection === "session" && (
          <SessionCards hookProps={sessionCardsHooks} />
        )}
      </div>
    </div>
  );
};

export default CreateMeeting;
