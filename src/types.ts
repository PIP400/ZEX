export type ScreenType = "splash" | "menu" | "select" | "game" | "gameover";

export type HeroClass = "Warrior" | "Archer" | "Mage" | "Rogue";

export interface GameSettings {
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  brightness: number; // 0.5 to 1.5
  difficulty: "Easy" | "Medium" | "Hard";
}

export interface PlayerStats {
  name: string;
  server: string;
  heroClass: HeroClass;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  score: number;
  wave: number;
  level: number;
  xp: number;
  maxXp: number;
}

export interface LeaderboardEntry {
  name: string;
  heroClass: HeroClass;
  score: number;
  wave: number;
  server: string;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface GameProjectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  isEnemy: boolean;
  color: string;
  trail: Vector2D[];
  life: number;
  maxLife: number;
  type: "bullet" | "arrow" | "missile" | "blade" | "fireball" | "poison" | "skull";
}

export interface GameParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
  decay: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
}

export interface ActiveAoE {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  damage: number;
  life: number;
  maxLife: number;
  isEnemy: boolean;
  label: string;
}

export interface BossEnemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  color: string;
  state: "idle" | "walking" | "atk" | "hurt";
  animTime: number;
  flashDuration: number;
  shootCooldown: number;
  specialCooldown: number;
  name: string;
  type: "Dragon" | "LichKing";
  freezeTimer?: number;
  slowTimer?: number;
  deathMarked?: boolean;
  deathMarkDamage?: number;
}

export interface LootItem {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: "heal" | "mana" | "gold";
  color: string;
  glowTime: number;
}
