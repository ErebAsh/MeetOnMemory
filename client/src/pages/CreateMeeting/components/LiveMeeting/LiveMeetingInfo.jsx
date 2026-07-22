import { Video } from "lucide-react";

const LiveMeetingInfo = () => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-purple-50 p-6 shadow-lg mb-6">
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-indigo-700 flex items-center gap-2 mb-2">
            <Video className="text-indigo-600" size={22} />
            Live AI Meeting Connect
          </h3>
          <p className="text-gray-700 mb-4 leading-relaxed">
            🔴 Experience <strong>real-time video conferencing</strong>{" "}
            integrated with
            <strong> AI-powered transcription and live summarization</strong>.
            Your meeting notes will be generated instantly with smart
            highlights.
          </p>

          <ul className="text-sm text-gray-600 mb-4 space-y-1">
            <li>• Automatic speech-to-text in real-time</li>
            <li>• Live participant tracking & emotion insights</li>
            <li>• AI auto-summary after meeting ends</li>
          </ul>
        </div>

        <div className="flex-shrink-0">
          <img
            src="https://cdn.dribbble.com/users/23546/screenshots/20531077/media/0a5f35125d57a6eb88a6a0a2d3087b45.gif"
            alt="Live meeting animation"
            className="w-56 rounded-xl border border-indigo-100 shadow-md"
          />
        </div>
      </div>
    </div>
  );
};

export default LiveMeetingInfo;
