import csrf from "csurf";

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
  return csrfProtection(req, res, next);
};

export const csrfTokenProvider = csrfProtection;
