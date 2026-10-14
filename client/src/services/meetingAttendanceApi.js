import apiClient from "./apiClient";

export const getMeetingAttendance = (meetingId) => {
  return apiClient.get(`/api/meetings/${meetingId}/attendance`);
};

export const checkIn = (meetingId, email, joinTime) => {
  return apiClient.post(`/api/meetings/${meetingId}/attendance/checkin`, {
    email,
    joinTime,
  });
};

export const checkOut = (meetingId, email, leaveTime) => {
  return apiClient.post(`/api/meetings/${meetingId}/attendance/checkout`, {
    email,
    leaveTime,
  });
};

export const markExcused = (meetingId, email) => {
  return apiClient.put(`/api/meetings/${meetingId}/attendance/excuse`, {
    email,
  });
};

export const finalizeAttendance = (meetingId) => {
  return apiClient.post(`/api/meetings/${meetingId}/attendance/finalize`);
};
