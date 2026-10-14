import apiClient from "./apiClient";

/**
 * Client API service for AI, Hybrid, Federated, and Voice Search (#2010)
 */
export const searchApi = {
  /**
   * Voice-powered semantic search
   */
  voiceSearch: async (query, config = {}) => {
    const response = await apiClient.get("/api/search/voice", {
      ...config,
      params: { ...config.params, query: query.trim() },
    });
    return response.data;
  },

  /**
   * Federated knowledge search across workspaces
   */
  federatedSearch: async (payload, config) => {
    const response = await (config
      ? apiClient.post("/api/search/federated", payload, config)
      : apiClient.post("/api/search/federated", payload));
    return response.data;
  },

  /**
   * Hybrid vector + graph search
   */
  hybridSearch: async (payload, config) => {
    const response = await (config
      ? apiClient.post("/api/search/hybrid", payload, config)
      : apiClient.post("/api/search/hybrid", payload));
    return response.data;
  },

  /**
   * Semantic vector search
   */
  semanticSearch: async (payload, config) => {
    const response = await (config
      ? apiClient.post("/api/search", payload, config)
      : apiClient.post("/api/search", payload));
    return response.data;
  },
};

export default searchApi;
