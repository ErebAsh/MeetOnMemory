import express from "express";
import {
  verifyPasscode,
  getPublicResource,
} from "../controllers/sharedLinkController.js";

const router = express.Router();

router.post("/:hash/verify", verifyPasscode);
router.get("/:hash", getPublicResource);

export default router;
