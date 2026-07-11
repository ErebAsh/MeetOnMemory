import { Calendar, Video, Presentation } from "lucide-react";

const MeetingTabs = ({ activeSection, setActiveSection }) => {
  return (
    <div className="flex flex-wrap gap-3 mb-8 justify-center">
      <button
        type="button"
        onClick={() => setActiveSection("schedule")}
        className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 cursor-pointer ${
          activeSection === "schedule"
            ? "bg-blue-600 text-white shadow-lg"
            : "bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-gray-800"
        }`}
      >
        <Calendar size={20} /> Schedule Meeting
      </button>
      <button
        type="button"
        onClick={() => setActiveSection("live")}
        className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 cursor-pointer ${
          activeSection === "live"
            ? "bg-indigo-600 text-white shadow-lg"
            : "bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-gray-800"
        }`}
      >
        <Video size={20} /> Live Meeting
      </button>
      <button
        type="button"
        onClick={() => setActiveSection("session")}
        className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 cursor-pointer ${
          activeSection === "session"
            ? "bg-purple-600 text-white shadow-lg"
            : "bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-gray-800"
        }`}
      >
        <Presentation size={20} /> Session Cards
      </button>
    </div>
  );
};

export default MeetingTabs;
