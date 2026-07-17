// ==============================================
// 📘 embeddingUtils.js
// Handles AI Embeddings + Pinecone Vector Search (Offline + Free)
// ==============================================

import { pipeline } from "@xenova/transformers";
import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
import Meeting from "../models/meetingModel.js";

dotenv.config();

// ======= 🌐 Global Singletons =======
let pineconeClient = null;
let pineconeIndex = null;
let embedder = null;

// ===================================================
// ⚙️ 1️⃣ Initialize Pinecone Client (Singleton)
// ===================================================
export const initVectorStore = async () => {
  const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
  const PINECONE_INDEX = process.env.INDEX_NAME || process.env.PINECONE_INDEX;

  if (!PINECONE_API_KEY) {
    console.error("❌ Missing PINECONE_API_KEY in .env");
    throw new Error("Missing PINECONE_API_KEY in .env");
  }

  if (!PINECONE_INDEX) {
    console.error("❌ Missing INDEX_NAME/PINECONE_INDEX in .env");
    throw new Error("Missing INDEX_NAME/PINECONE_INDEX in .env");
  }

  try {
    if (!pineconeClient) {
      pineconeClient = new Pinecone({ apiKey: PINECONE_API_KEY });
      console.log("✅ Pinecone client initialized.");
    }

    if (!pineconeIndex) {
      pineconeIndex = pineconeClient.Index(PINECONE_INDEX);
      console.log(`✅ Pinecone index ready: ${PINECONE_INDEX}`);
    }

    return pineconeIndex;
  } catch (err) {
    console.error("❌ Failed to initialize Pinecone:", err);
    throw err;
  }
};

// ===================================================
// 🧠 2️⃣ Load Local Hugging Face Embedding Model
// ===================================================
async function getEmbedder() {
  if (!embedder) {
    console.log("⏳ Loading local Hugging Face model (MiniLM-L6-v2)...");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("✅ Local Hugging Face model loaded");
  }
  return embedder;
}

// ===================================================
// 🧩 3️⃣ Generate Embedding from Text
// ===================================================
export const embedText = async (text) => {
  try {
    if (!text || text.trim().length === 0) return [];
    const model = await getEmbedder();
    const output = await model(text, { pooling: "mean", normalize: true });
    let arr = Array.from(output.data);

    // Pinecone index is 1024 dimensions, but MiniLM outputs 384.
    // Pad with zeros to match the index dimension. Cosine similarity will still work correctly.
    if (arr.length < 1024) {
      const padded = new Array(1024).fill(0);
      for (let i = 0; i < arr.length; i++) {
        padded[i] = arr[i];
      }
      arr = padded;
    }

    return arr;
  } catch (error) {
    console.error("❌ Local embedding creation failed:", error);
    throw new Error("Embedding creation failed");
  }
};

// ===================================================
// ✂️ 3.5️⃣ Chunk Text for Embedding
// ===================================================
// Splits text into overlapping chunks to avoid truncation by the embedding model
// MiniLM-L6-v2 has a max sequence length of 256 tokens (~150-200 words)
const chunkText = (text, maxWords = 180, overlapWords = 30) => {
  if (!text || text.trim().length === 0) return [];

  const words = text.split(/\s+/);
  if (words.length <= maxWords) return [text];

  const chunks = [];
  let startIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + maxWords, words.length);
    const chunk = words.slice(startIndex, endIndex).join(" ");
    chunks.push(chunk);
    startIndex += maxWords - overlapWords;
  }

  return chunks;
};

// ===================================================
// 💾 4️⃣ Index Meeting in Pinecone (FINAL v3-compatible)
// ===================================================
export const indexMeeting = async (meeting) => {
  try {
    const indexInstance = await initVectorStore();

    if (!meeting || !meeting.transcript) {
      console.warn("⚠️ Skipping empty meeting embedding");
      return;
    }

    // 🧠 Smart fallback data
    let title = meeting.title?.trim() || "";
    let summary = meeting.summary?.trim() || "";

    if (!title || title.toLowerCase().includes("untitled")) {
      title = meeting.transcript.split(" ").slice(0, 6).join(" ") + "...";
    }

    if (!summary || summary.length < 20) {
      summary = meeting.transcript.split(" ").slice(0, 50).join(" ") + "...";
    }

    // Combine title and summary with each chunk for context
    const contextPrefix = `${title}\n${summary}\n`;
    const transcriptChunks = chunkText(meeting.transcript);

    const vectors = [];

    for (let i = 0; i < transcriptChunks.length; i++) {
      const chunkText = contextPrefix + transcriptChunks[i];
      const embedding = await embedText(chunkText);

      vectors.push({
        id: `${meeting._id.toString()}-chunk-${i}`,
        values: embedding,
        metadata: {
          meetingId: meeting._id.toString(),
          chunkIndex: i,
          title,
          summary,
          transcript: meeting.transcript,
          createdAt: meeting.createdAt || new Date(),
        },
      });
    }

    // ✅ FIXED FORMAT — direct array (Pinecone v3.x+)
    await indexInstance.upsert(vectors);

    console.log(`✅ Indexed meeting: ${title} (${transcriptChunks.length} chunks)`);
  } catch (error) {
    console.error("❌ Failed to index meeting:", error);
  }
};

// ===================================================
// 🔍 5️⃣ Perform Semantic Search via Pinecone
// ===================================================
// ===================================================
// 🔍 5️⃣ Perform Semantic Search via Pinecone (FIXED)
// ===================================================
export const searchVectorStore = async (query, filters = {}) => {
  try {
    if (!query || query.trim().length === 0) {
      throw new Error("Empty query received for vector search");
    }

    const indexInstance = await initVectorStore();

    console.log(
      "🔍 Performing Pinecone vector search for:",
      query,
      "with filters:",
      filters,
    );

    const queryEmbedding = await embedText(query);

    const topK = filters.limit || 10;

    const results = await indexInstance.query({
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: true,
    });

    if (!results.matches?.length) {
      console.warn("⚠️ No results returned from Pinecone");
      return [];
    }

    // ✅ FIXED: Added transcript + better formatting + result type
    const formattedResults = results.matches.map((match) => {
      const metadata = match.metadata || {};

      return {
        meetingId: metadata.meetingId || match.id,
        title: metadata.title || "Untitled Meeting",
        summary: metadata.summary || "No summary available.",
        transcript: metadata.transcript || "",
        createdAt: metadata.createdAt || null,
        similarityScore: parseFloat(match.score?.toFixed(3)) || 0,
        resultType: metadata.resultType || "meeting",
        organization: metadata.organization || null,
        tags: metadata.tags || [],
      };
    });

    // De-duplicate results by meetingId (keep highest score)
    const deduplicatedResults = [];
    const meetingIdMap = new Map();

    for (const result of formattedResults) {
      const existing = meetingIdMap.get(result.meetingId);
      if (!existing || result.similarityScore > existing.similarityScore) {
        meetingIdMap.set(result.meetingId, result);
      }
    }

    deduplicatedResults.push(...meetingIdMap.values());

    // Apply filters if provided
    let filteredResults = deduplicatedResults;

    if (filters.resultType && filters.resultType !== "all") {
      filteredResults = filteredResults.filter(
        (r) => r.resultType === filters.resultType,
      );
    }

    if (filters.organization) {
      filteredResults = filteredResults.filter(
        (r) => r.organization === filters.organization,
      );
    }

    if (filters.dateFrom) {
      filteredResults = filteredResults.filter((r) => {
        if (!r.createdAt) return false;
        return new Date(r.createdAt) >= new Date(filters.dateFrom);
      });
    }

    if (filters.dateTo) {
      filteredResults = filteredResults.filter((r) => {
        if (!r.createdAt) return false;
        return new Date(r.createdAt) <= new Date(filters.dateTo);
      });
    }

    if (filters.tags && filters.tags.length > 0) {
      filteredResults = filteredResults.filter(
        (r) => r.tags && r.tags.some((tag) => filters.tags.includes(tag)),
      );
    }

    // Sort by similarity score (already ranked by Pinecone, but ensure consistency)
    filteredResults.sort((a, b) => b.similarityScore - a.similarityScore);

    console.log("✅ Pinecone vector search results:", filteredResults);
    return filteredResults;
  } catch (error) {
    console.error("❌ Pinecone vector search error:", error);
    throw new Error("Vector search failed");
  }
};

// ===================================================
// �️ 6️⃣ Delete Meeting from Pinecone
// ===================================================
export const deleteMeetingFromPinecone = async (meetingId) => {
  try {
    const indexInstance = await initVectorStore();

    if (!meetingId) {
      console.warn("⚠️ No meetingId provided for Pinecone deletion");
      return;
    }

    // Delete all chunks for this meeting using prefix filter
    await indexInstance.deleteMany({
      filter: {
        meetingId: { $eq: meetingId.toString() },
      },
    });
    console.log(`✅ Deleted meeting chunks from Pinecone: ${meetingId}`);
  } catch (error) {
    console.error("❌ Failed to delete meeting from Pinecone:", error);
    // Don't throw - allow deletion to proceed even if Pinecone fails
  }
};

// ===================================================
// �🚀 7️⃣ Bulk Reindex All Meetings (Manual / Script)
// ===================================================
export const reindexAllMeetings = async () => {
  try {
    const indexInstance = await initVectorStore();

    const allMeetings = await Meeting.find({
      transcript: { $exists: true, $ne: "" },
    });

    console.log(
      `🔁 Reindexing ${allMeetings.length} meetings into Pinecone...`,
    );
    for (const m of allMeetings) {
      await indexMeeting(m);
    }

    console.log("🎉 Reindexing completed successfully!");
  } catch (error) {
    console.error("❌ Failed to reindex all meetings:", error);
  }
};
