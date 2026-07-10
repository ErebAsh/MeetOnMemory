import dotenv from "dotenv";
import connectDB from "./config/mongodb.js";
import Meeting from "./models/meetingModel.js";
import {
  processStructuredMoM,
  detectResolutions,
} from "./services/knowledgeGraphService.js";

dotenv.config();

const run = async () => {
  try {
    await connectDB();
    console.log("✅ Database connected for knowledge graph backfill.");

    const meetings = await Meeting.find({
      structuredMoM: { $ne: null },
    }).sort({ date: 1 });

    console.log(`🔁 Backfilling ${meetings.length} meetings...`);

    for (const meeting of meetings) {
      if (meeting.structuredMoM) {
        try {
          await processStructuredMoM(meeting, meeting.structuredMoM);

          await detectResolutions(meeting, meeting.structuredMoM);

          console.log(`  ✅ Processed meeting ${meeting._id}`);
        } catch (meetingErr) {
          console.error(
            `  ⚠️ Failed meeting ${meeting._id}:`,
            meetingErr.message,
          );
        }
      }
    }

    console.log("🎉 Knowledge graph backfill completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Backfill failed:", error);
    process.exit(1);
  }
};

run();
