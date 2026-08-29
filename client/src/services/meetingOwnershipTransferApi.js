import apiClient from "./apiClient";

export const meetingOwnershipTransferApi = {
  requestTransfer: (meetingId, toUserId) =>
    apiClient.post("/transfers/request", { meetingId, toUserId }),

  acceptTransfer: (transferId) =>
    apiClient.post(`/transfers/${transferId}/accept`),

  rejectTransfer: (transferId) =>
    apiClient.post(`/transfers/${transferId}/reject`),

  getInbox: () => apiClient.get("/transfers/inbox"),

  getOutbox: () => apiClient.get("/transfers/outbox"),
};
