import React, { useState, useEffect } from "react";
import {
  Calendar,
  Loader2,
  Send,
  FileText,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { meetingApi, agendaRolloverApi } from "../../../../services";
import { toast } from "react-toastify";
import MeetingInformationForm from "./MeetingInformationForm";
import ParticipantsSection from "./ParticipantsSection";
import AgendaSection from "./AgendaSection";
import AttachmentSection from "./AttachmentSection";
import CalendarNotice from "./CalendarNotice";
import DraftRecoveryBanner from "./DraftRecoveryBanner";
import SmartAgendaGenerator from "../../../../components/meetings/SmartAgendaGenerator";
import CustomFieldsEditor from "../../../../components/meetings/CustomFieldsEditor";
import ConflictWarning from "./ConflictWarning";
import { useIcebreakers } from "../../../../hooks/useIcebreakers";
import IcebreakerWidget from "../../../../components/meetings/IcebreakerWidget";
import PhysicalResourcesSection from "./PhysicalResourcesSection";

const ScheduleMeeting = ({ hookProps, loadingDuplicate = false }) => {
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
    templates,
    selectedTemplateId,
    handleTemplateSelect,
    handleScheduleChange,
    addParticipant,
    removeParticipant,
    addAgendaItem,
    removeAgendaItem,
    reorderAgendaItem,
    handleAttachmentUpload,
    removeAttachment,
    handleScheduleSubmit,
    recoverableDraft,
    lastSavedAt,
    draftStatus,
    restoreDraft,
    discardDraft,
    aiSummaryTemplates,
    selectedAiSummaryTemplateId,
    setSelectedAiSummaryTemplateId,
    setAgendaItems,
    customFields,
    setCustomFields,
    userData,
    focusConflicts,
    busyParticipants,
    checkingConflicts,
    conflictCheckError,
    conflictMode,
    setConflictMode,
    selectedResources,
    setSelectedResources,
  } = hookProps;

  const [meetingsList, setMeetingsList] = useState([]);
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [previewItems, setPreviewItems] = useState([]);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState(new Set());
  const [loadingRollover, setLoadingRollover] = useState(false);

  useEffect(() => {
    let cancelled = false;
    meetingApi
      .getAllMeetings()
      .then((res) => {
        if (!cancelled && res.data?.success) {
          const list = res.data.meetings || res.data.data?.meetings || [];
          setMeetingsList(list);
        }
      })
      .catch((err) => console.error("Failed to load meetings:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSourceMeetingChange = async (e) => {
    const sourceId = e.target.value;
    setSelectedSourceId(sourceId);
    if (!sourceId) {
      setPreviewItems([]);
      setSelectedPreviewIds(new Set());
      return;
    }

    try {
      setLoadingRollover(true);
      const res = await agendaRolloverApi.previewRollover(sourceId);
      if (res.success && res.data?.agendaItems) {
        const items = res.data.agendaItems;
        setPreviewItems(items);
        setSelectedPreviewIds(
          new Set(items.map((item) => item.sourceAgendaItemId)),
        );
      } else {
        setPreviewItems([]);
        setSelectedPreviewIds(new Set());
      }
    } catch (err) {
      toast.error("Failed to load agenda preview");
      console.error(err);
    } finally {
      setLoadingRollover(false);
    }
  };

  const applyRolledOverAgenda = () => {
    const selectedItems = previewItems.filter((item) =>
      selectedPreviewIds.has(item.sourceAgendaItemId),
    );

    if (selectedItems.length === 0) {
      toast.warn("No items selected to rollover");
      return;
    }

    const formatted = selectedItems.map((item, index) => ({
      id: `agenda-roll-${Date.now()}-${index}`,
      text: item.text,
      description: item.description || "",
      duration: item.duration || 0,
      position: index,
      rolledOver: true,
      status: "pending",
    }));

    setAgendaItems(formatted);
    toast.success(
      `Successfully rolled over ${formatted.length} unfinished items!`,
    );
    setRolloverEnabled(false);
    setSelectedSourceId("");
    setPreviewItems([]);
  };

  const toggleSelectPreviewItem = (id) => {
    const next = new Set(selectedPreviewIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPreviewIds(next);
  };

  const {
    icebreakers,
    loading: icebreakersLoading,
    selectedIcebreaker,
    generate,
    select,
  } = useIcebreakers(null); // null meetingId for Create mode

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-lg rounded-2xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="text-blue-600 dark:text-blue-400" size={28} />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Schedule Meeting
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Create and manage meeting schedules with automatic calendar
            integration
          </p>
        </div>
      </div>

      {loadingDuplicate && (
        <div
          className="mb-6 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-800 dark:text-blue-300"
          role="status"
        >
          Loading reusable meeting details...
        </div>
      )}

      <form onSubmit={handleScheduleSubmit}>
        <DraftRecoveryBanner
          savedAt={recoverableDraft?.savedAt}
          lastSavedAt={lastSavedAt}
          status={draftStatus}
          onRestore={restoreDraft}
          onDiscard={discardDraft}
        />
        <ConflictWarning
          focusConflicts={focusConflicts}
          busyParticipants={busyParticipants}
          loading={checkingConflicts}
          mode={conflictMode}
          onModeChange={setConflictMode}
          enabled={Boolean(scheduleData.date && scheduleData.time)}
        />
        {conflictCheckError && (
          <p
            className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
            role="status"
          >
            {conflictCheckError}
          </p>
        )}

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

        <PhysicalResourcesSection
          scheduleData={scheduleData}
          userData={userData}
          selectedResources={selectedResources}
          setSelectedResources={setSelectedResources}
        />

        {templates && templates.length > 0 && (
          <div className="mb-6 bg-blue-50/50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
            <label className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
              <FileText size={16} /> Load Meeting Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={handleTemplateSelect}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm text-gray-700 dark:text-gray-200"
            >
              <option value="">
                -- Select a template to populate agenda --
              </option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.title} ({t.agendaBlocks?.length || 0} items)
                </option>
              ))}
            </select>
          </div>
        )}

        {aiSummaryTemplates && aiSummaryTemplates.length > 0 && (
          <div className="mb-6 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
            <label className="flex items-center gap-2 text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-2">
              <FileText size={16} /> AI Summary Instructions
            </label>
            <select
              value={selectedAiSummaryTemplateId || ""}
              onChange={(e) => setSelectedAiSummaryTemplateId(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none text-sm text-gray-700 dark:text-gray-200"
            >
              <option value="">-- Standard Summary Format --</option>
              {aiSummaryTemplates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} {t.isDefault ? "(Default)" : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-2">
              Custom instructions allow you to dictate exactly how the AI will
              write the MoM (e.g. Sales BANT, Sprint Retro).
            </p>
          </div>
        )}

        <CustomFieldsEditor
          orgId={userData?.organization}
          onChange={(fields, isValid) => setCustomFields({ fields, isValid })}
        />

        <SmartAgendaGenerator
          organizationId={userData?.organization?._id || userData?.organization}
          meetingId={null}
          currentAgenda={agendaItems}
          onApplySuccess={setAgendaItems}
        />

        <div className="mb-6 bg-cyan-50/50 dark:bg-cyan-950/30 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/50">
          <div className="flex justify-between items-center mb-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-cyan-900 dark:text-cyan-300">
              🧊 Team Icebreaker
            </label>
            <button
              type="button"
              onClick={() => {
                const pIds = participants.map((p) => p._id || p.id || p.value);
                generate(pIds);
              }}
              disabled={icebreakersLoading}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
            >
              {icebreakersLoading ? "Generating..." : "Generate Icebreaker"}
            </button>
          </div>
          <p className="text-xs text-cyan-700 dark:text-cyan-400 mb-3">
            Start the meeting on a high note by generating context-aware
            icebreakers based on the participants.
          </p>
          <IcebreakerWidget
            icebreakers={icebreakers}
            loading={icebreakersLoading}
            onSelect={select}
            selectedIcebreaker={selectedIcebreaker}
          />
        </div>

        {/* Agenda Rollover Panel */}
        <div className="mb-6 p-6 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rolloverEnabled}
              onChange={(e) => {
                setRolloverEnabled(e.target.checked);
                if (!e.target.checked) {
                  setSelectedSourceId("");
                  setPreviewItems([]);
                }
              }}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-500" />
              Rollover Unfinished Agenda Items from Previous Meeting
            </span>
          </label>

          {rolloverEnabled && (
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="rollover-source-meeting-select"
                  className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5"
                >
                  Select Previous Meeting
                </label>
                <select
                  id="rollover-source-meeting-select"
                  aria-label="Select Previous Meeting"
                  value={selectedSourceId}
                  onChange={handleSourceMeetingChange}
                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-750 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm text-gray-700 dark:text-gray-200"
                >
                  <option value="">-- Choose a meeting --</option>
                  {meetingsList.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.title} ({new Date(m.date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              {loadingRollover && (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing past pacing and loading unfinished topics...
                </div>
              )}

              {!loadingRollover && previewItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                      Proposed Rolled Over Topics
                    </h4>
                    <span className="text-xs text-slate-500">
                      {selectedPreviewIds.size} of {previewItems.length}{" "}
                      selected
                    </span>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-850 rounded-xl divide-y divide-slate-250 dark:divide-slate-850 bg-white dark:bg-slate-900 overflow-hidden">
                    {previewItems.map((item) => {
                      const isSelected = selectedPreviewIds.has(
                        item.sourceAgendaItemId,
                      );
                      return (
                        <div
                          key={item.sourceAgendaItemId}
                          className="flex items-start gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              toggleSelectPreviewItem(item.sourceAgendaItemId)
                            }
                            className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                {item.text}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-wider">
                                Unfinished
                              </span>
                              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-wider">
                                Rolled Over
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-slate-500 truncate mt-1">
                                {item.description}
                              </p>
                            )}
                            {item.pacing && (
                              <div className="mt-2 text-[11px] text-indigo-500 dark:text-indigo-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Pacing recommendation:{" "}
                                {item.pacing.recommendation} min (based on{" "}
                                {item.pacing.count} past runs)
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-slate-500 font-bold block">
                              Duration: {item.duration} min
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={applyRolledOverAgenda}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer"
                  >
                    Apply Selected Topics to Agenda
                  </button>
                </div>
              )}

              {!loadingRollover &&
                selectedSourceId &&
                previewItems.length === 0 && (
                  <div className="text-sm text-slate-500 text-center py-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                    No unfinished topics found in the selected meeting.
                  </div>
                )}
            </div>
          )}
        </div>

        <AgendaSection
          agendaItems={agendaItems}
          setAgendaItems={setAgendaItems}
          newAgenda={newAgenda}
          setNewAgenda={setNewAgenda}
          addAgendaItem={addAgendaItem}
          removeAgendaItem={removeAgendaItem}
          reorderAgendaItem={reorderAgendaItem}
        />

        <AttachmentSection
          attachments={attachments}
          handleAttachmentUpload={handleAttachmentUpload}
          removeAttachment={removeAttachment}
        />
        {/* Meeting Reminder */}
        <div className="mb-6 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="text-blue-600 dark:text-blue-400" size={18} />

            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">
              Meeting Reminder
            </h3>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleData.reminderEnabled || false}
              onChange={(e) =>
                setScheduleData((prev) => ({
                  ...prev,
                  reminderEnabled: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-blue-600 focus:ring-blue-500"
            />

            <span className="text-sm text-gray-700 dark:text-gray-300">
              Send me a notification before this meeting starts
            </span>
          </label>

          {scheduleData.reminderEnabled && (
            <div className="mt-4">
              <label
                htmlFor="reminderMinutesBefore"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Remind me
              </label>

              <select
                id="reminderMinutesBefore"
                value={scheduleData.reminderMinutesBefore || 30}
                onChange={(e) =>
                  setScheduleData((prev) => ({
                    ...prev,
                    reminderMinutesBefore: Number(e.target.value),
                  }))
                }
                className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm text-gray-700 dark:text-gray-200"
              >
                <option value={10}>10 minutes before</option>
                <option value={30}>30 minutes before</option>
                <option value={60}>1 hour before</option>
              </select>

              <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                You will receive an in-app notification and email reminder.
              </p>
            </div>
          )}
        </div>

        <CalendarNotice />

        {/* Submit */}
        <button
          type="submit"
          disabled={
            loading ||
            loadingDuplicate ||
            (customFields && !customFields.isValid)
          }
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
