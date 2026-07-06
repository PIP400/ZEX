import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { playSfx } from "../sound";
import { GameSettings, LeaderboardEntry } from "../types";
import { Volume2, VolumeX, Shield, Swords, Globe, RefreshCw, Zap, Sliders } from "lucide-react";

interface MenuProps {
  settings: GameSettings;
  onUpdateSettings: (s: GameSettings) => void;
  onLaunch: (playerName: string, server: string) => void;
}

export default function Menu({ settings, onUpdateSettings, onLaunch }: MenuProps) {
  const [charName, setCharName] = useState(() => {
    return localStorage.getItem("zex_player_name") || "Aric_Pro";
  });
  const [selectedServer, setSelectedServer] = useState(() => {
    return localStorage.getItem("zex_server") || "Asia-East";
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"setup" | "settings">("setup");

  // Fetch real-time leaderboard rankings
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch (e) {
      console.error("Failed to fetch real-time leaderboard", e);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000); // Poll real-time rankings every 5s
    return () => clearInterval(interval);
  }, []);

  const handleLaunch = () => {
    const cleanName = charName.trim() || "Aric_Pro";
    localStorage.setItem("zex_player_name", cleanName);
    localStorage.setItem("zex_server", selectedServer);
    playSfx("click");
    onLaunch(cleanName, selectedServer);
  };

  // Cloud sync handler: Backs up the highest local score to the server
  const handleCloudSync = async () => {
    const cleanName = charName.trim();
    if (!cleanName) {
      setSyncMessage("Error: Name required!");
      return;
    }
    setIsSyncing(true);
    setSyncMessage("Syncing progress...");
    playSfx("click");

    try {
      // Get local high score
      const localHighScore = Number(localStorage.getItem(`zex_high_score_${cleanName}`) || "0");
      const localMaxWave = Number(localStorage.getItem(`zex_max_wave_${cleanName}`) || "1");

      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanName,
          progress: {
            highScore: localHighScore,
            maxWave: localMaxWave,
            server: selectedServer,
            settings
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSyncMessage(`Synced! Server-time: ${new Date(result.syncedAt).toLocaleTimeString()}`);
        fetchLeaderboard();
      } else {
        setSyncMessage("Cloud sync failed.");
      }
    } catch (e) {
      setSyncMessage("Offline or server unavailable.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(""), 5000);
    }
  };

  // Cloud restore handler
  const handleCloudRestore = async () => {
    const cleanName = charName.trim();
    if (!cleanName) {
      setSyncMessage("Error: Name required!");
      return;
    }
    setIsSyncing(true);
    setSyncMessage("Retrieving profile...");
    playSfx("click");

    try {
      const response = await fetch(`/api/sync?username=${encodeURIComponent(cleanName)}`);
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          const { progress } = result.data;
          // Restore to local storage
          localStorage.setItem(`zex_high_score_${cleanName}`, String(progress.highScore || 0));
          localStorage.setItem(`zex_max_wave_${cleanName}`, String(progress.maxWave || 1));
          if (progress.settings) {
            onUpdateSettings(progress.settings);
          }
          setSyncMessage("Sync Loaded successfully!");
        } else {
          setSyncMessage("No cloud profile found.");
        }
      } else {
        setSyncMessage("Failed to connect.");
      }
    } catch (e) {
      setSyncMessage("Offline or server error.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(""), 5000);
    }
  };

  return (
    <div className="absolute inset-0 z-40 bg-[#050505] flex flex-col p-6 md:p-12 text-white font-mono overflow-y-auto selection:bg-orange-500 selection:text-black">
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            filter: drop-shadow(0 0 5px #ff4e00);
            text-shadow: 0 0 10px rgba(255, 78, 0, 0.5);
          }
          50% {
            filter: drop-shadow(0 0 25px #9d4edd);
            text-shadow: 0 0 25px rgba(157, 78, 221, 0.8);
          }
        }
        .btn-zex {
          background: #111;
          border: 2px solid #ff4e00;
          color: #ff4e00;
          transition: all 0.25s ease-in-out;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .btn-zex:hover:not(:disabled) {
          background: #ff4e00;
          color: #000;
          box-shadow: 0 0 20px #ff4e00;
          transform: translateY(-1px);
        }
        .btn-zex:active:not(:disabled) {
          transform: translateY(1px);
        }
        .retro-input {
          background: #0d0d0d;
          border: 1px solid #333;
          padding: 12px;
          color: #ff4e00;
          outline: none;
          transition: all 0.2s;
        }
        .retro-input:focus {
          border-color: #ff4e00;
          box-shadow: 0 0 8px rgba(255, 78, 0, 0.2);
        }
      `}</style>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row gap-8 justify-between max-w-7xl mx-auto w-full">
        
        {/* Left Side: Game Title, Hero Setup, Core Settings */}
        <div className="flex-1 flex flex-col justify-center min-w-[320px] max-w-xl">
          <div className="mb-4">
            <h1
              className="text-8xl md:text-9xl font-black italic tracking-tighter text-white select-none inline-block mb-1"
              style={{ animation: "pulse-glow 4s infinite" }}
            >
              ZEX
            </h1>
            <div className="text-[10px] text-gray-500 tracking-[0.4em] uppercase">
              2D PIXEL ACTION SYSTEM // DX-01
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-[#222] mb-6">
            <button
              onClick={() => { playSfx("click"); setActiveTab("setup"); }}
              className={`pb-2 px-4 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === "setup" ? "border-b-2 border-orange-500 text-orange-500" : "text-gray-500 hover:text-white"
              }`}
            >
              Character Setup
            </button>
            <button
              onClick={() => { playSfx("click"); setActiveTab("settings"); }}
              className={`pb-2 px-4 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === "settings" ? "border-b-2 border-orange-500 text-orange-500" : "text-gray-500 hover:text-white"
              }`}
            >
              System Config
            </button>
          </div>

          {/* TAB 1: CHARACTER SETUP */}
          {activeTab === "setup" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 flex items-center gap-2 mb-2 uppercase">
                  <Swords size={12} className="text-orange-500" />
                  Hero Identity Name
                </label>
                <input
                  type="text"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 16))}
                  placeholder="ENTER HERO NAME..."
                  className="w-full retro-input text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 flex items-center gap-2 mb-2 uppercase">
                  <Globe size={12} className="text-blue-400" />
                  Region / Server Instance
                </label>
                <select
                  value={selectedServer}
                  onChange={(e) => setSelectedServer(e.target.value)}
                  className="w-full retro-input text-sm cursor-pointer"
                >
                  <option value="Asia-East">ASIA-EAST (12ms)</option>
                  <option value="NA-West">NA-WEST (88ms)</option>
                  <option value="Europe-Central">EUROPE-CENTRAL (142ms)</option>
                  <option value="Solo Mode">VS AI / SOLO MODE</option>
                </select>
              </div>

              {/* Cloud Sync/Save panel */}
              <div className="p-4 border border-[#222] bg-[#090909] rounded">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1.5">
                    <RefreshCw size={10} className={isSyncing ? "animate-spin text-orange-500" : "text-gray-400"} />
                    Cloud Backup & Restore
                  </span>
                  {syncMessage && <span className="text-[9px] text-orange-500 animate-pulse">{syncMessage}</span>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCloudSync}
                    disabled={isSyncing}
                    className="py-2 px-3 bg-[#111] hover:bg-orange-950/40 border border-[#333] hover:border-orange-500/50 text-[10px] uppercase font-semibold text-gray-300 rounded transition-all cursor-pointer"
                  >
                    Sync Backup
                  </button>
                  <button
                    onClick={handleCloudRestore}
                    disabled={isSyncing}
                    className="py-2 px-3 bg-[#111] hover:bg-orange-950/40 border border-[#333] hover:border-orange-500/50 text-[10px] uppercase font-semibold text-gray-300 rounded transition-all cursor-pointer"
                  >
                    Restore Cloud
                  </button>
                </div>
              </div>

              <button
                onClick={handleLaunch}
                className="btn-zex w-full py-5 font-bold text-lg mt-4 rounded shadow-lg flex items-center justify-center gap-2"
              >
                <Zap size={18} />
                LAUNCH GAME
              </button>
            </div>
          )}

          {/* TAB 2: SYSTEM CONFIG / SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    const next = !settings.sfxEnabled;
                    playSfx("click");
                    onUpdateSettings({ ...settings, sfxEnabled: next });
                  }}
                  className={`p-4 border rounded flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    settings.sfxEnabled
                      ? "bg-orange-950/20 border-orange-500 text-orange-500"
                      : "bg-[#0d0d0d] border-[#222] text-gray-500"
                  }`}
                >
                  {settings.sfxEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                  <span className="text-xs uppercase font-bold">Sound SFX</span>
                </button>

                <button
                  onClick={() => {
                    playSfx("click");
                    onUpdateSettings({ ...settings, bgmEnabled: !settings.bgmEnabled });
                  }}
                  className={`p-4 border rounded flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    settings.bgmEnabled
                      ? "bg-purple-950/20 border-purple-500 text-purple-500"
                      : "bg-[#0d0d0d] border-[#222] text-gray-500"
                  }`}
                >
                  {settings.bgmEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                  <span className="text-xs uppercase font-bold">Ambient BGM</span>
                </button>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-400 uppercase mb-2">
                  <span className="flex items-center gap-1"><Sliders size={12} /> Screen Brightness</span>
                  <span>{Math.round(settings.brightness * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={settings.brightness}
                  onChange={(e) => onUpdateSettings({ ...settings, brightness: parseFloat(e.target.value) })}
                  className="w-full accent-orange-500 cursor-pointer h-1.5 bg-[#222] rounded-lg appearance-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 flex items-center gap-2 mb-2 uppercase">
                  <Shield size={12} className="text-orange-500" />
                  Battle Difficulty level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Easy", "Medium", "Hard"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        playSfx("click");
                        onUpdateSettings({ ...settings, difficulty: d });
                      }}
                      className={`py-3 text-xs uppercase font-bold border rounded transition-all cursor-pointer ${
                        settings.difficulty === d
                          ? "bg-orange-500 text-black border-orange-500 shadow-[0_0_12px_rgba(255,78,0,0.4)]"
                          : "bg-[#0d0d0d] border-[#222] text-gray-500 hover:text-white"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => { playSfx("click"); setActiveTab("setup"); }}
                className="w-full py-3 border border-[#333] hover:border-orange-500/50 text-xs text-gray-400 hover:text-white uppercase font-bold rounded transition-all cursor-pointer"
              >
                Back to character setup
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Real-time Leaderboard & Patch Panel */}
        <div className="w-full lg:w-[420px] flex flex-col gap-4">
          
          {/* Live Real-time Leaderboard */}
          <div className="p-5 border border-[#222] bg-[#0a0a0a] rounded flex-1 flex flex-col min-h-[300px]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#222]">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Real-Time World Leaderboard
              </span>
              <span className="text-[9px] text-gray-500 uppercase">Live polling</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[300px]">
              {leaderboard.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-gray-600 uppercase py-12">
                  <RefreshCw className="animate-spin mb-2" size={14} /> Loading Rankings...
                </div>
              ) : (
                leaderboard.map((entry, index) => {
                  let medalColor = "text-gray-500";
                  if (index === 0) medalColor = "text-yellow-400 font-extrabold";
                  if (index === 1) medalColor = "text-gray-300 font-bold";
                  if (index === 2) medalColor = "text-amber-600 font-bold";

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between text-xs py-2 px-3 border border-[#111] bg-[#0d0d0d] hover:bg-[#111] rounded transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 text-center ${medalColor}`}>#{index + 1}</span>
                        <span className="font-bold truncate text-gray-300 max-w-[120px]">{entry.name}</span>
                        <span className="text-[9px] text-gray-500 bg-[#1a1a1a] px-1.5 py-0.5 rounded uppercase">
                          {entry.heroClass}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-orange-500 font-bold text-[11px]">{entry.score.toLocaleString()} pts</div>
                        <div className="text-[9px] text-gray-600">WAVE {entry.wave} ({entry.server})</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* v0.84 - The Reckoning Change Logs */}
          <div className="p-4 border border-[#222] bg-[#0a0a0a] rounded">
            <h3 className="text-orange-500 text-xs font-bold mb-3 uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-orange-500"></span>
              v0.84 - The Reckoning Update
            </h3>
            <ul className="text-[10px] text-gray-400 space-y-1.5 uppercase leading-normal">
              <li>• Optimization on grid-tiled "Reck" battle zone map</li>
              <li>• Procedural 60 FPS pixel-art drawing engine</li>
              <li>• High-tier synthesis sound nodes for SFX & BGM</li>
              <li>• Multi-device cloud sync via Express API integration</li>
            </ul>
          </div>
        </div>

      </div>

      {/* Footer Details */}
      <div className="mt-8 border-t border-[#111] pt-4 max-w-7xl mx-auto w-full flex flex-col sm:flex-row justify-between items-center text-[10px] text-gray-600 gap-2">
        <div>SYS_ENGINE: RES_PREVIEW_READY_V2 // VERT_DENSE</div>
        <div className="flex gap-4 uppercase">
          <span>Server status: <span className="text-green-500">ONLINE</span></span>
          <span>Version: DX-9221-A STABLE</span>
        </div>
      </div>
    </div>
  );
}
