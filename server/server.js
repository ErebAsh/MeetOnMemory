import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import csrf from "csurf";
import { Server } from "socket.io";
import http from "http";

import connectDB from "./config/mongodb.js";

import authRoutes from "./routes/authRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import organizationRoutesNew from "./routes/organizationRoutesNew.js";
import membershipRoutes from "./routes/membershipRoutes.js";
import membershipRequestRoutes from "./routes/membershipRequestRoutes.js";
import invitationRoutes from "./routes/invitationRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import policyRoutes from "./routes/policyRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import geminiRoutes from "./routes/geminiRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import knowledgeRoutes from "./routes/knowledgeRoutes.js";
import policyComplianceRoutes from "./routes/policyComplianceRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";

import { initVectorStore } from "./utils/embeddingUtils.js";
import meetingSocket from "./socket/meetingSocket.js";
import { initRedis } from "./services/redisService.js";
import { initAIWorker } from "./services/queueService.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if it exists, otherwise fallback to .env
const envPath = path.resolve(__dirname, '.env.local');
dotenv.config({ path: envPath });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ================================
// DATABASE & CACHE
// ================================
await connectDB();
if (process.env.NODE_ENV !== "test") {
  initRedis(); // Non-blocking: allows server to start even if Redis is unavailable
}

// ================================
// MIDDLEWARES
// ================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ================================
// CORS (must be before CSRF)
// ================================
const allowedOrigins = [
  "http://localhost:5173",
  "https://localhost:5173",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-CSRF-Token",
    ],
  }),
);

// ================================
// CSRF PROTECTION (CodeQL Fix)
// ================================
const csrfProtection = csrf({
  cookie: {
    key: "_csrf",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  },
});

app.use((req, res, next) => {
  // Bypass CSRF in development to avoid localhost cross-origin cookie blocking
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  // Exclude authentication endpoints from CSRF validation
  // These endpoints handle initial authentication and shouldn't require CSRF tokens
  if (req.path.startsWith("/api/auth/")) {
    return next();
  }

  if (req.method === "GET") {
    csrfProtection(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  } else {
    // For non-auth POST/PUT/PATCH/DELETE requests, require CSRF validation
    csrfProtection(req, res, next);
  }
});

// Apply global rate limit after CORS
app.use(globalLimiter);

// ================================
// STATIC FILES
// ================================
app.use("/uploads", express.static("uploads"));

// ================================
// HEALTH CHECK
// ================================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MeetOnMemory API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// ================================
// ROUTES
// ================================
app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/organizations-new", organizationRoutesNew);
app.use("/api/memberships", membershipRoutes);
app.use("/api/membership-requests", membershipRequestRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/ai-search", aiRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/gemini", geminiRoutes);
app.use("/api/user", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/knowledge", knowledgeRoutes);
app.use("/api/policy-compliance", policyComplianceRoutes);
app.use("/api/sessions", sessionRoutes);

// ================================
// VECTOR STORE INIT (Non-blocking)
// ================================
// Initialize vector store in background to avoid blocking server startup
if (process.env.NODE_ENV !== "test") {
  initVectorStore()
    .then(() => console.log("✅ Vector store initialized"))
    .catch((error) =>
      console.error("⚠️ Vector store initialization failed:", error.message),
    );
}

// ================================
// START SERVER
// ================================
let server;
if (process.env.NODE_ENV !== "test") {
  server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Allowed Origins: ${allowedOrigins.join(", ")}`);
  });
} else {
  // In test mode, create server without listening
  server = http.createServer(app);
}

// ================================
// SOCKET.IO
// ================================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

meetingSocket(io);
if (process.env.NODE_ENV !== "test") {
  initAIWorker(app);
}

// ================================
// ERROR HANDLER
// ================================
app.use((err, req, res, next) => {
  console.error(err);

  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({
      success: false,
      message: "CSRF token validation failed.",
    });
  }

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ================================
// GRACEFUL SHUTDOWN
// ================================
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  server.close(() => {
    process.exit(0);
  });
});

export { app, server };
