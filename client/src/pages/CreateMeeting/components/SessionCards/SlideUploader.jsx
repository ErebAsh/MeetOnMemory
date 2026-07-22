import { FileText, X } from "lucide-react";

const SlideUploader = ({ slideFiles, handleSlideUpload, removeSlideFile }) => {
  return (
    <div className="mb-6">
      <label className="block mb-2 font-semibold text-gray-700 flex items-center gap-2">
        <FileText size={18} /> Upload Presentation Slides (PDF/PPT) *
      </label>
      <input
        type="file"
        multiple
        accept=".pdf,.ppt,.pptx"
        onChange={handleSlideUpload}
        className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400"
      />
      {slideFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {slideFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg"
            >
              <span className="text-sm flex items-center gap-2">
                <FileText size={16} className="text-purple-600" />
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => removeSlideFile(index)}
                className="text-red-600 hover:text-red-800"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-gray-500">
        AI will extract text from slides and generate summary with keywords
      </p>
    </div>
  );
};

export default SlideUploader;
