import csrf from "csurf";
import { sendCsrfInvalid } from "../utils/csrfErrors.js";

const csrfProtection = csrf({
  cookie: {
    key: "_csrf",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  },
});

export const csrfMiddleware = (req, res, next) => {
  const isSafeMethod = ["GET", "HEAD", "OPTIONS"].includes(req.method);
  const isAuthRoute = req.path.startsWith("/api/auth");
  const isSyncPath = req.path.startsWith("/sync");
  // Slack cannot send CSRF tokens — exclude all Slack endpoints
  const isSlackRoute = req.path.startsWith("/api/slack");

  if (
    isSafeMethod ||
    isAuthRoute ||
    isSyncPath ||
    isSlackRoute ||
    process.env.NODE_ENV === "test"
  ) {
    return next();
  }

  return csrfProtection(req, res, (err) => {
    if (!err) return next();
    if (err.code === "EBADCSRFTOKEN") {
      return sendCsrfInvalid(res);
    }
    return next(err);
  });
};

export const csrfTokenProvider = csrfProtection;
