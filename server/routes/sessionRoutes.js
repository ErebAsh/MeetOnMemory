import express from "express";

const router = express.Router();

// Stub route to prevent 404 for generate session
router.post("/generate", (req, res) => {
  res.status(501).json({
    success: false,
    message: "AI Session Generation is not implemented yet.",
  });
});

export default router;
