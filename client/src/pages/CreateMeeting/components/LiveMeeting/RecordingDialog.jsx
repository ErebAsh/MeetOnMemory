import { Video, CheckCircle } from "lucide-react";

const RecordingDialog = ({ handleRecordingChoice }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <Video className="text-indigo-600" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Recording Permission
            </h3>
            <p className="text-sm text-gray-600">Choose recording option</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            Do you want to record this meeting for AI transcription and
            summarization?
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-700">
            <strong>With Recording:</strong> AI will transcribe the meeting in
            real-time and generate a summary with action items after the meeting
            ends.
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleRecordingChoice(false)}
            className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            No, Skip Recording
          </button>
          <button
            onClick={() => handleRecordingChoice(true)}
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
          >
            <CheckCircle size={18} />
            Yes, Record
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingDialog;
