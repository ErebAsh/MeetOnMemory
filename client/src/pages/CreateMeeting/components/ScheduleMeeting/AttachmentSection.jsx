import { Paperclip, X } from "lucide-react";

const AttachmentSection = ({
  attachments,
  handleAttachmentUpload,
  removeAttachment,
}) => {
  return (
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
  );
};

export default AttachmentSection;
