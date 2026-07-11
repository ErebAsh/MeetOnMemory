import apiClient from "./apiClient";

export const analyticsApi = {
  getAnalytics: () => apiClient.get("/api/analytics"),
  askAnalyticsChat: (data) => apiClient.post("/api/gemini/insights", data),
};
