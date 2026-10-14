import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import MeetingRoom from "../MeetingRoom.jsx";
import AppContent from "../../context/AppContent.js";

// Mock router
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useParams: () => ({ roomId: "room_test_123" }),
  useNavigate: () => mockNavigate,
}));

// Mock clerk auth
const { mockClerk } = vi.hoisted(() => ({
  mockClerk: {
    userId: "user_1",
    isSignedIn: true,
    isLoaded: true,
  },
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isSignedIn: mockClerk.isSignedIn,
    isLoaded: mockClerk.isLoaded,
    userId: mockClerk.userId,
  }),
}));

// Mock socket.io-client
const { mockSocketInstances, mockIo } = vi.hoisted(() => {
  const mockSocketInstances = [];
  const mockIo = vi.fn((url, options) => {
    const listeners = {};
    const socket = {
      id: `socket_${mockSocketInstances.length + 1}`,
      auth: options?.auth || {},
      on: vi.fn((event, cb) => {
        listeners[event] = cb;
      }),
      off: vi.fn((event, cb) => {
        if (listeners[event] === cb) {
          delete listeners[event];
        }
      }),
      emit: vi.fn(),
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      // Test helper to trigger events
      fire: (event, data) => {
        if (listeners[event]) {
          listeners[event](data);
        }
      },
    };
    mockSocketInstances.push(socket);
    return socket;
  });
  return { mockSocketInstances, mockIo };
});

vi.mock("socket.io-client", () => ({
  io: mockIo,
}));

// Mock apiClient functions
const { mockApiClient } = vi.hoisted(() => ({
  mockApiClient: { token: "token_1" },
}));

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: vi.fn().mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/roles")) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: { meeting: {} } });
    }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
  createClerkSocketOptions: vi.fn(async (extra) => ({
    auth: { token: mockApiClient.token },
    transports: ["websocket"],
    ...extra,
  })),
  getClerkBearerToken: vi.fn(async () => mockApiClient.token),
}));

// Mock other hooks used in MeetingRoom
vi.mock("../../hooks/useDevicePermission", () => ({
  default: () => ({
    selectedCamera: "cam-1",
    selectedMicrophone: "mic-1",
    releaseStream: vi.fn(),
  }),
}));

vi.mock("../../hooks/useLiveTranscription", () => ({
  default: () => ({
    toggleTranscription: vi.fn(),
  }),
}));

vi.mock("../../hooks/useReactions", () => ({
  default: vi.fn(() => ({
    reactions: [],
    sendReaction: vi.fn(),
    onCooldown: false,
  })),
}));

vi.mock("../../utils/mediaStream", () => ({
  resolveMeetingMediaStream: vi.fn().mockResolvedValue({
    getTracks: () => [],
    getAudioTracks: () => [],
    getVideoTracks: () => [],
  }),
  getTrackEnabledState: vi
    .fn()
    .mockReturnValue({ micOn: true, cameraOn: true }),
}));

// Mock components rendered inside MeetingRoom to simplify rendering
vi.mock("../../components/meetings/DeviceSetupModal.jsx", () => ({
  default: ({ onJoin }) => (
    <div data-testid="device-setup">
      <button onClick={() => onJoin(null)}>Mock Join Button</button>
    </div>
  ),
}));

vi.mock("../../components/meetings/VideoGrid.jsx", () => ({
  default: () => <div data-testid="video-grid" />,
}));

vi.mock("../../components/meetings/MeetingControlBar.jsx", () => ({
  default: () => <div data-testid="control-bar" />,
}));

describe("MeetingRoom Clerk Token Rebinding & Socket Lifecycle Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketInstances.length = 0;
    mockClerk.userId = "user_1";
    mockClerk.isSignedIn = true;
    mockClerk.isLoaded = true;
    mockApiClient.token = "token_1";
  });

  const wrapper = ({ children }) => (
    <AppContent.Provider
      value={{
        userData: { _id: "mongo_user_1", name: "Alice" },
      }}
    >
      {children}
    </AppContent.Provider>
  );

  it("should not create socket connection before user joins the meeting", () => {
    render(<MeetingRoom />, { wrapper });

    expect(screen.getByTestId("device-setup")).toBeInTheDocument();
    expect(mockIo).not.toHaveBeenCalled();
  });

  it("should connect socket and bind listeners using the current Clerk token after joining", async () => {
    render(<MeetingRoom />, { wrapper });

    // Join the meeting
    const joinBtn = screen.getByText("Mock Join Button");
    await act(async () => {
      fireEvent.click(joinBtn);
    });

    expect(mockIo).toHaveBeenCalledTimes(1);
    const socket = mockSocketInstances[0];
    expect(socket.auth.token).toBe("token_1");
  });

  it("should rebind and recreate the socket using a refreshed token when Clerk identity or token changes", async () => {
    const { rerender } = render(<MeetingRoom />, { wrapper });

    // Join
    const joinBtn = screen.getByText("Mock Join Button");
    await act(async () => {
      fireEvent.click(joinBtn);
    });

    expect(mockSocketInstances).toHaveLength(1);
    const firstSocket = mockSocketInstances[0];

    // Simulate token refresh and session change
    mockApiClient.token = "token_2";
    mockClerk.userId = "user_1_refreshed";

    // Trigger rerender with new Clerk session context
    await act(async () => {
      rerender(<MeetingRoom />);
    });

    // Ensure the old socket is cleanly disconnected
    expect(firstSocket.disconnect.mock.calls.length).toBeGreaterThanOrEqual(1);

    // Ensure a new socket is created with the refreshed token
    expect(mockIo).toHaveBeenCalledTimes(2);
    const secondSocket = mockSocketInstances[1];
    expect(secondSocket.auth.token).toBe("token_2");
  });

  it("should cleanly disconnect the socket upon user logout during an active meeting", async () => {
    const { rerender } = render(<MeetingRoom />, { wrapper });

    // Join
    const joinBtn = screen.getByText("Mock Join Button");
    await act(async () => {
      fireEvent.click(joinBtn);
    });

    const socket = mockSocketInstances[0];

    // Simulate logout
    mockClerk.isSignedIn = false;

    await act(async () => {
      rerender(<MeetingRoom />);
    });

    // Expect the socket connection to be disposed on signout
    expect(socket.disconnect.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("should fetch a fresh token dynamically during a socket reconnect_attempt event", async () => {
    render(<MeetingRoom />, { wrapper });

    // Join
    const joinBtn = screen.getByText("Mock Join Button");
    await act(async () => {
      fireEvent.click(joinBtn);
    });

    const socket = mockSocketInstances[0];

    // Simulate token rotation before a reconnect attempt
    mockApiClient.token = "token_refreshed_during_reconnect";

    // Fire the reconnect_attempt event on the socket
    await act(async () => {
      await socket.fire("reconnect_attempt");
    });

    // Verify the socket's auth token is updated with the fresh token
    expect(socket.auth.token).toBe("token_refreshed_during_reconnect");
  });
});
