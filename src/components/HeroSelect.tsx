import React, { useState } from "react";
import { motion } from "motion/react";
import { playSfx } from "../sound";
import { HeroClass } from "../types";
import { Sword, Compass, Sparkles, Zap, Shield, Heart, HelpCircle, Activity } from "lucide-react";

interface HeroSelectProps {
  onSelect: (heroClass: HeroClass) => void;
  onBack: () => void;
}

interface HeroDetails {
  id: HeroClass;
  title: string;
  role: string;
  color: string;
  glowColor: string;
  stats: { hp: number; mp: number; atk: number; spd: number };
  passiveName: string;
  passiveDesc: string;
  skills: { key: string; name: string; desc: string; type: string }[];
  description: string;
}

const HEROES: HeroDetails[] = [
  {
    id: "Warrior",
    title: "1. ARIC",
    role: "WARRIOR",
    color: "border-red-500 text-red-500",
    glowColor: "rgba(239, 68, 68, 0.4)",
    stats: { hp: 650, mp: 400, atk: 75, spd: 4.5 },
    passiveName: "Battle Focus",
    passiveDesc: "Basic hits increase all subsequent damage by 2% (stacks up to 10%).",
    skills: [
      { key: "Z", name: "Sword Slash", desc: "Launches a sharp red sword-wave projectile.", type: "PROJECTILE" },
      { key: "X", name: "Shield Charge", desc: "Triggers a forward charge clone to crush enemies.", type: "PROJECTILE" },
      { key: "C", name: "Whirlwind", desc: "Creates a spinning sword hurricane dealing AOE damage.", type: "AOE" },
      { key: "V", name: "Blade Storm", desc: "Summons a storm of raining giant red blades from the sky.", type: "AOE" }
    ],
    description: "A seasoned fighter clad in heavy steel armor. Specializes in powerful sword slashes, sweeping multi-target slashes, and immense durability."
  },
  {
    id: "Archer",
    title: "2. LYRA",
    role: "ARCHER",
    color: "border-green-500 text-green-500",
    glowColor: "rgba(34, 197, 94, 0.4)",
    stats: { hp: 450, mp: 600, atk: 85, spd: 6.0 },
    passiveName: "Eagle Eye",
    passiveDesc: "Critical damage chance increases by 15% when fighting from distance.",
    skills: [
      { key: "Z", name: "Piercing Shot", desc: "Shoots a fast, high-velocity green arrow projectile.", type: "PROJECTILE" },
      { key: "X", name: "Multi Shot", desc: "Fires a wide spread of three high-damage arrows.", type: "PROJECTILE" },
      { key: "C", name: "Evasive Roll", desc: "Dashes swiftly leaving green decoys in its path.", type: "PROJECTILE" },
      { key: "V", name: "Rain of Arrows", desc: "Rains a downpour of critical green piercing arrows.", type: "AOE" }
    ],
    description: "A nimble woodland scout carrying an enchanted recurve bow. Master of long-distance precision, spreading arrows, and rapid retreats."
  },
  {
    id: "Mage",
    title: "3. VALEN",
    role: "MAGE",
    color: "border-purple-500 text-purple-500",
    glowColor: "rgba(168, 85, 247, 0.4)",
    stats: { hp: 380, mp: 1000, atk: 95, spd: 4.2 },
    passiveName: "Arcane Insight",
    passiveDesc: "Casting spells has a 15% chance to instantly refund 30% of the cost.",
    skills: [
      { key: "Z", name: "Arcane Missile", desc: "Launches a heat-seeking magical purple projectile.", type: "PROJECTILE" },
      { key: "X", name: "Frost Nova", desc: "Expels a freeze wave dealing heavy slow-damage.", type: "AOE" },
      { key: "C", name: "Teleport", desc: "Blinks forward instantly, dealing damage at start & end.", type: "DASH" },
      { key: "V", name: "Meteor strike", desc: "Summons a giant celestial purple meteor explosion.", type: "AOE" }
    ],
    description: "An elite wizard wielding the cosmic orb. Commands massive arcane blasts, freezing elements, and teleportation at the cost of durability."
  },
  {
    id: "Rogue",
    title: "4. KAEL",
    role: "ROGUE",
    color: "border-yellow-500 text-yellow-500",
    glowColor: "rgba(234, 179, 8, 0.4)",
    stats: { hp: 480, mp: 500, atk: 90, spd: 7.0 },
    passiveName: "Shadow Step",
    passiveDesc: "Dashing grants stealth, making the next attack deal 20% bonus damage.",
    skills: [
      { key: "Z", name: "Dagger Throw", desc: "Hurls a golden high-velocity piercing dagger.", type: "PROJECTILE" },
      { key: "X", name: "Shadow Dash", desc: "Slashes forward like a shadow, applying poison.", type: "PROJECTILE" },
      { key: "C", name: "Poison Bomb", desc: "Hurls a toxic bomb that leaves a lingering gas cloud.", type: "AOE" },
      { key: "V", name: "Death Mark", desc: "Triggers a circular mark executing low HP targets.", type: "AOE" }
    ],
    description: "A lethal assassin of the underworld. Masters dual daggers, poison-tipped gadgets, hyper movement speed, and fatal strikes from the shadows."
  }
];

export default function HeroSelect({ onSelect, onBack }: HeroSelectProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const currentHero = HEROES[selectedIdx];

  const handleSelectHero = () => {
    playSfx("click");
    onSelect(currentHero.id);
  };

  return (
    <div className="absolute inset-0 z-45 bg-[#030303] flex flex-col p-6 md:p-12 text-white font-mono overflow-y-auto select-none">
      {/* Upper Navigation */}
      <div className="max-w-7xl mx-auto w-full flex justify-between items-center mb-8">
        <div>
          <h2 className="text-sm font-bold tracking-widest text-orange-500 uppercase flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-500"></span> SELECT YOUR CHAMPION
          </h2>
          <div className="text-[10px] text-gray-500 uppercase mt-1">Grid System // System_Launch</div>
        </div>
        <button
          onClick={() => { playSfx("click"); onBack(); }}
          className="px-4 py-2 border border-[#222] hover:border-red-500 hover:text-red-500 text-xs text-gray-400 uppercase font-bold rounded cursor-pointer transition-all"
        >
          &lt; Back to Menu
        </button>
      </div>

      {/* Hero Selection Grid Layout */}
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col lg:flex-row gap-8 items-stretch justify-center">
        
        {/* Left Section: Hero Cards Selectors */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:w-80 justify-start">
          {HEROES.map((hero, idx) => {
            const isSelected = selectedIdx === idx;
            const cardColorClass = isSelected ? hero.color : "border-[#1a1a1a] bg-[#070707] text-gray-500 hover:border-gray-800 hover:text-gray-300";

            return (
              <div
                key={hero.id}
                onClick={() => { playSfx("click"); setSelectedIdx(idx); }}
                className={`p-4 border rounded cursor-pointer transition-all flex flex-col justify-between h-28 lg:h-32 ${cardColorClass}`}
                style={{
                  boxShadow: isSelected ? `0 0 15px ${hero.glowColor}` : "none"
                }}
              >
                <div>
                  <div className="text-[9px] text-gray-500 tracking-widest">CLASS_0{idx + 1}</div>
                  <h3 className="text-base font-black tracking-tight">{hero.title}</h3>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold tracking-widest">{hero.role}</span>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Middle Section: Hero Detail Panel */}
        <div className="flex-1 border border-[#222] bg-[#070707] rounded p-6 flex flex-col justify-between max-w-2xl">
          <div>
            <div className="flex justify-between items-start pb-4 border-b border-[#151515] mb-4">
              <div>
                <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Selected Hero</span>
                <h2 className="text-3xl font-extrabold text-white mt-1 uppercase tracking-tight">
                  {currentHero.id}
                </h2>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold px-2 py-1 bg-[#151515] text-orange-500 border border-[#222] rounded">
                  {currentHero.role}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed mb-6">
              {currentHero.description}
            </p>

            {/* Core Stats Bars */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-1 uppercase">
                  <span className="flex items-center gap-1"><Heart size={10} className="text-red-500" /> Max Health</span>
                  <span>{currentHero.stats.hp}</span>
                </div>
                <div className="h-2 bg-[#151515] rounded overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${(currentHero.stats.hp / 700) * 100}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-1 uppercase">
                  <span className="flex items-center gap-1"><Activity size={10} className="text-blue-500" /> Arcane Mana</span>
                  <span>{currentHero.stats.mp}</span>
                </div>
                <div className="h-2 bg-[#151515] rounded overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${(currentHero.stats.mp / 1200) * 100}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-1 uppercase">
                  <span className="flex items-center gap-1"><Sword size={10} className="text-orange-500" /> Attack Power</span>
                  <span>{currentHero.stats.atk}</span>
                </div>
                <div className="h-2 bg-[#151515] rounded overflow-hidden">
                  <div className="h-full bg-orange-500" style={{ width: `${(currentHero.stats.atk / 120) * 100}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-1 uppercase">
                  <span className="flex items-center gap-1"><Compass size={10} className="text-green-500" /> Movement Velocity</span>
                  <span>{currentHero.stats.spd}</span>
                </div>
                <div className="h-2 bg-[#151515] rounded overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${(currentHero.stats.spd / 8) * 100}%` }}></div>
                </div>
              </div>
            </div>

            {/* Passive details */}
            <div className="p-4 border border-orange-500/20 bg-orange-950/5 rounded mb-4">
              <span className="text-[10px] text-orange-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={11} /> PASSIVE ATTRIBUTE // {currentHero.passiveName}
              </span>
              <p className="text-[11px] text-gray-300 mt-1.5 leading-normal uppercase">
                {currentHero.passiveDesc}
              </p>
            </div>
          </div>

          <button
            onClick={handleSelectHero}
            className="btn-zex w-full py-4 font-bold text-base rounded shadow-lg flex items-center justify-center gap-2 mt-4"
          >
            SELECT {currentHero.id} & DEPLOY TO RECK MAP
          </button>
        </div>

        {/* Right Section: Core Skills HUD Panel */}
        <div className="w-full lg:w-[350px] border border-[#222] bg-[#070707] rounded p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold tracking-widest text-orange-500 mb-4 uppercase pb-2 border-b border-[#151515]">
              ABILITIES PREVIEW (KEYBINDINGS)
            </h3>
            
            <div className="space-y-4">
              {currentHero.skills.map((skill) => (
                <div key={skill.key} className="flex gap-3 items-start border-b border-[#111] pb-3 last:border-0 last:pb-0">
                  <div className="w-8 h-8 bg-[#111] border border-[#222] rounded flex items-center justify-center text-orange-500 text-xs font-bold">
                    {skill.key}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-gray-200">{skill.name}</h4>
                      <span className="text-[9px] text-gray-500 bg-[#151515] px-1.5 py-0.5 rounded uppercase">
                        {skill.type}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase leading-snug">
                      {skill.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-red-950/10 border border-red-500/20 rounded mt-4 text-[9px] text-red-400 leading-normal uppercase">
            CAUTION: Abilities consume mana. Conserving mana and grabbing Mana Potions during Boss Battles is key to surviving high difficulty levels.
          </div>
        </div>

      </div>
    </div>
  );
}
