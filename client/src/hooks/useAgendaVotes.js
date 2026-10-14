import { useState, useEffect, useCallback, useRef } from "react";
import {
  getVoteTally,
  castVote,
  removeVote,
  autoSortAgenda,
} from "../api/agendaVoteApi";
import * as ClerkReact from "@clerk/clerk-react";
import { io } from "socket.io-client";

export const useAgendaVotes = (meetingId) => {
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
  const [tally, setTally] = useState({});
  const [userVotes, setUserVotes] = useState({});
  const socketRef = useRef(null);

  const fetchTally = useCallback(async () => {
    try {
      const data = await getVoteTally(meetingId);
      setTally(data.tally || {});
      if (data.userVotes) {
        setUserVotes(data.userVotes);
      }
    } catch (error) {
      console.error("Failed to fetch vote tally:", error);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchTally();
  }, [fetchTally]);

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
        socket.emit("join-meeting", { roomId: meetingId });
      });

      socket.on("agenda:vote:updated", (data) => {
        if (data.meetingId === meetingId) {
          setTally(data.tally);
        }
      });

      socket.on("agenda:updated", (data) => {
        if (data.meetingId === meetingId) {
          window.location.reload(); // Refresh to get sorted agenda
        }
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

  const handleCastVote = async (agendaItemId, vote) => {
    // Optimistic update
    const previousVotes = { ...userVotes };
    setUserVotes((prev) => ({ ...prev, [agendaItemId]: vote }));

    try {
      await castVote(meetingId, agendaItemId, vote);
    } catch (error) {
      console.error("Failed to cast vote:", error);
      // Revert optimistic update
      setUserVotes(previousVotes);
    }
  };

  const handleRemoveVote = async (agendaItemId) => {
    // Optimistic update
    const previousVotes = { ...userVotes };
    setUserVotes((prev) => {
      const newVotes = { ...prev };
      delete newVotes[agendaItemId];
      return newVotes;
    });

    try {
      await removeVote(meetingId, agendaItemId);
    } catch (error) {
      console.error("Failed to remove vote:", error);
      // Revert optimistic update
      setUserVotes(previousVotes);
    }
  };

  const handleAutoSort = async () => {
    try {
      const data = await autoSortAgenda(meetingId);
      return data.agendaItems;
    } catch (error) {
      console.error("Failed to auto-sort agenda:", error);
      throw error;
    }
  };

  return {
    tally,
    userVotes, // Current session's votes (not persisted across reloads unless fetched)
    castVote: handleCastVote,
    removeVote: handleRemoveVote,
    autoSortAgenda: handleAutoSort,
  };
};
