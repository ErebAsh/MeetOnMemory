import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const API_PREFIX = "/api";

const api = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  headers: {
    "Content-Type": "application/json",
  },
});

const GuestMeetingView = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meetingData, setMeetingData] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [decryptionKey, setDecryptionKey] = useState("");
  const [showDecryptPrompt, setShowDecryptPrompt] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState(null);

  // Fetch guest meeting view
  useEffect(() => {
    const fetchGuestView = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/guest/view/${token}`);

        if (response.data.success) {
          const data = response.data.data;
          setMeetingData(data);

          // Check if transcript is encrypted
          if (data.transcript?.encrypted) {
            setIsEncrypted(true);
            setShowDecryptPrompt(true);

            // If preview is available, show it
            if (data.transcript.preview) {
              setTranscript(data.transcript.preview);
            }
          } else if (data.transcript?.content) {
            setTranscript(data.transcript.content);
          } else if (data.transcript?.preview) {
            setTranscript(data.transcript.preview);
          }
        } else {
          setError(response.data.error || "Failed to load meeting");
        }
      } catch (err) {
        console.error("Guest view error:", err);

        if (err.response?.status === 401) {
          if (err.response?.data?.code === "INVALID_TOKEN") {
            setError(
              "Invalid or expired guest link. Please request a new link.",
            );
          } else if (err.response?.data?.code === "ACCESS_EXPIRED") {
            setError("This guest link has expired. Please request a new link.");
          } else {
            setError("Authentication failed. Please check your guest link.");
          }
        } else if (err.response?.status === 404) {
          setError("Meeting not found or guest link is invalid.");
        } else {
          setError(
            err.response?.data?.error ||
              "Failed to load meeting. Please try again.",
          );
        }
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchGuestView();
    }
  }, [token]);

  // Handle decryption
  const handleDecrypt = async () => {
    if (!decryptionKey.trim()) {
      setDecryptError("Please enter the decryption key");
      return;
    }

    setDecrypting(true);
    setDecryptError(null);

    try {
      const encryptedData = meetingData?.transcript?.encryptedData;
      if (!encryptedData) {
        throw new Error("No encrypted data available");
      }

      const response = await api.post(`/guest/decrypt/${token}`, {
        encryptedData,
        decryptionKey: decryptionKey.trim(),
      });

      if (response.data.success) {
        setTranscript(response.data.data.transcript);
        setShowDecryptPrompt(false);
        setIsEncrypted(false);
      } else {
        setDecryptError(response.data.error || "Failed to decrypt transcript");
      }
    } catch (err) {
      console.error("Decryption error:", err);
      setDecryptError(
        err.response?.data?.error ||
          "Failed to decrypt transcript. Please check your decryption key and try again.",
      );
    } finally {
      setDecrypting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
          <p className="mt-4 text-gray-600">Loading meeting...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertTriangle className="w-8 h-8" />
            <h2 className="text-xl font-semibold">Access Error</h2>
          </div>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // No data
  if (!meetingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center text-gray-600">
          <p>No meeting data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Meeting header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            {meetingData.meeting.title}
          </h1>
          <p className="text-gray-600 mt-2">
            {meetingData.meeting.description}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <span className="text-sm text-gray-500">Meeting Time</span>
              <p className="font-medium">
                {new Date(meetingData.meeting.startTime).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Status</span>
              <p className="font-medium capitalize">
                {meetingData.meeting.status}
              </p>
            </div>
          </div>

          {/* Guest access info */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <CheckCircle className="w-4 h-4" />
              <span>Guest access level: {meetingData.access.level}</span>
              <span className="text-blue-400">|</span>
              <span>
                Expires:{" "}
                {new Date(meetingData.access.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Transcript section */}
        {meetingData.transcript && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                {isEncrypted ? (
                  <>
                    <Lock className="w-5 h-5 text-yellow-600" />
                    Encrypted Transcript
                  </>
                ) : (
                  <>
                    <Unlock className="w-5 h-5 text-green-600" />
                    Transcript
                  </>
                )}
              </h2>

              {isEncrypted && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                  End-to-End Encrypted
                </span>
              )}
            </div>

            {/* Decryption prompt */}
            {showDecryptPrompt && (
              <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-yellow-700 font-medium">
                      This transcript is encrypted for security
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      Enter the decryption key provided by the meeting organizer
                      to view the transcript.
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    value={decryptionKey}
                    onChange={(e) => setDecryptionKey(e.target.value)}
                    placeholder="Enter decryption key"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={decrypting}
                  />
                  <button
                    onClick={handleDecrypt}
                    disabled={decrypting || !decryptionKey.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {decrypting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Decrypting...
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        Decrypt Transcript
                      </>
                    )}
                  </button>
                </div>

                {decryptError && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {decryptError}
                  </p>
                )}
              </div>
            )}

            {/* Transcript content */}
            {transcript ? (
              <div className="prose max-w-none">
                <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap font-mono text-sm text-gray-800 border border-gray-200 max-h-96 overflow-y-auto">
                  {transcript}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {isEncrypted ? (
                  <>
                    <Lock className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p>Transcript is encrypted. Please decrypt to view.</p>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p>No transcript available for this meeting</p>
                  </>
                )}
              </div>
            )}

            {/* Encryption status indicator */}
            {isEncrypted && (
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 border-t border-gray-200 pt-4">
                <Lock className="w-3 h-3" />
                <span>End-to-end encrypted</span>
                <span className="text-gray-300">|</span>
                <span>
                  Algorithm:{" "}
                  {meetingData.transcript.encryptedData?.algorithm ||
                    "AES-256-GCM"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Meeting participants */}
        {meetingData.meeting.participants?.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
            <h3 className="font-semibold text-gray-700 mb-3">Participants</h3>
            <div className="flex flex-wrap gap-2">
              {meetingData.meeting.participants.map((participant, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {participant.name || participant.email}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400">
          <p>This is a guest view of a MeetOnMemory meeting</p>
          <p className="mt-1">
            Access expires on{" "}
            {new Date(meetingData.access.expiresAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GuestMeetingView;
