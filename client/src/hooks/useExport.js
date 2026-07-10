import { useState, useContext } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import AppContent from "../context/AppContent";

const useExport = () => {
  const { backendUrl } = useContext(AppContent);
  const [isExporting, setIsExporting] = useState(false);

  const exportMeeting = async (meeting, format) => {
    if (isExporting) return; // Prevent duplicate requests
    try {
      setIsExporting(true);

      const response = await axios.get(
        `${backendUrl}/api/meetings/${meeting._id}/export?format=${format}`,
        {
          withCredentials: true,
          responseType: "blob",
          timeout: 60000,
        },
      );

      const blob = new Blob([response.data], {
        type: response.headers["content-type"],
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      let filename = `${meeting.title || "meeting"}_mom.${format}`;
      const disposition = response.headers["content-disposition"];
      if (disposition && disposition.indexOf("filename=") !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, "");
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Error exporting meeting to ${format}:`, err);
      toast.error(`Failed to export meeting to ${format}`);
    } finally {
      setIsExporting(false);
    }
  };

  return { exportMeeting, isExporting };
};

export default useExport;
