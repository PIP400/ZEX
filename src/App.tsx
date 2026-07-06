import React, { useState, useEffect } from "react";
import Splash from "./components/Splash";
import Menu from "./components/Menu";
import HeroSelect from "./components/HeroSelect";
import GameCanvas from "./components/GameCanvas";
import { ScreenType, GameSettings, HeroClass } from "./types";
import { startBgm, stopBgm, updateSoundSettings } from "./sound";

export default function App() {
  const [screen, setScreen] = useState<ScreenType>("splash");
  const [playerName, setPlayerName] = useState("Aric_Pro");
  const [server, setServer] = useState("Asia-East");
  const [selectedHero, setSelectedHero] = useState<HeroClass | null>(null);

  // Default global game configuration settings
  const [settings, setSettings] = useState<GameSettings>({
    sfxEnabled: true,
    bgmEnabled: true,
    brightness: 1.0,
    difficulty: "Medium"
  });

  // Track settings updating
  const handleUpdateSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    updateSoundSettings(newSettings);
  };

  // Start background synth-ambient BGM on user interaction/menu screen
  useEffect(() => {
    if (screen === "menu" || screen === "game") {
      startBgm();
    } else {
      stopBgm();
    }
    return () => stopBgm();
  }, [screen]);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none">
      {screen === "splash" && (
        <Splash
          onComplete={() => {
            setScreen("menu");
          }}
        />
      )}

      {screen === "menu" && (
        <Menu
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onLaunch={(name, srv) => {
            setPlayerName(name);
            setServer(srv);
            setScreen("select");
          }}
        />
      )}

      {screen === "select" && (
        <HeroSelect
          onSelect={(hero) => {
            setSelectedHero(hero);
            setScreen("game");
          }}
          onBack={() => {
            setScreen("menu");
          }}
        />
      )}

      {screen === "game" && selectedHero && (
        <GameCanvas
          playerName={playerName}
          server={server}
          heroClass={selectedHero}
          settings={settings}
          onExit={() => {
            setScreen("menu");
          }}
        />
      )}
    </div>
  );
}
