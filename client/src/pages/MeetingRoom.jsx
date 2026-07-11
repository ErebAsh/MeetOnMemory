import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Peer from "simple-peer";
import {
  Mic,
  MicOff,
  PhoneOff,
  Loader2,
  CheckCircle2,
  Sparkles,
  Video,
  VideoOff,
  MonitorUp,
  Users,
  Clock,
  Copy,
} from "lucide-react";
import { toast } from "react-toastify";
import ErrorState from "../components/ErrorState.jsx";

// A separate component to render each peer's video
const PeerVideo = ({ peer, userInfo }) => {
  const ref = useRef();

  useEffect(() => {
    peer.on("stream", (stream) => {
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    });
  }, [peer]);

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden shadow-lg aspect-video flex-1 min-w-[280px] max-w-[600px] border border-gray-800">
      <video
        playsInline
        autoPlay
        ref={ref}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-sm text-white text-sm flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        {userInfo?.name || "Participant"}
      </div>
    </div>
  );
};

const MeetingRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [mediaError, setMediaError] = useState(null);

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [peers, setPeers] = useState([]);
  const [duration, setDuration] = useState(0);

  const socketRef = useRef();
  const userVideoRef = useRef();
  const streamRef = useRef();
  const screenTrackRef = useRef();
  const peersRef = useRef([]);

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  // Format time for the timer
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ":" : ""}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    let timer;
    if (joined && !meetingEnded) {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [joined, meetingEnded]);

  const joinMeeting = async () => {
    try {
      setLoading(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;
      setJoined(true);

      setTimeout(() => {
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
        }
      }, 100);

      socketRef.current = io(backendUrl, { transports: ["websocket"] });

      const userInfo = { name: "You" }; // In a real app, grab from context

      socketRef.current.emit("join-meeting", { roomId, userInfo });

      socketRef.current.on("all-users", (users) => {
        const peersArr = [];
        users.forEach((user) => {
          const peer = createPeer(user.socketId, socketRef.current.id, stream);
          peersRef.current.push({
            peerID: user.socketId,
            peer,
            userInfo: user,
          });
          peersArr.push({
            peerID: user.socketId,
            peer,
            userInfo: user,
          });
        });
        setPeers(peersArr);
      });

      socketRef.current.on("user-joined", (user) => {
        toast.info(`👋 Participant joined`);
        const peer = addPeer(user.socketId, socketRef.current.id, stream);
        peersRef.current.push({
          peerID: user.socketId,
          peer,
          userInfo: user,
        });

        setPeers([...peersRef.current]);
      });

      socketRef.current.on("user-joined-signal", (payload) => {
        const item = peersRef.current.find(
          (p) => p.peerID === payload.callerID,
        );
        if (item) {
          item.peer.signal(payload.signal);
        }
      });

      socketRef.current.on("receiving-returned-signal", (payload) => {
        const item = peersRef.current.find((p) => p.peerID === payload.id);
        if (item) {
          item.peer.signal(payload.signal);
        }
      });

      socketRef.current.on("user-left", (id) => {
        toast.error(`🚪 Participant left`);
        const peerObj = peersRef.current.find((p) => p.peerID === id);
        if (peerObj) {
          peerObj.peer.destroy();
        }
        peersRef.current = peersRef.current.filter((p) => p.peerID !== id);
        setPeers([...peersRef.current]);
      });

      setLoading(false);
    } catch (err) {
      console.error("Camera/Mic access denied:", err);
      let errMsg =
        "Camera or microphone access denied. Please enable them and retry.";
      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errMsg = "Required media devices (camera or microphone) not found.";
      } else if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        errMsg =
          "Permission denied. Please allow camera and microphone access in your browser settings.";
      }
      setMediaError(errMsg);
      toast.error(errMsg);
      setLoading(false);
    }
  };

  const createPeer = (userToSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socketRef.current.emit("sending-signal", {
        userToSignal,
        callerID,
        signal,
        userInfo: { name: "You" },
      });
    });

    return peer;
  };

  const addPeer = (incomingSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socketRef.current.emit("returning-signal", { signal, callerID });
    });

    return peer;
  };

  const leaveMeeting = () => {
    setMeetingEnded(true);

    streamRef.current?.getTracks().forEach((track) => track.stop());
    screenTrackRef.current?.getTracks().forEach((track) => track.stop());

    socketRef.current?.disconnect();

    setJoined(false);

    setTimeout(() => {
      setMeetingEnded(false);
      navigate("/dashboard");
    }, 4000);
  };

  // Toggle Media Handlers
  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !cameraOn;
        setCameraOn(!cameraOn);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: true },
        });
        const screenTrack = screenStream.getVideoTracks()[0];

        peersRef.current.forEach(({ peer }) => {
          const videoTrack = streamRef.current.getVideoTracks()[0];
          peer.replaceTrack(videoTrack, screenTrack, streamRef.current);
        });

        screenTrack.onended = () => {
          stopScreenShare();
        };

        userVideoRef.current.srcObject = screenStream;
        screenTrackRef.current = screenStream;
        setIsScreenSharing(true);
      } catch (err) {
        console.error("Screen share failed", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    const videoTrack = streamRef.current.getVideoTracks()[0];
    peersRef.current.forEach(({ peer }) => {
      const currentTrack = screenTrackRef.current?.getTracks()[0];
      if (currentTrack) {
        peer.replaceTrack(currentTrack, videoTrack, streamRef.current);
      }
    });

    screenTrackRef.current?.getTracks().forEach((t) => t.stop());
    userVideoRef.current.srcObject = streamRef.current;
    setIsScreenSharing(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Meeting link copied!");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 relative overflow-hidden font-sans">
      {/* ---------- INTRO SCREEN ---------- */}
      {!joined && !meetingEnded && (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 md:px-8 text-center bg-gradient-to-br from-indigo-50 via-white to-purple-100 dark:from-slate-950 dark:via-slate-900 dark:to-purple-950/20">
          <div className="absolute top-0 left-0 w-72 h-72 bg-indigo-200 dark:bg-indigo-900/10 opacity-20 blur-3xl rounded-full animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-200 dark:bg-purple-900/10 opacity-30 blur-3xl rounded-full animate-pulse"></div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 dark:text-white mb-3 flex items-center justify-center gap-3">
            🎥 MeetOnMemory{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              Live Room
            </span>
          </h1>

          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed text-base md:text-lg">
            Join room <strong>{roomId}</strong> with real-time transcription and
            automatic AI-generated MoMs.
          </p>

          {mediaError ? (
            <div className="w-full max-w-lg mx-auto">
              <ErrorState
                title="Device Access Error"
                message={mediaError}
                onRetry={() => {
                  setMediaError(null);
                  joinMeeting();
                }}
              />
            </div>
          ) : loading ? (
            <button
              disabled
              className="px-8 py-3 bg-indigo-600 text-white rounded-full font-semibold shadow-md flex items-center justify-center gap-2 mx-auto cursor-not-allowed"
            >
              <Loader2 className="animate-spin" size={20} /> Connecting...
            </button>
          ) : (
            <button
              onClick={joinMeeting}
              className="px-8 py-3 bg-indigo-600 text-white rounded-full font-semibold shadow-md hover:bg-indigo-700 hover:shadow-xl active:scale-95 transition-all duration-300 cursor-pointer"
            >
              🚀 Join Meeting
            </button>
          )}
        </div>
      )}

      {/* ---------- ACTIVE MEETING SCREEN ---------- */}
      {joined && !meetingEnded && (
        <div className="flex-1 flex flex-col min-h-0 bg-gray-900 relative">
          {/* Header */}
          <div className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 z-20 shrink-0">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-white truncate max-w-xs md:max-w-md">
                {title}
              </h2>
              {isRecording ? (
                <div className="flex items-center gap-2 text-red-500 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Recording
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-300 bg-gray-800 px-3 py-1 rounded-full text-sm font-mono">
                  Ready
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-300 bg-gray-800 px-3 py-1 rounded-full text-sm">
                <Users size={16} />
                <span>{participants.length}</span>
              </div>
            </div>

            <button
              onClick={handleCopyLink}
              className="text-gray-300 hover:text-white flex items-center gap-1.5 text-sm font-semibold bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              <Copy size={16} />
              <span className="hidden sm:inline">Copy Link</span>
            </button>
          </div>

          {/* Grid Layout */}
          <div className="flex-1 p-6 overflow-y-auto bg-gray-900 flex items-center justify-center">
            <div className="w-full h-full max-w-5xl flex flex-col md:flex-row gap-6 items-center justify-center min-h-[300px]">
              {/* Local Stream */}
              <div className="relative bg-black rounded-2xl overflow-hidden shadow-lg aspect-video flex-1 min-w-[280px] max-w-[600px] border border-gray-800 group">
                {videoOn && localStream ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl">
                      {userData ? getInitials(userData.name) : "U"}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-sm text-white text-sm flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${micOn ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <span>You ({userData?.name || "Member"})</span>
                </div>
              </div>

              {/* Remote Streams */}
              {participants
                .filter((p) => p.userId !== userData?._id)
                .map((participant) => (
                  <RemoteVideo key={participant.userId} participant={participant} />
                ))}
            </div>
          </div>

          {/* Control Bar */}
          <div className="h-24 bg-gray-900 border-t border-gray-800 flex items-center justify-center gap-4 px-6 z-20 shrink-0">
            {/* Audio Toggle */}
            <button
              onClick={toggleMic}
              className={`p-4 rounded-full transition-all shadow-md active:scale-95 cursor-pointer ${
                micOn
                  ? "bg-gray-800 text-white hover:bg-gray-700"
                  : "bg-red-500 text-white hover:bg-red-600"
              }`}
            >
              {micOn ? <Mic size={22} /> : <MicOff size={22} />}
            </button>

            {/* Video Toggle */}
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-all shadow-md active:scale-95 cursor-pointer ${
                videoOn
                  ? "bg-gray-800 text-white hover:bg-gray-700"
                  : "bg-red-500 text-white hover:bg-red-600"
              }`}
            >
              {videoOn ? <VideoIcon size={22} /> : <VideoOff size={22} />}
            </button>

            {/* Screen Share (Dummy toggle for now) */}
            <button
              onClick={() => setScreenShareOn(!screenShareOn)}
              className={`p-4 rounded-full transition-all shadow-md active:scale-95 cursor-pointer ${
                screenShareOn
                  ? "bg-indigo-500 text-white hover:bg-indigo-600"
                  : "bg-gray-800 text-white hover:bg-gray-700"
              }`}
            >
              <ScreenShare size={22} />
            </button>

            <div className="w-px h-8 bg-gray-700 mx-2"></div>

            {/* End / Leave button */}
            <button
              onClick={leaveMeeting}
              className="px-6 py-4 bg-red-600 text-white rounded-full font-semibold hover:bg-red-700 shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <PhoneOff size={22} /> Leave
            </button>
          </div>
        </div>
      )}

      {/* ---------- AI PROCESSING SCREEN ---------- */}
      {meetingEnded && (
        <div className="flex-1 flex flex-col items-center justify-center text-center bg-gray-50 dark:bg-slate-900 z-30">
          <CheckCircle2 className="text-green-500" size={64} />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mt-3">
            Processing Meeting Data...
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-3 max-w-md leading-relaxed">
            Our AI is preparing your <strong>transcript</strong> and{" "}
            <strong>Minutes of Meeting</strong>.
          </p>
          <Loader2 className="animate-spin text-indigo-600 mt-5" size={28} />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Redirecting you to dashboard...
          </p>
        </div>
      )}
    </div>
  );
};

export default MeetingRoom;
