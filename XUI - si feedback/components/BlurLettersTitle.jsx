"use client";

import { motion } from "framer-motion";

export default function BlurLettersTitle({
  text = "To-Do | Explaiable User Interface",
}) {
  const letters = Array.from(text);

  return (
    <div className="mb-8 flex justify-start">
      <motion.h1
        className="select-none bg-gradient-to-r from-white via-blue-100 to-blue-300 bg-clip-text text-xl font-medium tracking-[-0.03em] text-transparent drop-shadow-[0_0_18px_rgba(96,165,250,0.18)] md:text-2xl"
        initial="hidden"
        animate="visible"
        aria-label={text}
      >
        {letters.map((letter, index) => (
          <motion.span
            key={`${letter}-${index}`}
            className={`inline-block ${letter === " " ? "w-[0.32em]" : ""}`}
            variants={{
              hidden: {
                opacity: 0,
                filter: "blur(10px)",
                y: -10,
                scale: 0.98,
              },
              visible: {
                opacity: 1,
                filter: "blur(0px)",
                y: 0,
                scale: 1,
              },
            }}
            transition={{
              duration: 0.5,
              delay: index * 0.018,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {letter === " " ? "\u00A0" : letter}
          </motion.span>
        ))}
      </motion.h1>
    </div>
  );
}