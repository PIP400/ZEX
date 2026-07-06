import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const PORT = 3000;

// Simple memory/JSON persistence helpers
const LEADERBOARD_FILE = path.join(process.cwd(), "data_leaderboard.json");
const SYNC_FILE = path.join(process.cwd(), "data_sync.json");

// Pre-populate some cool high scores for the retro action feel
const DEFAULT_LEADERBOARD = [
  { name: "Aric_Slayer", heroClass: "Warrior", score: 9200, wave: 5, server: "Asia-East" },
  { name: "Storm_Lyra", heroClass: "Archer", score: 7850, wave: 4, server: "NA-West" },
  { name: "Void_Valen", heroClass: "Mage", score: 6400, wave: 3, server: "Europe-Central" },
  { name: "Kael_Assassin", heroClass: "Rogue", score: 5900, wave: 3, server: "Asia-East" },
  { name: "Slayer_00", heroClass: "Warrior", score: 4200, wave: 2, server: "NA-West" }
];

function loadLeaderboard() {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const data = fs.readFileSync(LEADERBOARD_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error loading leaderboard:", err);
  }
  return DEFAULT_LEADERBOARD;
}

function saveLeaderboard(data: any) {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving leaderboard:", err);
  }
}

function loadSyncData() {
  try {
    if (fs.existsSync(SYNC_FILE)) {
      const data = fs.readFileSync(SYNC_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error loading sync data:", err);
  }
  return {};
}

function saveSyncData(data: any) {
  try {
    fs.writeFileSync(SYNC_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving sync data:", err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Route: Get Leaderboard
  app.get("/api/leaderboard", (req, res) => {
    const list = loadLeaderboard();
    // Sort descending by score
    const sortedList = list.sort((a: any, b: any) => b.score - a.score);
    res.json(sortedList.slice(0, 15));
  });

  // API Route: Submit Score to Leaderboard
  app.post("/api/leaderboard", (req, res) => {
    const { name, heroClass, score, wave, server } = req.body;
    if (!name || !heroClass || typeof score !== "number") {
      res.status(400).json({ error: "Invalid data submitted" });
      return;
    }
    const list = loadLeaderboard();
    list.push({
      name: String(name).trim().slice(0, 20) || "Unknown Hero",
      heroClass: String(heroClass),
      score: Number(score),
      wave: Number(wave) || 1,
      server: String(server || "Asia-East")
    });
    // Keep only top 100
    const sortedList = list.sort((a: any, b: any) => b.score - a.score).slice(0, 100);
    saveLeaderboard(sortedList);
    res.json({ success: true, leaderboard: sortedList.slice(0, 15) });
  });

  // API Route: Cloud Sync Get
  app.get("/api/sync", (req, res) => {
    const username = String(req.query.username || "").trim();
    if (!username) {
      res.status(400).json({ error: "Username is required for sync" });
      return;
    }
    const syncStore = loadSyncData() as any;
    const userData = syncStore[username] || null;
    res.json({ success: true, data: userData });
  });

  // API Route: Cloud Sync Save
  app.post("/api/sync", (req, res) => {
    const { username, progress } = req.body;
    if (!username || !progress) {
      res.status(400).json({ error: "Username and progress data are required" });
      return;
    }
    const cleanUsername = String(username).trim();
    const syncStore = loadSyncData() as any;
    syncStore[cleanUsername] = {
      progress,
      syncedAt: new Date().toISOString()
    };
    saveSyncData(syncStore);
    res.json({ success: true, syncedAt: syncStore[cleanUsername].syncedAt });
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ZEX game server is running on http://localhost:${PORT}`);
  });
}

startServer();
