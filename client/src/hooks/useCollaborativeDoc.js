// Custom React hook — manages Yjs CRDT document sync over Socket.io /sync namespace

import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import * as Y from "yjs";

/**
 * Connects to the /sync Socket.io namespace and manages a shared Yjs Y.Text document.
 * @param {string} meetingId  - The meeting's MongoDB _id used as the document room key
 * @param {string} backendUrl - Backend base URL (e.g. http://localhost:4000)
 * @returns {{
 *   content: string,           — current plain-text content
 *   setContent: Function,      — write new text (broadcasts CRDT update)
 *   connectedUsers: number,    — number of active collaborators
 *   isSynced: boolean,         — true once initial state received from server
 *   isConnected: boolean,      — socket connection status
 * }}
 */
const useCollaborativeDoc = (meetingId, backendUrl) => {
  const [content, setContentState] = useState("");
  const [connectedUsers, setConnectedUsers] = useState(1);
  const [isSynced, setIsSynced] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Refs so callbacks always use latest values without re-creating effects
  const socketRef = useRef(null);
  const ydocRef = useRef(null);
  const ytextRef = useRef(null);
  const isRemoteUpdateRef = useRef(false); // prevent echo loops

  useEffect(() => {
    if (!meetingId || !backendUrl) return;

    // 1. Create local Yjs doc
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("notes");
    ydocRef.current = ydoc;
    ytextRef.current = ytext;

    // 2. Connect to /sync namespace
    const socket = io(`${backendUrl}/sync`, {
      transports: ["websocket"],
      withCredentials: true,
    });
    socketRef.current = socket;

    // 3. Socket lifecycle
    socket.on("connect", () => {
      setIsConnected(true);
      // Join the document room for this meeting
      socket.emit("join-document", { meetingId });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      setIsSynced(false);
    });

    // 4. Receive full initial state from server
    socket.on("sync-full", ({ update }) => {
      if (update) {
        isRemoteUpdateRef.current = true;
        try {
          Y.applyUpdate(ydoc, new Uint8Array(update));
        } finally {
          isRemoteUpdateRef.current = false;
        }
      }
      setIsSynced(true);
    });

    // 5. Receive incremental update from other clients
    socket.on("sync-update", ({ update }) => {
      if (update) {
        isRemoteUpdateRef.current = true;
        try {
          Y.applyUpdate(ydoc, new Uint8Array(update));
        } finally {
          isRemoteUpdateRef.current = false;
        }
      }
    });

    // 6. Receive cursor/presence updates
    socket.on("cursor-update", () => {
      // Presence tracking — bump connected user count (simple heuristic)
      // A full implementation would maintain a map of { socketId → user }
      setConnectedUsers((prev) => Math.max(prev, 2));
    });

    // 7. Observe local Yjs changes and broadcast them
    const onUpdate = (update) => {
      // Don't echo remote updates back to server
      if (isRemoteUpdateRef.current) return;

      // Send our local change to server
      socket.emit("sync-update", {
        meetingId,
        update: Array.from(update),
      });

      // Update local React state
      setContentState(ytext.toString());
    };

    ydoc.on("update", onUpdate);

    // Also listen for any change to the ytext specifically (catches remote updates)
    ytext.observe(() => {
      setContentState(ytext.toString());
    });

    return () => {
      ydoc.off("update", onUpdate);
      socket.disconnect();
      ydoc.destroy();
    };
  }, [meetingId, backendUrl]);

  // Setter for external use (e.g. user typing in a textarea)
  const setContent = useCallback((newText) => {
    const ytext = ytextRef.current;
    const ydoc = ydocRef.current;
    if (!ytext || !ydoc) return;

    // Transact: replace full content with new text (simple but effective for textarea)
    ydoc.transact(() => {
      const currentText = ytext.toString();
      if (currentText === newText) return;

      // Delete all and re-insert (Yjs CRDTs handle this safely)
      ytext.delete(0, currentText.length);
      ytext.insert(0, newText);
    });
  }, []);

  return {
    content,
    setContent,
    connectedUsers,
    isSynced,
    isConnected,
  };
};

export default useCollaborativeDoc;
