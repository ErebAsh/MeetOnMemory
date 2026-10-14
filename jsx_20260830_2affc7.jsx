// Add this import at top
import { BarChart3 } from "lucide-react";

// Add this button in the header section of MeetingDetails
<div className="flex flex-wrap gap-2">
  {/* Existing buttons */}

  {/* Analytics Button - Navigate to analytics page */}
  <button
    onClick={() => navigate(`/meetings/${id}/analytics`)}
    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
  >
    <BarChart3 className="w-4 h-4" />
    Analytics
  </button>

  {/* Other existing buttons */}
</div>;
