import { Calendar, Loader2, Send } from "lucide-react";
import MeetingInformationForm from "./MeetingInformationForm";
import ParticipantsSection from "./ParticipantsSection";
import AgendaSection from "./AgendaSection";
import AttachmentSection from "./AttachmentSection";
import CalendarNotice from "./CalendarNotice";

const ScheduleMeeting = ({ hookProps }) => {
  const {
    scheduleData,
    setScheduleData,
    participants,
    newParticipant,
    setNewParticipant,
    agendaItems,
    newAgenda,
    setNewAgenda,
    attachments,
    loading,
    handleScheduleChange,
    addParticipant,
    removeParticipant,
    addAgendaItem,
    removeAgendaItem,
    handleAttachmentUpload,
    removeAttachment,
    handleScheduleSubmit,
  } = hookProps;

  return (
    <div className="bg-white shadow-lg rounded-2xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="text-blue-600" size={28} />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Schedule Meeting</h2>
          <p className="text-sm text-gray-600">
            Create and manage meeting schedules with automatic calendar
            integration
          </p>
        </div>
      </div>

      <form onSubmit={handleScheduleSubmit}>
        <MeetingInformationForm
          scheduleData={scheduleData}
          setScheduleData={setScheduleData}
          handleScheduleChange={handleScheduleChange}
        />

        <ParticipantsSection
          participants={participants}
          newParticipant={newParticipant}
          setNewParticipant={setNewParticipant}
          addParticipant={addParticipant}
          removeParticipant={removeParticipant}
        />

        <AgendaSection
          agendaItems={agendaItems}
          newAgenda={newAgenda}
          setNewAgenda={setNewAgenda}
          addAgendaItem={addAgendaItem}
          removeAgendaItem={removeAgendaItem}
        />

        <AttachmentSection
          attachments={attachments}
          handleAttachmentUpload={handleAttachmentUpload}
          removeAttachment={removeAttachment}
        />

        <CalendarNotice />

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
  );
};

export default ScheduleMeeting;
