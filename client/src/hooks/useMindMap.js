import { useState, useEffect, useCallback, useRef } from "react";
import * as ClerkReact from "@clerk/clerk-react";
import { io } from "socket.io-client";
import mindMapApi from "../services/mindMapApi";

export const useMindMap = (meetingId) => {
  let useAuth;
  try {
    useAuth = ClerkReact.useAuth;
  } catch {
    useAuth = null;
  }
  if (typeof useAuth !== "function") {
    useAuth = () => ({ getToken: async () => "" });
  }
  const { getToken = async () => "" } = useAuth() || {};
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  // Load initial data via REST API
  const fetchMindMap = useCallback(async () => {
    try {
      setLoading(true);
      const res = await mindMapApi.getMindMap(meetingId);
      if (res.success && res.data) {
        setNodes(res.data.nodes || []);
        setConnections(res.data.connections || []);
      }
    } catch (err) {
      console.error("Failed to load mind map data:", err);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchMindMap();
  }, [fetchMindMap]);

  // Connect WebSockets for live collaboration
  useEffect(() => {
    if (!meetingId) return;
    let isActive = true;

    const setupSocket = async () => {
      const token = await getToken();
      if (!isActive || !token) return;

      const socket = io(
        import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL,
        {
          auth: { token },
          transports: ["websocket"],
        },
      );
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("mindmap:join", { meetingId });
      });

      socket.on("mindmap:init", (data) => {
        if (data) {
          setNodes(data.nodes || []);
          setConnections(data.connections || []);
        }
      });

      socket.on("mindmap:changed", (data) => {
        if (data) {
          setNodes(data.nodes || []);
          setConnections(data.connections || []);
        }
      });

      socket.on("mindmap:node-moved", ({ nodeId, x, y }) => {
        setNodes((prevNodes) =>
          prevNodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
        );
      });
    };

    setupSocket();

    return () => {
      isActive = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [meetingId, getToken]);

  const addNode = async (text, x, y) => {
    const newNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: text || "New Idea",
      x: x || 150,
      y: y || 150,
      color: "#4f46e5",
      isActionItem: false,
      actionItemId: null,
    };

    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);

    // Save and broadcast
    if (socketRef.current) {
      socketRef.current.emit("mindmap:update-all", {
        meetingId,
        nodes: updatedNodes,
        connections,
      });
    }
  };

  const updateNodeText = async (nodeId, text) => {
    const updatedNodes = nodes.map((n) =>
      n.id === nodeId ? { ...n, text } : n,
    );
    setNodes(updatedNodes);

    if (socketRef.current) {
      socketRef.current.emit("mindmap:update-all", {
        meetingId,
        nodes: updatedNodes,
        connections,
      });
    }
  };

  const updateNodeColor = async (nodeId, color) => {
    const updatedNodes = nodes.map((n) =>
      n.id === nodeId ? { ...n, color } : n,
    );
    setNodes(updatedNodes);

    if (socketRef.current) {
      socketRef.current.emit("mindmap:update-all", {
        meetingId,
        nodes: updatedNodes,
        connections,
      });
    }
  };

  const updateNodePosition = (nodeId, x, y) => {
    // Optimistic UI drag update
    setNodes((prevNodes) =>
      prevNodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
    );

    // Emit live dragging event to other users (under 100ms sync rate!)
    if (socketRef.current) {
      socketRef.current.emit("mindmap:node-drag", { meetingId, nodeId, x, y });
    }
  };

  const persistNodePosition = async (nodeId, x, y) => {
    const updatedNodes = nodes.map((n) =>
      n.id === nodeId ? { ...n, x, y } : n,
    );

    if (socketRef.current) {
      socketRef.current.emit("mindmap:update-all", {
        meetingId,
        nodes: updatedNodes,
        connections,
      });
    }
  };

  const connectNodes = async (sourceId, targetId) => {
    // Check if duplicate connection exists
    const exists = connections.some(
      (c) =>
        (c.source === sourceId && c.target === targetId) ||
        (c.source === targetId && c.target === sourceId),
    );
    if (exists || sourceId === targetId) return;

    const newConnection = {
      id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source: sourceId,
      target: targetId,
    };

    const updatedConnections = [...connections, newConnection];
    setConnections(updatedConnections);

    if (socketRef.current) {
      socketRef.current.emit("mindmap:update-all", {
        meetingId,
        nodes,
        connections: updatedConnections,
      });
    }
  };

  const deleteNode = async (nodeId) => {
    const updatedNodes = nodes.filter((n) => n.id !== nodeId);
    const updatedConnections = connections.filter(
      (c) => c.source !== nodeId && c.target !== nodeId,
    );

    setNodes(updatedNodes);
    setConnections(updatedConnections);

    if (socketRef.current) {
      socketRef.current.emit("mindmap:update-all", {
        meetingId,
        nodes: updatedNodes,
        connections: updatedConnections,
      });
    }
  };

  const convertNodeToActionItem = async (nodeId, options) => {
    try {
      const res = await mindMapApi.convertNodeToActionItem(meetingId, {
        nodeId,
        ...options,
      });

      if (res.success && res.data) {
        const { node: updatedNode } = res.data;
        const updatedNodes = nodes.map((n) =>
          n.id === nodeId ? { ...n, ...updatedNode } : n,
        );
        setNodes(updatedNodes);

        if (socketRef.current) {
          socketRef.current.emit("mindmap:update-all", {
            meetingId,
            nodes: updatedNodes,
            connections,
          });
        }
        return res.data.actionItem;
      }
    } catch (err) {
      console.error("Failed to convert node to action item:", err);
      throw err;
    }
  };

  return {
    nodes,
    connections,
    loading,
    addNode,
    updateNodeText,
    updateNodeColor,
    updateNodePosition,
    persistNodePosition,
    connectNodes,
    deleteNode,
    convertNodeToActionItem,
  };
};
