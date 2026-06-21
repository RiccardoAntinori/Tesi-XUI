"use client";

import { useState } from "react";
import { Info } from "lucide-react";

export default function InfoPopover() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full w-8 h-8 inline-flex items-center justify-center border border-black/10 dark:border-white/20 text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5"
        aria-label={open ? "Hide info" : "Show info"}
      >
        <Info size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-[min(28rem,90vw)] rounded-md border border-black/10 dark:border-white/20 bg-white dark:bg-black shadow-lg p-3 text-sm leading-relaxed">
          <div className="font-semibold mb-1">About this To‑Do App</div>
          <ul className="list-disc pl-5 space-y-1 opacity-90">
            <li>Completed items are auto‑archived after ~5 seconds.</li>
            <li>Adding a near‑duplicate updates the existing task name; if archived, it is unarchived.</li>
            <li>“Archive” view lets you restore or permanently delete archived items.</li>
          </ul>
        </div>
      )}
    </div>
  );
}


