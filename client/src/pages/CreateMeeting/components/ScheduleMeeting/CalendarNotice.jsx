import { CheckCircle } from "lucide-react";

const CalendarNotice = () => {
  return (
    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
      <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
      <div className="text-sm text-gray-700">
        <strong>Auto Calendar Sync:</strong> This meeting will be automatically
        added to Google Calendar, Outlook, and participant calendars with email
        invites.
      </div>
    </div>
  );
};

export default CalendarNotice;
