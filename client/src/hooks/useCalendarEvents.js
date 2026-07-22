import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { meetingApi } from "../services";

export const useCalendarEvents = () => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month"); // 'month' | 'week' | 'day'
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  // Filter States
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");

  // Fetch Meetings
  useEffect(() => {
    const fetchMeetings = async () => {
      setLoading(true);
      try {
        const { data } = await meetingApi.getAllMeetings();
        if (data.success) {
          setMeetings(data.meetings || []);
        } else {
          toast.error(data.message || "Failed to fetch meetings.");
        }
      } catch (err) {
        console.error("Fetch meetings error:", err);
        toast.error("Error loading calendar data.");
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, []);

  // Filter Logic
  const filteredMeetings = meetings.filter((meeting) => {
    const matchesStatus =
      statusFilter === "all" || meeting.status === statusFilter;
    const matchesType =
      typeFilter === "all" || meeting.meetingType === typeFilter;

    // Filter by organization
    let matchesOrg = true;
    if (orgFilter !== "all") {
      if (orgFilter === "personal") {
        matchesOrg = !meeting.organization;
      } else {
        matchesOrg =
          meeting.organization === orgFilter ||
          (meeting.organization?._id &&
            meeting.organization._id === orgFilter) ||
          (meeting.organization?.name &&
            meeting.organization.name === orgFilter);
      }
    }

    return matchesStatus && matchesType && matchesOrg;
  });

  // Extract unique organizations for filters
  const uniqueOrgs = Array.from(
    new Set(
      meetings
        .map((m) => m.organization?.name || m.organization)
        .filter(Boolean),
    ),
  );

  return {
    meetings,
    loading,
    currentDate,
    setCurrentDate,
    view,
    setView,
    selectedMeeting,
    setSelectedMeeting,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    orgFilter,
    setOrgFilter,
    filteredMeetings,
    uniqueOrgs,
  };
};
