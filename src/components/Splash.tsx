import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { playSfx } from "../sound";

interface SplashProps {
  onComplete: () => void;
}

export default function Splash({ onComplete }: SplashProps) {
  const [skipHover, setSkipHover] = useState(false);

  useEffect(() => {
    // Automatically transition to menu after 3 seconds
    const timer = setTimeout(() => {
      onComplete();
    }, 3200);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const handleSkip = () => {
    playSfx("click");
    onComplete();
  };

  return (
    <div
      className="relative w-full h-full bg-[#030303] flex flex-col items-center justify-center overflow-hidden cursor-pointer select-none"
      onClick={handleSkip}
      id="splash-container"
    >
      {/* Glitch Keyframes Style */}
      <style>{`
        @keyframes cyber-glitch {
          0% {
            text-shadow: -2px 0 #ff00c1, 2px 0 #00fff9;
            transform: translate(0);
          }
          20% {
            text-shadow: 2px -2px #ff00c1, -2px 2px #00fff9;
            transform: translate(-1px, 1px);
          }
          40% {
            text-shadow: -2px 2px #ff00c1, 2px -2px #00fff9;
            transform: translate(-1px, -1px);
          }
          60% {
            text-shadow: 2px 2px #ff00c1, -2px -2px #00fff9;
            transform: translate(1px, 1px);
          }
          80% {
            text-shadow: -2px -2px #ff00c1, 2px 2px #00fff9;
            transform: translate(1px, -1px);
          }
          100% {
            text-shadow: -2px 0 #ff00c1, 2px 0 #00fff9;
            transform: translate(0);
          }
        }
        .animate-glitch {
          animation: cyber-glitch 0.4s infinite;
        }
      `}</style>

      {/* Decorative Grid Background */}
      <div className="absolute inset-0 bg-[radial-gradient(#111111_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>

      {/* Epic Cinematic Display */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="text-center z-10 flex flex-col items-center gap-2"
      >
        <motion.div
          initial={{ letterSpacing: "0.2em", opacity: 0 }}
          animate={{ letterSpacing: "0.5em", opacity: 0.6 }}
          transition={{ delay: 0.3, duration: 1 }}
          className="text-xs font-mono font-bold text-orange-500 tracking-[0.5em] uppercase mb-2"
        >
          PRODUCED BY
        </motion.div>

        <h1
          className="text-4xl md:text-6xl lg:text-7xl font-black font-mono tracking-widest text-white select-none animate-glitch"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          MINU_DOAPPS
        </h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="text-[10px] font-mono text-gray-500 mt-6 tracking-widest uppercase"
        >
          [ Tap / Press any key to skip intro ]
        </motion.div>
      </motion.div>

      {/* Bottom Corner Ambient Tech Numbers */}
      <div className="absolute bottom-6 left-6 font-mono text-[9px] text-gray-600 tracking-wider">
        SYS_STATUS: READY // INIT_BOOT
      </div>
      <div className="absolute bottom-6 right-6 font-mono text-[9px] text-gray-600 tracking-wider">
        REGION_CODE: DX-9221
      </div>
    </div>
  );
}
