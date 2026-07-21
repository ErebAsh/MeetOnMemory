import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { corsOptions } from "./corsOptions.js";
import { csrfTokenProvider } from "../middleware/csrfProtection.js";
import { globalLimiter } from "../middleware/rateLimiter.js";
import errorHandler from "../middleware/errorHandler.js";

export function configureExpress(app) {
  // Trust proxy for Render/Vercel
  app.set("trust proxy", 1);

  // MIDDLEWARES
  app.use(cors(corsOptions));

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  app.use(cookieParser());

  // CSRF token provider
  app.get("/api/csrf-token", csrfTokenProvider, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  // Health check endpoint — registered BEFORE the global rate limiter so
  // keep-alive pings (e.g. from GitHub Actions cron job) are never blocked.
  app.get(["/health", "/api/health"], (req, res) => {
    res.status(200).json({
      status: "UP",
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
    });
  });

  // GLOBAL RATE LIMITER
  app.use(globalLimiter);
}

export function configureErrorHandling(app) {
  // ERROR HANDLER
  app.use(errorHandler);
}
