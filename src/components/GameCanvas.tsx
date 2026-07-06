import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { playSfx, updateSoundSettings } from "../sound";
import {
  GameSettings,
  PlayerStats,
  Vector2D,
  GameProjectile,
  GameParticle,
  FloatingText,
  ActiveAoE,
  BossEnemy,
  LootItem,
  HeroClass
} from "../types";
import { Shield, Zap, Heart, RotateCcw, Volume2, VolumeX, AlertTriangle, Play, HelpCircle } from "lucide-react";

interface GameCanvasProps {
  playerName: string;
  server: string;
  heroClass: HeroClass;
  settings: GameSettings;
  onExit: () => void;
}

export default function GameCanvas({ playerName, server, heroClass, settings, onExit }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // React-level stats for HUD display
  const [playerHp, setPlayerHp] = useState(500);
  const [playerMaxHp, setPlayerMaxHp] = useState(500);
  const [playerMp, setPlayerMp] = useState(1000);
  const [playerMaxMp, setPlayerMaxMp] = useState(1000);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [waveComplete, setWaveComplete] = useState(false);
  const [intermissionTime, setIntermissionTime] = useState(0);
  const [waveStatusText, setWaveStatusText] = useState("WAVE 1 ACTIVE");

  // Show a mini controls tooltip helper
  const [showTooltip, setShowTooltip] = useState(true);

  // Skill cooldown overlays (cooldown fractions, 0 is ready, 1 is fully on cooldown)
  const [cooldowns, setCooldowns] = useState({ Z: 0, X: 0, C: 0, V: 0 });

  // For touch joystick rendering on mobile
  const [isMobile, setIsMobile] = useState(false);
  const touchStartRef = useRef<Vector2D | null>(null);
  const touchCurRef = useRef<Vector2D | null>(null);
  const [joystickActive, setJoystickActive] = useState(false);

  // Brightness filter from settings
  const brightnessStyle = { filter: `brightness(${settings.brightness})` };

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Main gameplay execution ref to pass variables into canvas loop
  const stateRef = useRef({
    // Player
    x: 512,
    y: 450,
    vx: 0,
    vy: 0,
    hp: 500,
    maxHp: 500,
    mp: 1000,
    maxMp: 1000,
    score: 0,
    wave: 1,
    speed: 5.0,
    damageBase: 80,
    passiveStacks: 0,
    stealthActive: false,
    stealthTimer: 0,
    invincibleTimer: 0,
    dashCooldown: 0,
    // Cool skill specific tracking states
    archerGatlingCount: 0,
    archerGatlingTimer: 0,
    archerDecoy: null as { x: number; y: number; life: number; maxLife: number } | null,
    rogueDeathMarkTarget: null as BossEnemy | null,
    rogueDeathMarkDamage: 0,
    rogueDeathMarkTimer: 0,
    shadowStrikeTimer: 0,
    // Input state
    keys: {} as Record<string, boolean>,
    // Game loops / collections
    projectiles: [] as GameProjectile[],
    particles: [] as GameParticle[],
    texts: [] as FloatingText[],
    aoes: [] as ActiveAoE[],
    bosses: [] as BossEnemy[],
    drops: [] as LootItem[],
    screenShake: 0,
    // Cooldown timers
    cdZ: 0,
    cdX: 0,
    cdC: 0,
    cdV: 0,
    // Wave systems
    intermission: 0, // seconds
    waveCleared: false,
    bossSpawned: false,
    mobSpawnTimer: 0,
    isDead: false
  });

  const damageBossRef = useRef<((boss: BossEnemy, amt: number) => void) | null>(null);

  // Setup initial hero stat adjustments
  useEffect(() => {
    const s = stateRef.current;
    if (heroClass === "Warrior") {
      s.hp = 650; s.maxHp = 650;
      s.mp = 400; s.maxMp = 400;
      s.speed = 4.5; s.damageBase = 75;
    } else if (heroClass === "Archer") {
      s.hp = 450; s.maxHp = 450;
      s.mp = 600; s.maxMp = 600;
      s.speed = 6.0; s.damageBase = 85;
    } else if (heroClass === "Mage") {
      s.hp = 380; s.maxHp = 380;
      s.mp = 1000; s.maxMp = 1000;
      s.speed = 4.2; s.damageBase = 95;
    } else if (heroClass === "Rogue") {
      s.hp = 480; s.maxHp = 480;
      s.mp = 500; s.maxMp = 500;
      s.speed = 6.8; s.damageBase = 90;
    }
    setPlayerHp(s.hp);
    setPlayerMaxHp(s.maxHp);
    setPlayerMp(s.mp);
    setPlayerMaxMp(s.maxMp);
  }, [heroClass]);

  // Handle Keyboard Inputs
  useEffect(() => {
    const s = stateRef.current;
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      s.keys[key] = true;

      // Prevent scrolling with arrows/spacebar
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key)) {
        e.preventDefault();
      }

      // Hotkey casting
      if (key === "z") triggerSkill("Z");
      if (key === "x") triggerSkill("X");
      if (key === "c") triggerSkill("C");
      if (key === "v") triggerSkill("V");
      if (e.key === " " || key === "spacebar") triggerBasicAttack();
      if (e.key === "Shift") triggerDash();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      s.keys[key] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [heroClass, settings]);

  // Trigger Skills
  // Helper to find nearest enemy
  const getNearestEnemy = () => {
    const s = stateRef.current;
    if (!s.bosses || s.bosses.length === 0) return null;
    let nearest = null;
    let minDist = Infinity;
    s.bosses.forEach(boss => {
      const bdx = boss.x - s.x;
      const bdy = boss.y - s.y;
      const dist = Math.sqrt(bdx * bdx + bdy * bdy);
      if (dist < minDist) {
        minDist = dist;
        nearest = boss;
      }
    });
    return nearest;
  };

  const triggerBasicAttack = () => {
    const s = stateRef.current;
    if (s.isDead) return;
    
    // Quick cooldown or check
    if (s.cdZ > 0) return;
    s.cdZ = 12; // 0.2s cooldown
    playSfx("shoot");

    // Passive boosts & shadow modifiers
    let dmg = s.damageBase;
    if (heroClass === "Warrior") {
      s.passiveStacks = Math.min(s.passiveStacks + 1, 5);
      dmg = Math.round(dmg * (1 + s.passiveStacks * 0.02));
    }
    if (heroClass === "Rogue") {
      if (s.stealthActive) {
        dmg = Math.round(dmg * 1.8); // shadow ambush strike!
        s.stealthActive = false;
        addTextEffect(s.x, s.y - 20, "AMBUSH BACKSTAB!", "#eab308");
      }
      if (s.shadowStrikeTimer > 0) {
        dmg = Math.round(dmg * 1.5); // shadow strike active
      }
    }

    // Auto Aim Nearest Enemy
    const targetEnemy = getNearestEnemy();
    let dx = 0; let dy = 0;

    if (targetEnemy) {
      dx = targetEnemy.x - s.x;
      dy = targetEnemy.y - s.y;
    } else {
      // Fallback: player input keys or active joystick movement
      if (s.keys["w"] || s.keys["arrowup"]) dy = -1;
      if (s.keys["s"] || s.keys["arrowdown"]) dy = 1;
      if (s.keys["a"] || s.keys["arrowleft"]) dx = -1;
      if (s.keys["d"] || s.keys["arrowright"]) dx = 1;
      if (joystickActive && touchStartRef.current && touchCurRef.current) {
        const jdx = touchCurRef.current.x - touchStartRef.current.x;
        const jdy = touchCurRef.current.y - touchStartRef.current.y;
        if (Math.sqrt(jdx * jdx + jdy * jdy) > 5) {
          dx = jdx;
          dy = jdy;
        }
      }
      if (dx === 0 && dy === 0) dx = 1; // Default facing direction right
    }

    const length = Math.sqrt(dx * dx + dy * dy);
    const vx = (dx / length) * 12;
    const vy = (dy / length) * 12;
    const baseAngle = Math.atan2(vy, vx);

    // Spawn Player Projectile with class-specific distinct traits
    if (heroClass === "Warrior") {
      // Sweeping Runic Blade Crescent
      s.projectiles.push({
        id: Math.random().toString(),
        x: s.x,
        y: s.y,
        vx,
        vy,
        radius: 18,
        damage: dmg,
        isEnemy: false,
        color: "#f87171",
        trail: [],
        life: 0,
        maxLife: 40,
        type: "blade"
      });
      // Blade sparks VFX
      for (let i = 0; i < 3; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * 0.4;
        s.particles.push({
          x: s.x, y: s.y,
          vx: Math.cos(angle) * (5 + Math.random() * 3),
          vy: Math.sin(angle) * (5 + Math.random() * 3),
          color: "#fee2e2", radius: 2.5, alpha: 1, life: 0, maxLife: 15, decay: 0.06
        });
      }
    } else if (heroClass === "Archer") {
      // Seeking Wind Arrow: Piercing wind-arrows with green trail
      s.projectiles.push({
        id: Math.random().toString(),
        x: s.x,
        y: s.y,
        vx: vx * 1.35,
        vy: vy * 1.35,
        radius: 7,
        damage: dmg,
        isEnemy: false,
        color: "#34d399",
        trail: [],
        life: 0,
        maxLife: 45,
        type: "arrow"
      });
    } else if (heroClass === "Mage") {
      // Prismatic Arcane Orb: Slow-moving heavy energy bolt that homes in
      s.projectiles.push({
        id: Math.random().toString(),
        x: s.x,
        y: s.y,
        vx: vx * 0.9,
        vy: vy * 0.9,
        radius: 10,
        damage: dmg,
        isEnemy: false,
        color: "#c084fc",
        trail: [],
        life: 0,
        maxLife: 55,
        type: "bullet"
      });
    } else if (heroClass === "Rogue") {
      // Dual Fan of Poison Daggers: Fires 2 daggers in a tight cone
      [-0.15, 0.15].forEach(offset => {
        const rVx = Math.cos(baseAngle + offset) * 14;
        const rVy = Math.sin(baseAngle + offset) * 14;
        s.projectiles.push({
          id: Math.random().toString(),
          x: s.x,
          y: s.y,
          vx: rVx,
          vy: rVy,
          radius: 6,
          damage: Math.round(dmg * 0.85),
          isEnemy: false,
          color: "#fbbf24",
          trail: [],
          life: 0,
          maxLife: 35,
          type: "bullet"
        });
      });
    }
  };

  const triggerDash = () => {
    const s = stateRef.current;
    if (s.isDead || s.dashCooldown > 0) return;
    s.dashCooldown = 60; // 1 second cooldown
    playSfx("dash");

    // Vector direction
    let dx = 0; let dy = 0;
    if (s.keys["w"] || s.keys["arrowup"]) dy = -1;
    if (s.keys["s"] || s.keys["arrowdown"]) dy = 1;
    if (s.keys["a"] || s.keys["arrowleft"]) dx = -1;
    if (s.keys["d"] || s.keys["arrowright"]) dx = 1;
    if (joystickActive && touchStartRef.current && touchCurRef.current) {
      const jdx = touchCurRef.current.x - touchStartRef.current.x;
      const jdy = touchCurRef.current.y - touchStartRef.current.y;
      if (Math.sqrt(jdx * jdx + jdy * jdy) > 5) {
        dx = jdx;
        dy = jdy;
      }
    }
    if (dx === 0 && dy === 0) dx = 1; // Default forward

    const len = Math.sqrt(dx * dx + dy * dy);
    s.x += (dx / len) * 95;
    s.y += (dy / len) * 95;

    // Bounds constraint
    s.x = Math.max(30, Math.min(994, s.x));
    s.y = Math.max(65, Math.min(700, s.y));

    // Dash trail VFX
    for (let i = 0; i < 20; i++) {
      s.particles.push({
        x: s.x - (dx / len) * (i * 4.5),
        y: s.y - (dy / len) * (i * 4.5),
        vx: (Math.random() - 0.5) * 2.5,
        vy: (Math.random() - 0.5) * 2.5,
        color: heroClass === "Warrior" ? "rgba(239, 68, 68, 0.45)" : heroClass === "Archer" ? "rgba(16, 185, 129, 0.45)" : heroClass === "Mage" ? "rgba(6, 182, 212, 0.45)" : "rgba(234, 179, 8, 0.45)",
        radius: 4,
        alpha: 1,
        life: 0,
        maxLife: 25,
        decay: 0.04
      });
    }

    if (heroClass === "Rogue") {
      s.stealthActive = true;
      s.stealthTimer = 180; // 3 seconds stealth
      addTextEffect(s.x, s.y - 25, "STEALTH ACTIVE (AMBUSH!)", "#eab308");
    }
  };

  const triggerSkill = (key: "Z" | "X" | "C" | "V") => {
    const s = stateRef.current;
    if (s.isDead) return;

    let manaCost = 0;
    let cdMax = 0;

    if (key === "Z") {
      triggerBasicAttack();
      return;
    }

    if (key === "X") {
      manaCost = heroClass === "Mage" ? 35 : 25;
      cdMax = 90; // 1.5 seconds
      if (s.mp < manaCost) { addTextEffect(s.x, s.y - 30, "NO MANA", "#3b82f6"); return; }
      if (s.cdX > 0) return;

      s.mp -= manaCost;
      s.cdX = cdMax;
      playSfx("spell");

      // CAST SKILL 2 (X)
      if (heroClass === "Warrior") {
        // Aegis Shield Charge: Invulnerable charge forward slamming enemies + orbit fire waves
        s.invincibleTimer = 45;
        let tx = 0; let ty = 0;
        const target = getNearestEnemy();
        if (target) {
          tx = target.x - s.x;
          ty = target.y - s.y;
        } else {
          tx = 1; ty = 0;
        }
        const len = Math.sqrt(tx*tx + ty*ty);
        
        // Move player
        s.x += (tx / len) * 160;
        s.y += (ty / len) * 160;
        s.x = Math.max(30, Math.min(994, s.x));
        s.y = Math.max(65, Math.min(700, s.y));

        addTextEffect(s.x, s.y - 30, "AEGIS CHARGE!", "#ef4444");

        // Fire blazing crescents at target area
        const baseAngle = Math.atan2(ty, tx);
        [-0.45, 0, 0.45].forEach(offset => {
          const vx = Math.cos(baseAngle + offset) * 13;
          const vy = Math.sin(baseAngle + offset) * 13;
          s.projectiles.push({
            id: Math.random().toString(),
            x: s.x, y: s.y,
            vx, vy, radius: 24, damage: s.damageBase * 1.8,
            isEnemy: false, color: "#ef4444",
            trail: [], life: 0, maxLife: 35, type: "blade"
          });
        });

        // Lava particles
        for (let i = 0; i < 20; i++) {
          const ang = Math.random() * Math.PI * 2;
          s.particles.push({
            x: s.x, y: s.y,
            vx: Math.cos(ang) * (2 + Math.random() * 5),
            vy: Math.sin(ang) * (2 + Math.random() * 5),
            color: "#ea580c", radius: 4, alpha: 1, life: 0, maxLife: 25, decay: 0.04
          });
        }
      } else if (heroClass === "Archer") {
        // Gatling Spirit Volley: Stream of 10 rapid-fire seeking arrows
        s.archerGatlingCount = 10;
        s.archerGatlingTimer = 0;
        addTextEffect(s.x, s.y - 30, "GATLING FURY!", "#10b981");
      } else if (heroClass === "Mage") {
        // Glacial Frostbite Nova: Freeze boss in absolute ice block for 2.5 seconds + Spawns Ice Spikes
        addTextEffect(s.x, s.y - 30, "GLACIAL NOVA!", "#06b6d4");
        
        s.aoes.push({
          id: Math.random().toString(),
          x: s.x, y: s.y,
          radius: 170, color: "rgba(6, 182, 212, 0.25)",
          damage: s.damageBase * 2.0, life: 0, maxLife: 60,
          isEnemy: false, label: "GLACIAL NOVA"
        });

        // Freeze and spike bosses
        s.bosses.forEach(boss => {
          boss.freezeTimer = 150; // 2.5 seconds frozen!
          boss.state = "hurt";
          
          // Spawn Ice spike directly under them
          s.projectiles.push({
            id: Math.random().toString(),
            x: boss.x, y: boss.y + 15,
            vx: 0, vy: -1.5, radius: 28, damage: s.damageBase * 1.7,
            isEnemy: false, color: "#38bdf8",
            trail: [], life: 0, maxLife: 20, type: "blade"
          });
        });

        // Frost particles
        for (let i = 0; i < 35; i++) {
          const ang = Math.random() * Math.PI * 2;
          s.particles.push({
            x: s.x, y: s.y,
            vx: Math.cos(ang) * (2 + Math.random() * 5),
            vy: Math.sin(ang) * (2 + Math.random() * 5),
            color: "#99f6e4", radius: 3, alpha: 1, life: 0, maxLife: 30, decay: 0.03
          });
        }
      } else if (heroClass === "Rogue") {
        // Shadowstep Assassinate: Instant teleport behind target, massive 3.5x critical backstab, grant strike buff
        const target = getNearestEnemy();
        if (target) {
          const dx = s.x - target.x;
          const dy = s.y - target.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          // Teleport behind
          const offsetDist = 55;
          s.x = target.x + (dx / dist) * offsetDist;
          s.y = target.y + (dy / dist) * offsetDist;
          s.x = Math.max(30, Math.min(994, s.x));
          s.y = Math.max(65, Math.min(700, s.y));

          // Critical blow
          if (damageBossRef.current) damageBossRef.current(target, s.damageBase * 3.5);
          s.shadowStrikeTimer = 180; // 3 seconds 1.5x speed/damage boost

          addTextEffect(target.x, target.y - 40, "ASSASSINATE! CRIT 350%", "#fbbf24");
          playSfx("dash");

          // Slash slice circle
          s.aoes.push({
            id: Math.random().toString(),
            x: target.x, y: target.y,
            radius: 95, color: "rgba(245, 158, 11, 0.35)",
            damage: 0, life: 0, maxLife: 20,
            isEnemy: false, label: "SHADOW CLAW"
          });

          // Phantom purple shadows
          for (let i = 0; i < 20; i++) {
            const ang = Math.random() * Math.PI * 2;
            s.particles.push({
              x: s.x, y: s.y,
              vx: Math.cos(ang) * (2 + Math.random() * 5),
              vy: Math.sin(ang) * (2 + Math.random() * 5),
              color: "#a855f7", radius: 3.5, alpha: 1, life: 0, maxLife: 25, decay: 0.04
            });
          }
        } else {
          addTextEffect(s.x, s.y - 30, "NO TARGET IN SIGHT", "#fbbf24");
        }
      }
    }

    if (key === "C") {
      manaCost = heroClass === "Mage" ? 60 : 45;
      cdMax = 240; // 4 seconds
      if (s.mp < manaCost) { addTextEffect(s.x, s.y - 30, "NO MANA", "#3b82f6"); return; }
      if (s.cdC > 0) return;

      s.mp -= manaCost;
      s.cdC = cdMax;
      playSfx("spell");

      // CAST SKILL 3 (C)
      if (heroClass === "Warrior") {
        // Abyssal Volcanic Whirlwind: spinning vortex centered on player pulling enemies into blade ticks
        addTextEffect(s.x, s.y - 30, "VOLCANIC VORTEX!", "#f97316");
        
        s.aoes.push({
          id: Math.random().toString(),
          x: s.x, y: s.y,
          radius: 175, color: "rgba(249, 115, 22, 0.3)",
          damage: s.damageBase * 3.3, life: 0, maxLife: 100, // active ~1.7s
          isEnemy: false, label: "VOLCANIC VORTEX"
        });
      } else if (heroClass === "Archer") {
        // Windrunner Decoy Roll: swift roll backwards, leaving a green holographic decoy to taunt & explode
        let dx = 0; let dy = 0;
        if (s.keys["w"] || s.keys["arrowup"]) dy = 1;
        if (s.keys["s"] || s.keys["arrowdown"]) dy = -1;
        if (s.keys["a"] || s.keys["arrowleft"]) dx = 1;
        if (s.keys["d"] || s.keys["arrowright"]) dx = -1;
        if (dx === 0 && dy === 0) dx = -1; // back-left roll default

        const len = Math.sqrt(dx*dx + dy*dy);
        const rollDist = 160;

        const decoyX = s.x;
        const decoyY = s.y;

        // roll player
        s.x += (dx / len) * rollDist;
        s.y += (dy / len) * rollDist;
        s.x = Math.max(30, Math.min(994, s.x));
        s.y = Math.max(65, Math.min(700, s.y));

        s.invincibleTimer = 45; // roll iframe
        addTextEffect(s.x, s.y - 30, "DECOY WIND ROLL!", "#10b981");

        // Spawn Decoy
        s.archerDecoy = {
          x: decoyX,
          y: decoyY,
          life: 0,
          maxLife: 120 // 2 seconds decoy active
        };

        // Decoy moss particles
        for (let i = 0; i < 15; i++) {
          const ang = Math.random() * Math.PI * 2;
          s.particles.push({
            x: decoyX, y: decoyY,
            vx: Math.cos(ang) * (1.5 + Math.random() * 4),
            vy: Math.sin(ang) * (1.5 + Math.random() * 4),
            color: "#34d399", radius: 3, alpha: 1, life: 0, maxLife: 30, decay: 0.04
          });
        }
      } else if (heroClass === "Mage") {
        // Blink & Astral Singularity Blackhole: Blinks mage, leaves gravity singularity sucking enemies
        let dx = 0; let dy = 0;
        if (s.keys["w"] || s.keys["arrowup"]) dy = -1;
        if (s.keys["s"] || s.keys["arrowdown"]) dy = 1;
        if (s.keys["a"] || s.keys["arrowleft"]) dx = -1;
        if (s.keys["d"] || s.keys["arrowright"]) dx = 1;
        if (dx === 0 && dy === 0) dx = 1;

        const len = Math.sqrt(dx*dx + dy*dy);
        const origX = s.x;
        const origY = s.y;

        // Teleport Mage
        s.x += (dx / len) * 250;
        s.y += (dy / len) * 250;
        s.x = Math.max(30, Math.min(994, s.x));
        s.y = Math.max(65, Math.min(700, s.y));

        s.invincibleTimer = 25;
        addTextEffect(s.x, s.y - 30, "AETHER BLINK!", "#a855f7");

        // Spawn Singularity Blackhole
        s.aoes.push({
          id: Math.random().toString(),
          x: origX, y: origY,
          radius: 150, color: "rgba(124, 58, 237, 0.35)",
          damage: s.damageBase * 2.8, life: 0, maxLife: 120, // 2 seconds
          isEnemy: false, label: "ASTRAL SINGULARITY"
        });

        // Void particle sparkles
        for (let i = 0; i < 20; i++) {
          const ang = Math.random() * Math.PI * 2;
          s.particles.push({
            x: origX, y: origY,
            vx: Math.cos(ang) * (1.5 + Math.random() * 4.5),
            vy: Math.sin(ang) * (1.5 + Math.random() * 4.5),
            color: "#d8b4fe", radius: 3, alpha: 1, life: 0, maxLife: 25, decay: 0.05
          });
        }
      } else if (heroClass === "Rogue") {
        // Venom Searing Pool: Throws flask creating toxic zone slowing + releasing 4 target seeking spore missiles
        addTextEffect(s.x, s.y - 30, "VENOM BOMB!", "#22c55e");
        
        const target = getNearestEnemy();
        let tx = s.x + 150;
        let ty = s.y;
        if (target) {
          tx = target.x;
          ty = target.y;
        }

        // Spawn Toxic puddle AoE
        s.aoes.push({
          id: Math.random().toString(),
          x: tx, y: ty,
          radius: 135, color: "rgba(34, 197, 94, 0.3)",
          damage: s.damageBase * 2.6, life: 0, maxLife: 150, // 2.5 seconds
          isEnemy: false, label: "VENOM SEARING POOL"
        });

        // Slow bosses inside puddle
        s.bosses.forEach(boss => {
          const dx = boss.x - tx;
          const dy = boss.y - ty;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 135) {
            boss.slowTimer = 150; // slow boss for 2.5 seconds
          }
        });

        // Spawn 4 poison seeking spores in swamp
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2;
          s.projectiles.push({
            id: Math.random().toString(),
            x: tx + Math.cos(ang) * 40,
            y: ty + Math.sin(ang) * 40,
            vx: Math.cos(ang) * 3.5, vy: Math.sin(ang) * 3.5,
            radius: 10, damage: s.damageBase * 0.9,
            isEnemy: false, color: "#4ade80",
            trail: [], life: 0, maxLife: 90, type: "poison"
          });
        }
      }
    }

    if (key === "V") {
      // Ultimate V - MASSIVE DESTRUCTION
      manaCost = heroClass === "Mage" ? 180 : 120;
      cdMax = 600; // 10 seconds
      if (s.mp < manaCost) { addTextEffect(s.x, s.y - 30, "NO MANA", "#3b82f6"); return; }
      if (s.cdV > 0) return;

      s.mp -= manaCost;
      s.cdV = cdMax;
      playSfx("spell");
      s.screenShake = 35;

      // CAST ULTIMATE (V)
      if (heroClass === "Warrior") {
        // Ragnarok Blade Storm: Massive sword pillars exploding fissure
        const target = getNearestEnemy();
        const tx = target ? target.x : s.x;
        const ty = target ? target.y : s.y;

        addTextEffect(s.x, s.y - 40, "RAGNAROK BLADE STORM!!!", "#ef4444");

        s.aoes.push({
          id: Math.random().toString(),
          x: tx, y: ty,
          radius: 245, color: "rgba(239, 68, 68, 0.45)",
          damage: s.damageBase * 6.5, life: 0, maxLife: 180, // 3 seconds active
          isEnemy: false, label: "RAGNAROK BLADE STORM"
        });

        // Staggered sword drops VFX
        for (let i = 0; i < 8; i++) {
          setTimeout(() => {
            if (s.isDead) return;
            s.screenShake = 18;
            const rX = tx + (Math.random() - 0.5) * 200;
            const rY = ty + (Math.random() - 0.5) * 200;
            // Spawn explosion shards
            for (let j = 0; j < 15; j++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 3.5 + Math.random() * 6;
              s.particles.push({
                x: rX, y: rY,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
                color: "#f87171", radius: 5.5, alpha: 1, life: 0, maxLife: 25, decay: 0.04
              });
            }
          }, i * 220);
        }
      } else if (heroClass === "Archer") {
        // Celestial Starfall Volley: emerald shower covering multiple sectors
        const target = getNearestEnemy();
        const tx = target ? target.x : s.x;
        const ty = target ? target.y : s.y;

        addTextEffect(s.x, s.y - 40, "STARFALL CELESTIAL VOLLEY!!!", "#10b981");

        s.aoes.push({
          id: Math.random().toString(),
          x: tx, y: ty,
          radius: 225, color: "rgba(16, 185, 129, 0.4)",
          damage: s.damageBase * 5.8, life: 0, maxLife: 150,
          isEnemy: false, label: "CELESTIAL STARFALL"
        });

        // Sky arrow torrent raining down
        for (let i = 0; i < 20; i++) {
          const offsetAngle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 155;
          s.projectiles.push({
            id: Math.random().toString(),
            x: tx + Math.cos(offsetAngle) * dist,
            y: ty - 320 - Math.random() * 100, // fall from high top
            vx: (Math.random() - 0.5) * 2.5, vy: 14 + Math.random() * 4,
            radius: 8, damage: s.damageBase * 1.0,
            isEnemy: false, color: "#34d399",
            trail: [], life: 0, maxLife: 60, type: "arrow"
          });
        }
      } else if (heroClass === "Mage") {
        // Armageddon Meteor Storm: diagonal massive celestial meteor with continuous scorch
        const target = getNearestEnemy();
        const tx = target ? target.x : s.x;
        const ty = target ? target.y : s.y;

        addTextEffect(s.x, s.y - 40, "ARMAGEDDON METEOR STORM!!!", "#a855f7");

        s.aoes.push({
          id: Math.random().toString(),
          x: tx, y: ty,
          radius: 255, color: "rgba(168, 85, 247, 0.45)",
          damage: s.damageBase * 7.5, life: 0, maxLife: 150,
          isEnemy: false, label: "ARMAGEDDON METEOR"
        });

        // Giant slow fireball
        s.projectiles.push({
          id: Math.random().toString(),
          x: tx - 320, y: ty - 420,
          vx: 6.4, vy: 8.4, radius: 48, damage: s.damageBase * 3.5,
          isEnemy: false, color: "#c084fc",
          trail: [], life: 0, maxLife: 50, type: "bullet"
        });

        // Exploding star dust particles
        for (let i = 0; i < 45; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 2 + Math.random() * 9;
          s.particles.push({
            x: tx, y: ty,
            vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
            color: "#d8b4fe", radius: 5, alpha: 1, life: 0, maxLife: 35, decay: 0.03
          });
        }
      } else if (heroClass === "Rogue") {
        // Death Mark Reaper Execute: marks the target, tracks all damage, summons spectral reaper scythe execute!
        const target = getNearestEnemy();
        if (target) {
          addTextEffect(s.x, s.y - 40, "DEATH MARK EXECUTOR!!!", "#fbbf24");
          
          target.deathMarked = true;
          target.deathMarkDamage = 0;
          
          s.rogueDeathMarkTarget = target;
          s.rogueDeathMarkDamage = 0;
          s.rogueDeathMarkTimer = 150; // 2.5 seconds to accumulate damage

          s.aoes.push({
            id: Math.random().toString(),
            x: target.x, y: target.y,
            radius: 140, color: "rgba(251, 191, 36, 0.4)",
            damage: 0, life: 0, maxLife: 150,
            isEnemy: false, label: "DEATH MARK SECURING"
          });
        } else {
          addTextEffect(s.x, s.y - 30, "NO TARGET FOR EXECUTE", "#fbbf24");
        }
      }
    }
  };

  // Add floaty damage text
  const addTextEffect = (x: number, y: number, text: string, color: string) => {
    stateRef.current.texts.push({
      id: Math.random().toString(),
      x, y, text, color, life: 0, maxLife: 60, vy: -1.2
    });
  };

  // Process game setup and render loop
  useEffect(() => {
    const s = stateRef.current;
    s.isDead = false;
    setIsGameOver(false);
    setWaveComplete(false);
    
    // Bind outer ref
    damageBossRef.current = (boss, amt) => {
      damageBoss(boss, amt);
    };

    // Spawn Wave 1 Boss
    spawnWaveBoss(1);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number;

    const render = () => {
      // 1. CLEAR CANVAS
      ctx.fillStyle = "#040404";
      ctx.fillRect(0, 0, 1024, 768);

      // Handle screen shake viewport shift
      ctx.save();
      if (s.screenShake > 0) {
        const dx = (Math.random() - 0.5) * s.screenShake;
        const dy = (Math.random() - 0.5) * s.screenShake;
        ctx.translate(dx, dy);
        s.screenShake *= 0.9;
        if (s.screenShake < 0.5) s.screenShake = 0;
      }

      // 2. DRAW VOLCANIC RUNIC TILEMAP (The "Reck" Map Grid)
      ctx.strokeStyle = "#120805";
      ctx.lineWidth = 1;
      for (let i = 0; i < 1024; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 768); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke();
      }

      // Draw hot lava rivers boundaries and visual glowing accents
      ctx.fillStyle = "rgba(255, 60, 0, 0.12)";
      ctx.fillRect(0, 718, 1024, 50); // Lava pit bottom
      ctx.fillRect(0, 0, 1024, 40);  // Lava pit top

      // Lava glowing lines
      ctx.strokeStyle = "rgba(255, 78, 0, 0.4)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 718); ctx.lineTo(1024, 718);
      ctx.moveTo(0, 40); ctx.lineTo(1024, 40);
      ctx.stroke();

      // Ambient decorative burning runes in corners
      ctx.fillStyle = "rgba(157, 78, 221, 0.25)";
      ctx.font = "bold 14px monospace";
      ctx.fillText("[ RECK_ZONE_A ]", 64, 90);
      ctx.fillText("[ VOLCANIC_GRID ]", 800, 90);

      // Draw beautiful magic ritual circle in the center
      ctx.strokeStyle = "rgba(255, 78, 0, 0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(512, 384, 180, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(512, 384, 100, 0, Math.PI * 2);
      ctx.stroke();

      // 3. UPDATE PLAYER PHYSICS
      let ax = 0; let ay = 0;
      if (s.keys["w"] || s.keys["arrowup"]) ay = -1;
      if (s.keys["s"] || s.keys["arrowdown"]) ay = 1;
      if (s.keys["a"] || s.keys["arrowleft"]) ax = -1;
      if (s.keys["d"] || s.keys["arrowright"]) ax = 1;

      // Handle touch joystick override
      if (joystickActive && touchStartRef.current && touchCurRef.current) {
        const dx = touchCurRef.current.x - touchStartRef.current.x;
        const dy = touchCurRef.current.y - touchStartRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          ax = dx / dist;
          ay = dy / dist;
        }
      }

      if (ax !== 0 || ay !== 0) {
        const len = Math.sqrt(ax * ax + ay * ay);
        s.vx = (ax / len) * s.speed;
        s.vy = (ay / len) * s.speed;
      } else {
        s.vx *= 0.6; // decelerate smoothly
        s.vy *= 0.6;
      }

      if (!s.isDead) {
        s.x += s.vx;
        s.y += s.vy;
      }

      // Keep within play arena map limits (away from top/bottom lava boundaries)
      s.x = Math.max(30, Math.min(994, s.x));
      s.y = Math.max(65, Math.min(700, s.y));

      // Timers tick
      if (s.cdZ > 0) s.cdZ--;
      if (s.cdX > 0) s.cdX--;
      if (s.cdC > 0) s.cdC--;
      if (s.cdV > 0) s.cdV--;
      if (s.dashCooldown > 0) s.dashCooldown--;
      if (s.invincibleTimer > 0) s.invincibleTimer--;
      if (s.stealthTimer > 0) {
        s.stealthTimer--;
        if (s.stealthTimer === 0) s.stealthActive = false;
      }
      if (s.shadowStrikeTimer > 0) s.shadowStrikeTimer--;

      // Archer Gatling spirit arrows ticks
      if (s.archerGatlingCount > 0) {
        s.archerGatlingTimer--;
        if (s.archerGatlingTimer <= 0) {
          s.archerGatlingTimer = 5; // shoot every 5 frames
          s.archerGatlingCount--;
          playSfx("shoot");

          const target = getNearestEnemy();
          let adx = 1; let ady = 0;
          if (target) {
            adx = target.x - s.x;
            ady = target.y - s.y;
          } else {
            adx = s.vx !== 0 ? s.vx : 1;
            ady = s.vy !== 0 ? s.vy : 0;
          }
          const alen = Math.sqrt(adx*adx + ady*ady);
          s.projectiles.push({
            id: Math.random().toString(),
            x: s.x, y: s.y,
            vx: (adx / alen) * 16, vy: (ady / alen) * 16,
            radius: 8, damage: Math.round(s.damageBase * 0.75),
            isEnemy: false, color: "#10b981",
            trail: [], life: 0, maxLife: 50, type: "arrow"
          });
        }
      }

      // Archer Decoy Clone tick and explosive burst
      if (s.archerDecoy) {
        s.archerDecoy.life++;
        
        // Render decoy clone (translucent holographic green clone)
        ctx.save();
        ctx.translate(s.archerDecoy.x, s.archerDecoy.y);
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.15;
        ctx.shadowColor = "#10b981";
        ctx.shadowBlur = 12;
        
        // Drawing green ranger hood
        ctx.fillStyle = "#16a34a";
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#15803d";
        ctx.fillRect(-8, -16, 16, 8); // hood top
        
        ctx.restore();

        if (s.archerDecoy.life >= s.archerDecoy.maxLife) {
          // Trigger explosion!
          s.screenShake = 15;
          playSfx("spell");
          s.aoes.push({
            id: Math.random().toString(),
            x: s.archerDecoy.x, y: s.archerDecoy.y,
            radius: 160, color: "rgba(16, 185, 129, 0.45)",
            damage: s.damageBase * 4.2, life: 0, maxLife: 45,
            isEnemy: false, label: "DECOY DETONATION"
          });
          
          // Green explosive sparks
          for (let i = 0; i < 25; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 3 + Math.random() * 6;
            s.particles.push({
              x: s.archerDecoy.x, y: s.archerDecoy.y,
              vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
              color: "#34d399", radius: 4, alpha: 1, life: 0, maxLife: 20, decay: 0.05
            });
          }
          s.archerDecoy = null;
        }
      }

      // Rogue Death Mark accumulative executor tick
      if (s.rogueDeathMarkTimer > 0) {
        s.rogueDeathMarkTimer--;
        
        if (s.rogueDeathMarkTimer <= 0 && s.rogueDeathMarkTarget) {
          const target = s.rogueDeathMarkTarget;
          // Trigger Grim Reaper execute!
          s.screenShake = 25;
          playSfx("spell");

          const executeDmg = Math.round(s.damageBase * 3.5 + s.rogueDeathMarkDamage * 0.65);
          damageBoss(target, executeDmg);
          addTextEffect(target.x, target.y - 60, `REAPER EXECUTE! -${executeDmg}`, "#f59e0b");

          // Draw Giant spinning yellow scythe visual
          s.aoes.push({
            id: Math.random().toString(),
            x: target.x, y: target.y,
            radius: 200, color: "rgba(245, 158, 11, 0.5)",
            damage: 0, life: 0, maxLife: 35,
            isEnemy: false, label: "REAPER SLICE"
          });

          // Golden sparks
          for (let i = 0; i < 30; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 4 + Math.random() * 8;
            s.particles.push({
              x: target.x, y: target.y,
              vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
              color: "#fbbf24", radius: 4.5, alpha: 1, life: 0, maxLife: 25, decay: 0.04
            });
          }

          // Unmark target
          target.deathMarked = false;
          target.deathMarkDamage = 0;
          s.rogueDeathMarkTarget = null;
        }
      }

      // Sync React Cooldown gauges
      setCooldowns({
        Z: s.cdZ / 12,
        X: s.cdX / 90,
        C: s.cdC / 240,
        V: s.cdV / 600
      });

      // Passive heal/mana ticks
      if (s.mp < s.maxMp && !s.isDead) {
        s.mp = Math.min(s.maxMp, s.mp + 1.2); // regenerate mana gradually
        setPlayerMp(Math.round(s.mp));
      }

      // 4. DRAW LOOT DROPS
      s.drops.forEach((drop, dIdx) => {
        // pick up on collision
        const dx = s.x - drop.x;
        const dy = s.y - drop.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 32 && !s.isDead) {
          playSfx("pickup");
          if (drop.type === "heal") {
            s.hp = Math.min(s.maxHp, s.hp + 250);
            setPlayerHp(s.hp);
            addTextEffect(s.x, s.y, "+250 HP", "#22c55e");
          } else if (drop.type === "mana") {
            s.mp = Math.min(s.maxMp, s.mp + 500);
            setPlayerMp(s.mp);
            addTextEffect(s.x, s.y, "+500 MANA", "#3b82f6");
          } else {
            s.score += 500;
            setScore(s.score);
            addTextEffect(s.x, s.y, "+500 PTS", "#eab308");
          }
          s.drops.splice(dIdx, 1);
          return;
        }

        // Draw potion drop procedurally
        ctx.save();
        ctx.translate(drop.x, drop.y);
        ctx.shadowColor = drop.color;
        ctx.shadowBlur = 10;

        // Shiny circle background
        ctx.fillStyle = drop.color;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();

        // Potion bottle cap
        ctx.fillStyle = "#fff";
        ctx.fillRect(-3, -14, 6, 4);

        ctx.restore();
      });

      // 5. DRAW ACTIVE AOE SPELLS (Whirlwind, Meteor circles, Rain Arrows)
      s.aoes.forEach((aoe, aIdx) => {
        aoe.life++;
        
        // Draw AoE circle
        ctx.strokeStyle = aoe.color;
        ctx.lineWidth = 3;
        ctx.fillStyle = aoe.color.replace("0.2", "0.05").replace("0.35", "0.08");
        ctx.beginPath();
        ctx.arc(aoe.x, aoe.y, aoe.radius * (aoe.life / aoe.maxLife), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Deal damage to enemies in range
        if (!aoe.isEnemy) {
          // Vacuum pull logic for Volcanic Vortex and Gravity Singularity
          if (aoe.label === "VOLCANIC VORTEX" || aoe.label === "ASTRAL SINGULARITY") {
            s.bosses.forEach(boss => {
              const bdx = aoe.x - boss.x;
              const bdy = aoe.y - boss.y;
              const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
              if (bdist > 12 && bdist < aoe.radius * 1.55) {
                const pullFactor = (boss.freezeTimer && boss.freezeTimer > 0) ? 0.8 : 2.6;
                boss.x += (bdx / bdist) * pullFactor;
                boss.y += (bdy / bdist) * pullFactor;
              }
            });
          }

          s.bosses.forEach(boss => {
            const bdx = boss.x - aoe.x;
            const bdy = boss.y - aoe.y;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
            if (bdist < aoe.radius + boss.radius && aoe.life % 10 === 0) {
              damageBoss(boss, aoe.damage / 10);
            }
          });
        } else {
          // Hurt player
          const pdx = s.x - aoe.x;
          const pdy = s.y - aoe.y;
          const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pdist < aoe.radius + 18 && aoe.life % 12 === 0) {
            damagePlayer(aoe.damage / 10);
          }
        }

        if (aoe.life >= aoe.maxLife) {
          s.aoes.splice(aIdx, 1);
        }
      });

      // 6. DRAW AND UPDATE PROJECTILES
      s.projectiles.forEach((proj, pIdx) => {
        proj.life++;

        // Homing behavior for player projectiles
        if (!proj.isEnemy && s.bosses && s.bosses.length > 0) {
          let target = null;
          let minDist = Infinity;
          s.bosses.forEach(boss => {
            const bdx = boss.x - proj.x;
            const bdy = boss.y - proj.y;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
            if (bdist < minDist) {
              minDist = bdist;
              target = boss;
            }
          });

          if (target && minDist < 450) { // Seek nearest boss within range
            const tdx = target.x - proj.x;
            const tdy = target.y - proj.y;
            const tlen = Math.sqrt(tdx * tdx + tdy * tdy);
            const curSpeed = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);
            
            // Curve toward boss smoothly
            const steerStrength = 0.12; 
            const targetVx = (tdx / tlen) * curSpeed;
            const targetVy = (tdy / tlen) * curSpeed;

            proj.vx = proj.vx * (1 - steerStrength) + targetVx * steerStrength;
            proj.vy = proj.vy * (1 - steerStrength) + targetVy * steerStrength;
          }
        }

        proj.x += proj.vx;
        proj.y += proj.vy;

        // Trace particles
        if (proj.life % 2 === 0) {
          s.particles.push({
            x: proj.x, y: proj.y,
            vx: (Math.random() - 0.5) * 1, vy: (Math.random() - 0.5) * 1,
            color: proj.color, radius: 2.5, alpha: 0.8, life: 0, maxLife: 15, decay: 0.06
          });
        }

        // Draw projectile type
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.fillStyle = proj.color;

        if (proj.type === "arrow") {
          // Arrow drawing
          ctx.rotate(Math.atan2(proj.vy, proj.vx));
          ctx.fillRect(-12, -1.5, 24, 3);
          ctx.beginPath();
          ctx.moveTo(12, -4); ctx.lineTo(20, 0); ctx.lineTo(12, 4);
          ctx.fill();
        } else if (proj.type === "blade") {
          // Slashing wave crescent
          ctx.rotate(Math.atan2(proj.vy, proj.vx));
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius, -Math.PI / 2, Math.PI / 2, false);
          ctx.lineWidth = 4;
          ctx.strokeStyle = proj.color;
          ctx.stroke();
        } else if (proj.type === "skull") {
          // Dark skull
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(-5, 4, 10, 5);
          ctx.fillStyle = "#000";
          ctx.fillRect(-3, -2, 2, 2);
          ctx.fillRect(1, -2, 2, 2);
        } else {
          // standard magic bullet sphere
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Hit tests
        if (!proj.isEnemy) {
          // Hit boss
          s.bosses.forEach(boss => {
            const dx = boss.x - proj.x;
            const dy = boss.y - proj.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < boss.radius + proj.radius) {
              damageBoss(boss, proj.damage);
              s.projectiles.splice(pIdx, 1);
              return;
            }
          });
        } else {
          // Hit player
          const dx = s.x - proj.x;
          const dy = s.y - proj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 18 + proj.radius) {
            damagePlayer(proj.damage);
            s.projectiles.splice(pIdx, 1);
            return;
          }
        }

        // Out of life bounds
        if (proj.life >= proj.maxLife || proj.x < 0 || proj.x > 1024 || proj.y < 0 || proj.y > 768) {
          s.projectiles.splice(pIdx, 1);
        }
      });

      // 7. DRAW AND UPDATE BOSS ENEMIES
      s.bosses.forEach((boss, bIdx) => {
        boss.animTime++;
        if (boss.flashDuration > 0) boss.flashDuration--;

        // Ticks for freezing and poison slowing
        if (boss.freezeTimer && boss.freezeTimer > 0) boss.freezeTimer--;
        if (boss.slowTimer && boss.slowTimer > 0) boss.slowTimer--;

        // Target redirection: Decoy clone has absolute priority taunt!
        let targetX = s.x;
        let targetY = s.y;
        if (s.archerDecoy) {
          targetX = s.archerDecoy.x;
          targetY = s.archerDecoy.y;
        }

        const dx = targetX - boss.x;
        const dy = targetY - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Movement updates governed by freezing status
        if (boss.freezeTimer && boss.freezeTimer > 0) {
          boss.state = "hurt";
          boss.vx = 0;
          boss.vy = 0;
        } else {
          let currentSpeed = boss.speed;
          if (boss.slowTimer && boss.slowTimer > 0) {
            currentSpeed *= 0.45; // 55% speed slow down!
          }

          if (dist > 110 && !s.isDead) {
            boss.state = "walking";
            boss.vx = (dx / dist) * currentSpeed;
            boss.vy = (dy / dist) * currentSpeed;
          } else {
            boss.state = "idle";
            boss.vx *= 0.8;
            boss.vy *= 0.8;
          }
        }

        boss.x += boss.vx;
        boss.y += boss.vy;

        // Keep boss on the map boundaries
        boss.x = Math.max(boss.radius, Math.min(1024 - boss.radius, boss.x));
        boss.y = Math.max(65 + boss.radius, Math.min(700 - boss.radius, boss.y));

        // Shoots custom projectiles (blocked if frozen!)
        if (boss.freezeTimer && boss.freezeTimer > 0) {
          // Cooldown freezes!
        } else {
          boss.shootCooldown--;
        }
        if (boss.shootCooldown <= 0 && !s.isDead) {
          boss.shootCooldown = boss.type === "LichKing" ? 75 : 110;
          playSfx("shoot");

          if (boss.type === "Dragon") {
            // Shoots 3 fireball projectiles spread out
            const baseAngle = Math.atan2(dy, dx);
            [-0.3, 0, 0.3].forEach(off => {
              const vx = Math.cos(baseAngle + off) * 7;
              const vy = Math.sin(baseAngle + off) * 7;
              s.projectiles.push({
                id: Math.random().toString(),
                x: boss.x, y: boss.y,
                vx, vy, radius: 10, damage: boss.damage * 0.8,
                isEnemy: true, color: "#f97316",
                trail: [], life: 0, maxLife: 120, type: "fireball"
              });
            });
          } else {
            // Lich King: Shoots target seeking skull missiles
            const angle = Math.atan2(dy, dx);
            s.projectiles.push({
              id: Math.random().toString(),
              x: boss.x, y: boss.y,
              vx: Math.cos(angle) * 6.5, vy: Math.sin(angle) * 6.5,
              radius: 9, damage: boss.damage * 1.2,
              isEnemy: true, color: "#a855f7",
              trail: [], life: 0, maxLife: 150, type: "skull"
            });
          }
        }

        // Ultimate skill cast AoE warnings
        if (boss.freezeTimer && boss.freezeTimer > 0) {
          // Cooldown freezes!
        } else {
          boss.specialCooldown--;
        }
        if (boss.specialCooldown <= 0 && !s.isDead) {
          boss.specialCooldown = boss.type === "LichKing" ? 220 : 300;
          s.screenShake = 12;

          if (boss.type === "Dragon") {
            // Summons Meteor AoE zone on player
            addTextEffect(boss.x, boss.y - 40, "BOSS: LAVA METEOR!", "#ef4444");
            s.aoes.push({
              id: Math.random().toString(),
              x: s.x, y: s.y,
              radius: 140, color: "rgba(239, 68, 68, 0.3)",
              damage: boss.damage * 2.5, life: 0, maxLife: 90,
              isEnemy: true, label: "METEOR BURST"
            });
          } else {
            // Lich King: Summons void death circle
            addTextEffect(boss.x, boss.y - 40, "BOSS: DEATH VORTEX!", "#a855f7");
            s.aoes.push({
              id: Math.random().toString(),
              x: s.x, y: s.y,
              radius: 150, color: "rgba(168, 85, 247, 0.3)",
              damage: boss.damage * 2.8, life: 0, maxLife: 100,
              isEnemy: true, label: "DEATH VORTEX"
            });
          }
        }

        // Draw Boss Sprite Procedurally
        ctx.save();
        ctx.translate(boss.x, boss.y);

        // Flash red if recently hit
        if (boss.flashDuration > 0) {
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.arc(0, 0, boss.radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const breathe = Math.sin(boss.animTime * 0.08) * 4;

          // Draw procedural Pixel Boss shape
          ctx.shadowColor = boss.color;
          ctx.shadowBlur = 15;

          if (boss.type === "Dragon") {
            // Render Dragon
            // Body
            ctx.fillStyle = "#991b1b";
            ctx.beginPath();
            ctx.arc(0, breathe, boss.radius - 5, 0, Math.PI * 2);
            ctx.fill();
            // Horns & head details
            ctx.fillStyle = "#ef4444";
            ctx.fillRect(-15, -45 + breathe, 8, 25);
            ctx.fillRect(8, -45 + breathe, 8, 25);
            // Spikes
            ctx.fillStyle = "#ea580c";
            ctx.fillRect(-22, -15 + breathe, 6, 6);
            ctx.fillRect(16, -15 + breathe, 6, 6);
            // Wings
            ctx.fillStyle = "#7f1d1d";
            ctx.beginPath();
            ctx.moveTo(-25, breathe);
            ctx.lineTo(-65, -30 + breathe);
            ctx.lineTo(-45, 10 + breathe);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(25, breathe);
            ctx.lineTo(65, -30 + breathe);
            ctx.lineTo(45, 10 + breathe);
            ctx.fill();
          } else {
            // Render Lich King Crown and Cape
            ctx.fillStyle = "#3b0764";
            ctx.beginPath();
            ctx.arc(0, breathe, boss.radius - 8, 0, Math.PI * 2);
            ctx.fill();
            // Golden crown
            ctx.fillStyle = "#eab308";
            ctx.fillRect(-12, -35 + breathe, 5, 15);
            ctx.fillRect(-4, -40 + breathe, 8, 20);
            ctx.fillRect(8, -35 + breathe, 5, 15);
            // Cape
            ctx.fillStyle = "#1e1b4b";
            ctx.fillRect(-20, breathe, 40, 30);
            // Dark staff glow
            ctx.fillStyle = "#a855f7";
            ctx.beginPath();
            ctx.arc(28, breathe, 8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();

        // Render Ice stun block if frozen
        if (boss.freezeTimer && boss.freezeTimer > 0) {
          ctx.save();
          ctx.translate(boss.x, boss.y);
          ctx.fillStyle = "rgba(14, 165, 233, 0.35)";
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 3.5;
          ctx.shadowColor = "#0ea5e9";
          ctx.shadowBlur = 15;
          // Outer ice cube outline
          ctx.beginPath();
          ctx.rect(-boss.radius - 6, -boss.radius - 6, boss.radius * 2 + 12, boss.radius * 2 + 12);
          ctx.fill();
          ctx.stroke();
          // Diagonal ice shards cracks
          ctx.strokeStyle = "#e0f2fe";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-boss.radius, -boss.radius); ctx.lineTo(boss.radius, boss.radius);
          ctx.moveTo(boss.radius, -boss.radius); ctx.lineTo(-boss.radius, boss.radius);
          ctx.stroke();
          ctx.restore();
        }

        // Render Poison slime puddle below if slowed
        if (boss.slowTimer && boss.slowTimer > 0) {
          ctx.save();
          ctx.translate(boss.x, boss.y);
          ctx.fillStyle = "rgba(34, 197, 94, 0.45)";
          ctx.beginPath();
          ctx.arc(0, boss.radius - 5, boss.radius * 0.75, 0, Math.PI);
          ctx.fill();
          ctx.restore();
        }

        // Render Death Mark indicator on top
        if (boss.deathMarked) {
          ctx.save();
          ctx.translate(boss.x, boss.y - boss.radius - 34);
          ctx.shadowColor = "#f59e0b";
          ctx.shadowBlur = 12;
          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 13px monospace";
          ctx.textAlign = "center";
          ctx.fillText("💀 DEATH MARKED", 0, 0);
          ctx.restore();
        }

        // Draw Boss Floating Name and Health bar above
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(boss.name.toUpperCase(), boss.x, boss.y - boss.radius - 16);

        // HP bar red layout
        const barW = 100;
        const barH = 5;
        const hpPct = Math.max(0, boss.hp / boss.maxHp);
        ctx.fillStyle = "#111";
        ctx.fillRect(boss.x - barW / 2, boss.y - boss.radius - 10, barW, barH);
        ctx.fillStyle = boss.color;
        ctx.fillRect(boss.x - barW / 2, boss.y - boss.radius - 10, barW * hpPct, barH);
      });

      // 8. DRAW PLAYER CHARACTER
      if (!s.isDead) {
        ctx.save();
        ctx.translate(s.x, s.y);

        // Alpha if stealthed
        if (s.stealthActive) ctx.globalAlpha = 0.4;

        // Flash red if recently hit
        if (s.invincibleTimer > 0 && s.invincibleTimer % 4 < 2) {
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Dynamic pixel-art scaling or wiggle breathing animations
          const scaleW = 1 + Math.sin(Date.now() / 150) * 0.05;
          const scaleH = 1 - Math.sin(Date.now() / 150) * 0.05;
          ctx.scale(scaleW, scaleH);

          // Hero Class Procedural Outfits
          if (heroClass === "Warrior") {
            // Warrior shield and red cape
            ctx.fillStyle = "#ef4444"; // cape
            ctx.fillRect(-15, 0, 30, 20);
            ctx.fillStyle = "#475569"; // armor slate
            ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#ea580c"; // golden shield
            ctx.fillRect(10, -5, 6, 12);
          } else if (heroClass === "Archer") {
            // Archer green robes and bow
            ctx.fillStyle = "#15803d"; // hood
            ctx.beginPath(); ctx.arc(0, -2, 14, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#b45309"; // recurve bow arc
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#b45309";
            ctx.beginPath(); ctx.arc(12, 0, 8, -Math.PI/2, Math.PI/2); ctx.stroke();
          } else if (heroClass === "Mage") {
            // Mage purple wizard robes and staff
            ctx.fillStyle = "#6b21a8"; // robes
            ctx.fillRect(-12, -4, 24, 22);
            ctx.beginPath(); ctx.arc(0, -6, 12, 0, Math.PI * 2); ctx.fill();
            // Golden wand with glowing staff orb
            ctx.fillStyle = "#b45309";
            ctx.fillRect(11, -12, 3, 25);
            ctx.fillStyle = "#a855f7";
            ctx.beginPath(); ctx.arc(12.5, -15, 5, 0, Math.PI * 2); ctx.fill();
          } else if (heroClass === "Rogue") {
            // Rogue dual dark daggers and hood
            ctx.fillStyle = "#0f172a"; // dark stealth suit
            ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#eab308"; // dual daggers
            ctx.fillRect(10, -8, 2, 8);
            ctx.fillRect(-12, -8, 2, 8);
          }
        }
        ctx.restore();

        // Draw Player name indicator above
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(playerName.toUpperCase(), s.x, s.y - 25);
      }

      // 9. DRAW FLOATING DAMAGE TEXTS
      s.texts.forEach((text, tIdx) => {
        text.life++;
        text.y += text.vy;

        ctx.fillStyle = text.color;
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(text.text, text.x, text.y);

        if (text.life >= text.maxLife) {
          s.texts.splice(tIdx, 1);
        }
      });

      // 10. PARTICLES SYSTEM
      s.particles.forEach((part, pIdx) => {
        part.life++;
        part.x += part.vx;
        part.y += part.vy;
        part.alpha -= part.decay;

        ctx.fillStyle = part.color;
        ctx.globalAlpha = Math.max(0, part.alpha);
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        if (part.life >= part.maxLife || part.alpha <= 0) {
          s.particles.splice(pIdx, 1);
        }
      });

      // 11. CHECK INTERMISSION PROGRESS
      if (s.waveCleared) {
        // Redraw intermission countdown timer
        if (s.intermission > 0) {
          ctx.fillStyle = "rgba(255, 78, 0, 0.15)";
          ctx.fillRect(0, 320, 1024, 128);

          ctx.strokeStyle = "#ff4e00";
          ctx.strokeRect(0, 320, 1024, 128);

          ctx.fillStyle = "#ff4e00";
          ctx.font = "900 24px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`WAVE ${s.wave - 1} CLEANSED!`, 512, 360);

          ctx.fillStyle = "#fff";
          ctx.font = "bold 13px monospace";
          ctx.fillText(`NEXT INVASION WAVE SPAWNS IN: ${Math.ceil(s.intermission)} SECONDS...`, 512, 395);
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.fillText("[ TAP / ENTER KEY TO SKIP COUNTDOWN ]", 512, 420);
        }
      }

      // Finalize frame render restore
      ctx.restore();

      if (!s.isDead) {
        animFrameId = requestAnimationFrame(render);
      }
    };

    // Damage player handler
    const damagePlayer = (amt: number) => {
      if (s.isDead || s.invincibleTimer > 0) return;
      playSfx("hurt");
      s.hp = Math.max(0, s.hp - amt);
      s.invincibleTimer = 35; // 0.6s invincibility frames
      s.screenShake = 15;
      setPlayerHp(Math.round(s.hp));

      // damage indicator numbers
      addTextEffect(s.x, s.y - 12, `-${Math.round(amt)}`, "#ef4444");

      if (s.hp <= 0) {
        s.isDead = true;
        s.vx = 0; s.vy = 0;
        setIsGameOver(true);
        triggerLeaderboardSubmit();
      }
    };

    // Damage boss handler
    const damageBoss = (boss: BossEnemy, amt: number) => {
      boss.hp = Math.max(0, boss.hp - amt);
      boss.flashDuration = 5; // flash red for 5 frames
      boss.state = "hurt";

      // Death Mark damage accumulation
      if (boss.deathMarked) {
        boss.deathMarkDamage = (boss.deathMarkDamage || 0) + amt;
        s.rogueDeathMarkDamage = (s.rogueDeathMarkDamage || 0) + amt;
        
        // Spawn glowing golden execution stars
        for (let i = 0; i < 2; i++) {
          s.particles.push({
            x: boss.x + (Math.random() - 0.5) * 40,
            y: boss.y + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -2 - Math.random() * 2,
            color: "#fbbf24", radius: 2.5, alpha: 1, life: 0, maxLife: 20, decay: 0.05
          });
        }
      }

      // damage indicator text
      addTextEffect(boss.x, boss.y - boss.radius, `-${Math.round(amt)}`, boss.deathMarked ? "#fbbf24" : "#ff8800");

      if (boss.hp <= 0) {
        // Kill boss!
        playSfx("wave");
        s.screenShake = 30;

        // Splatter gold coins and potions
        for (let i = 0; i < 40; i++) {
          const angle = Math.random() * Math.PI * 2;
          const velocity = 2 + Math.random() * 8;
          s.particles.push({
            x: boss.x, y: boss.y,
            vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
            color: "#eab308", radius: 4, alpha: 1, life: 0, maxLife: 45, decay: 0.02
          });
        }

        // Spawn potions drops where boss died
        s.drops.push({
          id: Math.random().toString(),
          x: boss.x - 30, y: boss.y,
          radius: 12, type: "heal", color: "#22c55e", glowTime: 0
        });
        s.drops.push({
          id: Math.random().toString(),
          x: boss.x + 30, y: boss.y,
          radius: 12, type: "mana", color: "#3b82f6", glowTime: 0
        });

        // 3 loot items total
        s.drops.push({
          id: Math.random().toString(),
          x: boss.x, y: boss.y - 25,
          radius: 12, type: "gold", color: "#eab308", glowTime: 0
        });

        s.bosses = []; // Wipe bosses
        s.score += s.wave * 1500;
        setScore(s.score);

        // Advance wave sequence
        s.wave++;
        setWave(s.wave);
        s.waveCleared = true;
        setWaveComplete(true);
        s.intermission = 15; // Set 15-second intermission timer
        setIntermissionTime(s.intermission);
        setWaveStatusText(`WAVE ${s.wave - 1} CLEANSED`);
      }
    };

    // Intermission countdown ticks
    const clockInterval = setInterval(() => {
      if (s.waveCleared && s.intermission > 0) {
        s.intermission -= 1.0;
        setIntermissionTime(Math.ceil(s.intermission));
        if (s.intermission <= 0) {
          startNextWave();
        }
      }
    }, 1000);

    // Initial loop launch
    animFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId);
      clearInterval(clockInterval);
      damageBossRef.current = null;
    };
  }, [heroClass]);

  // Handle skip countdown trigger
  const handleSkipCountdown = () => {
    playSfx("click");
    startNextWave();
  };

  const startNextWave = () => {
    const s = stateRef.current;
    s.waveCleared = false;
    setWaveComplete(false);
    setWaveStatusText(`WAVE ${s.wave} ACTIVE`);
    spawnWaveBoss(s.wave);
  };

  // Wave Boss spawner
  const spawnWaveBoss = (waveNum: number) => {
    const s = stateRef.current;
    playSfx("spawn");

    // Boss attributes scale-up base difficulty modifier
    let diffMod = 1.0;
    if (settings.difficulty === "Easy") diffMod = 0.7;
    if (settings.difficulty === "Hard") diffMod = 1.45;

    // Boss hp scales per wave
    const isLich = waveNum % 2 === 0;
    const hpMax = Math.round((isLich ? 3500 : 2000) * (1 + (waveNum - 1) * 0.45) * diffMod);
    const bossDmg = Math.round((isLich ? 38 : 28) * (1 + (waveNum - 1) * 0.25) * diffMod);

    s.bosses.push({
      x: 512,
      y: 200,
      vx: 0, vy: 0,
      radius: isLich ? 38 : 46,
      hp: hpMax,
      maxHp: hpMax,
      damage: bossDmg,
      speed: isLich ? 2.5 : 2.0,
      color: isLich ? "#a855f7" : "#ef4444",
      state: "idle",
      animTime: 0,
      flashDuration: 0,
      shootCooldown: 60,
      specialCooldown: 150,
      name: isLich ? `Lich King Lv.${waveNum}` : `Elder Dragon Lv.${waveNum}`,
      type: isLich ? "LichKing" : "Dragon"
    });
  };

  // Submit highest score to local and backend DB
  const triggerLeaderboardSubmit = async () => {
    const s = stateRef.current;
    
    // Save locally
    const currentHigh = Number(localStorage.getItem(`zex_high_score_${playerName}`) || "0");
    if (s.score > currentHigh) {
      localStorage.setItem(`zex_high_score_${playerName}`, String(s.score));
      localStorage.setItem(`zex_max_wave_${playerName}`, String(s.wave));
    }

    try {
      await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playerName,
          heroClass,
          score: s.score,
          wave: s.wave,
          server
        })
      });
    } catch (e) {
      console.error("Leaderboard submit failed", e);
    }
  };

  // Virtual touch controls handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    touchStartRef.current = { x, y };
    touchCurRef.current = { x, y };
    setJoystickActive(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    touchCurRef.current = { x, y };
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    touchCurRef.current = null;
    setJoystickActive(false);
  };

  const getSkillName = (key: "DASH" | "STRIKE" | "X" | "C" | "V") => {
    const names: Record<string, Record<string, string>> = {
      Warrior: {
        DASH: "CHARGE",
        STRIKE: "CLEAVE",
        X: "AEGIS SHIELD",
        C: "VORTEX SPIN",
        V: "RAGNAROK",
      },
      Archer: {
        DASH: "WIND RUN",
        STRIKE: "GALE SHOT",
        X: "GATLING FURY",
        C: "DECOY ROLL",
        V: "STARFALL",
      },
      Mage: {
        DASH: "BLINK",
        STRIKE: "ARCANE BOLT",
        X: "FROST NOVA",
        C: "SINGULARITY",
        V: "METEOR SHOCK",
      },
      Rogue: {
        DASH: "SHADOWSTEP",
        STRIKE: "SPECTRAL",
        X: "ASSASSINATE",
        C: "VENOM BOMB",
        V: "DEATH MARK",
      },
    };
    return names[heroClass]?.[key] || key;
  };

  const btnThemeClass = 
    heroClass === "Warrior" ? "border-red-500/40 hover:shadow-[0_0_12px_rgba(239,68,68,0.4)] active:bg-red-500/30" :
    heroClass === "Archer" ? "border-emerald-500/40 hover:shadow-[0_0_12px_rgba(16,185,129,0.4)] active:bg-emerald-500/30" :
    heroClass === "Mage" ? "border-cyan-500/40 hover:shadow-[0_0_12px_rgba(6,182,212,0.4)] active:bg-cyan-500/30" :
    "border-amber-500/40 hover:shadow-[0_0_12px_rgba(245,158,11,0.4)] active:bg-amber-500/30";

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-black text-white font-mono flex flex-col items-center justify-center select-none overflow-hidden"
    >
      <style>{`
        .action-circle {
          width: 56px;
          height: 56px;
          background: rgba(10, 10, 10, 0.85);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          cursor: pointer;
          touch-action: none;
          transition: all 0.15s;
        }
        .action-circle:active {
          transform: scale(0.90);
        }
        .hp-gradient {
          background: linear-gradient(90deg, #b91c1c, #ef4444);
        }
        .mp-gradient {
          background: linear-gradient(90deg, #1d4ed8, #3b82f6);
        }
        .cd-mask {
          background: rgba(0, 0, 0, 0.65);
        }
      `}</style>

      {/* RENDER VIEWPORT CANVAS PORT */}
      <canvas
        ref={canvasRef}
        width="1024"
        height="768"
        style={brightnessStyle}
        className="w-full h-full object-contain bg-[#030303] border-4 border-[#121212] rounded shadow-[0_0_40px_rgba(0,0,0,0.8)]"
      ></canvas>

      {/* OVERLAY: RICH HUD DISPLAY CONTROLS */}
      <div className="absolute top-0 left-0 w-full p-4 md:p-6 flex justify-between items-start pointer-events-none z-10">
        
        {/* Left Side: Player HP/Mana Status */}
        <div className="flex gap-3 pointer-events-auto bg-black/60 p-3 rounded border border-white/5 backdrop-blur-sm">
          <div className="w-12 h-12 bg-orange-950/20 border-2 border-orange-500 rounded-sm flex flex-col items-center justify-center">
            <span className="text-[8px] text-gray-500 font-bold uppercase">{heroClass.slice(0, 3)}</span>
            <span className="text-sm font-black text-white">{playerName.slice(0, 2).toUpperCase()}</span>
          </div>

          <div className="w-48 md:w-56">
            <div className="flex justify-between text-[10px] mb-0.5 font-bold">
              <span className="text-gray-300">{playerName.toUpperCase()} [LV 1]</span>
              <span className="text-red-400 font-extrabold">{playerHp} / {playerMaxHp} HP</span>
            </div>
            {/* HP Bar */}
            <div className="h-3 bg-[#111] border border-[#222] rounded-sm overflow-hidden relative mb-1.5">
              <div
                className="h-full hp-gradient transition-all duration-150"
                style={{ width: `${Math.max(0, (playerHp / playerMaxHp) * 100)}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-[10px] mb-0.5 font-bold">
              <span className="text-blue-400">ARCANE MANA</span>
              <span className="text-blue-400 font-extrabold">{playerMp} / {playerMaxMp}</span>
            </div>
            {/* Mana Bar */}
            <div className="h-3 bg-[#111] border border-[#222] rounded-sm overflow-hidden relative">
              <div
                className="h-full mp-gradient transition-all duration-150"
                style={{ width: `${Math.max(0, (playerMp / playerMaxMp) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Right Side: Wave information & Score metrics */}
        <div className="text-right flex flex-col items-end bg-black/60 p-3 rounded border border-white/5 backdrop-blur-sm pointer-events-auto">
          <span className="text-[9px] text-gray-500 tracking-wider">MAP_ZONE: RECK_GRID_01</span>
          <span className="text-base md:text-lg font-black tracking-widest text-white mt-0.5">SCORE: {score.toLocaleString()}</span>
          <div className="mt-1.5 px-2.5 py-0.5 bg-red-950/50 border border-red-500/30 text-red-500 text-[9px] font-bold uppercase rounded-sm">
            {waveStatusText}
          </div>
        </div>

      </div>

      {/* KEYBOARD SHORTCUT HELPER BANNER (Bottom-Center PC controls) */}
      {!isMobile && showTooltip && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/80 border border-[#222] px-4 py-2 text-[10px] text-gray-400 rounded flex gap-4 uppercase font-bold z-10 pointer-events-auto">
          <span>WASD: Move</span>
          <span>Shift: Dash</span>
          <span>Space: Attack</span>
          <span>Z,X,C,V: Skills</span>
          <button onClick={() => setShowTooltip(false)} className="text-orange-500 hover:underline pl-2 border-l border-[#333]">Dismiss</button>
        </div>
      )}

      {/* MOBILE CONTROLS (Joystick Left + Action Buttons Right) */}
      {isMobile && (
        <div className="absolute inset-x-0 bottom-0 p-6 flex justify-between items-end pointer-events-none z-20">
          
          {/* Virtual Joystick Zone */}
          <div
            className="w-32 h-32 bg-white/5 border border-white/10 rounded-full flex items-center justify-center touch-none pointer-events-auto relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {joystickActive && touchStartRef.current && touchCurRef.current && (
              <div
                className="absolute w-12 h-12 bg-orange-500/30 border border-orange-500 rounded-full"
                style={{
                  left: `calc(50% - 24px + ${Math.max(-40, Math.min(40, touchCurRef.current.x - touchStartRef.current.x))}px)`,
                  top: `calc(50% - 24px + ${Math.max(-40, Math.min(40, touchCurRef.current.y - touchStartRef.current.y))}px)`
                }}
              ></div>
            )}
            <span className="text-[9px] text-gray-500 uppercase font-semibold">Drag Move</span>
          </div>

          {/* Action Tap Buttons Grid */}
          <div className="grid grid-cols-2 gap-3 pointer-events-auto">
            {/* Dash */}
            <button
              onTouchStart={(e) => { e.preventDefault(); triggerDash(); }}
              onClick={(e) => { e.preventDefault(); triggerDash(); }}
              className={`action-circle border-2 ${btnThemeClass}`}
            >
              <span className="text-[7px] text-gray-400 font-bold uppercase">SHIFT</span>
              <span className="text-[10px] font-black tracking-tighter">{getSkillName("DASH")}</span>
            </button>
            {/* Basic Attack */}
            <button
              onTouchStart={(e) => { e.preventDefault(); triggerBasicAttack(); }}
              onClick={(e) => { e.preventDefault(); triggerBasicAttack(); }}
              className={`action-circle border-2 ${btnThemeClass}`}
            >
              <span className="text-[7px] text-gray-400 font-bold uppercase">SPACE</span>
              <span className="text-[10px] font-black tracking-tighter">{getSkillName("STRIKE")}</span>
            </button>
            {/* Spell X */}
            <div className="relative">
              <button
                onTouchStart={(e) => { e.preventDefault(); triggerSkill("X"); }}
                onClick={(e) => { e.preventDefault(); triggerSkill("X"); }}
                className={`action-circle border-2 ${btnThemeClass}`}
              >
                <span className="text-[7px] text-gray-400 font-bold uppercase">KEY X</span>
                <span className="text-[9px] font-black tracking-tighter text-center px-1 leading-none">{getSkillName("X")}</span>
              </button>
              {cooldowns.X > 0 && (
                <div
                  className="absolute inset-0 rounded-full cd-mask flex items-center justify-center text-[10px] font-bold text-orange-500 pointer-events-none"
                  style={{ clipPath: `polygon(50% 50%, 50% 0%, ${cooldowns.X >= 0.125 ? "100% 0%," : ""} ${cooldowns.X >= 0.375 ? "100% 100%," : ""} ${cooldowns.X >= 0.625 ? "0% 100%," : ""} ${cooldowns.X >= 0.875 ? "0% 0%," : ""} 50% 0%)` }}
                ></div>
              )}
            </div>
            {/* Spell C */}
            <div className="relative">
              <button
                onTouchStart={(e) => { e.preventDefault(); triggerSkill("C"); }}
                onClick={(e) => { e.preventDefault(); triggerSkill("C"); }}
                className={`action-circle border-2 ${btnThemeClass}`}
              >
                <span className="text-[7px] text-gray-400 font-bold uppercase">KEY C</span>
                <span className="text-[9px] font-black tracking-tighter text-center px-1 leading-none">{getSkillName("C")}</span>
              </button>
              {cooldowns.C > 0 && (
                <div className="absolute inset-0 rounded-full cd-mask flex items-center justify-center text-[10px] font-bold text-orange-500 pointer-events-none"></div>
              )}
            </div>
            {/* Spell V Ultimate */}
            <div className="relative col-span-2">
              <button
                onTouchStart={(e) => { e.preventDefault(); triggerSkill("V"); }}
                onClick={(e) => { e.preventDefault(); triggerSkill("V"); }}
                className={`action-circle border-2 w-full rounded-lg ${btnThemeClass}`}
              >
                <span className="text-[7px] text-gray-400 font-bold uppercase">KEY V</span>
                <span className="text-[10px] font-black tracking-tighter text-center px-2 leading-none">{getSkillName("V")} [ULT]</span>
              </button>
              {cooldowns.V > 0 && (
                <div className="absolute inset-0 rounded-lg cd-mask flex items-center justify-center text-[10px] font-bold text-orange-500 pointer-events-none"></div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* OVERLAY: WAVE CLEARED INTERMISSION COUNTDOWN SKIPIFIER */}
      {waveComplete && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={handleSkipCountdown}
            className="px-6 py-3 bg-[#111] hover:bg-orange-500 border-2 border-orange-500 text-orange-500 hover:text-black font-extrabold text-xs uppercase tracking-widest rounded-sm transition-all cursor-pointer shadow-lg"
          >
            SKIP INTERMISSION & START WAVE
          </button>
        </div>
      )}

      {/* OVERLAY: GAME OVER SCREEN */}
      <AnimatePresence>
        {isGameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#050505]/95 flex flex-col items-center justify-center z-35 font-mono p-6"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="text-center max-w-md w-full border-2 border-red-900 bg-black/80 p-8 rounded shadow-2xl"
            >
              <AlertTriangle className="text-red-500 mx-auto mb-4" size={54} />
              <h2 className="text-4xl font-black italic tracking-tighter text-red-500 uppercase mb-1">
                HERO DEFEATED
              </h2>
              <p className="text-[10px] text-gray-500 tracking-wider uppercase mb-6">
                CLEANSED ZONE: RECK_MAP // LEVEL_1
              </p>

              {/* Score summary */}
              <div className="space-y-2 border-y border-red-950 py-4 mb-6">
                <div className="flex justify-between text-xs text-gray-400 uppercase">
                  <span>CHAMPION CLASS:</span>
                  <span className="text-white font-bold">{heroClass.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400 uppercase">
                  <span>WAVES SURVIVED:</span>
                  <span className="text-white font-bold">{wave - 1} WAVES</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400 uppercase">
                  <span>FINAL HIGH SCORE:</span>
                  <span className="text-orange-500 font-extrabold text-sm">{score.toLocaleString()} PTS</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    playSfx("click");
                    window.location.reload();
                  }}
                  className="py-4 px-6 bg-red-600 hover:bg-red-500 text-black font-black text-xs uppercase tracking-widest rounded transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} /> Play Again
                </button>
                <button
                  onClick={() => {
                    playSfx("click");
                    onExit();
                  }}
                  className="py-3 px-6 border border-[#222] hover:border-gray-500 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-widest rounded transition-all cursor-pointer"
                >
                  Return to Menu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
