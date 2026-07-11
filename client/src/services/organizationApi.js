import apiClient from "./apiClient";

export const organizationApi = {
  createOrJoinOrganization: (data) =>
    apiClient.post("/api/organizations/create-or-join", data),
  getAllOrganizations: () => apiClient.get("/api/organizations"),
  joinOrganization: (data) => apiClient.post("/api/organizations/join", data),
  getMembers: () => apiClient.get("/api/organizations/members"),
  getUserOrganizations: () => apiClient.get("/api/organizations/user"),
  selectOrganization: (data) => apiClient.post("/api/organizations/select", data),
};
