"use client";

import Link from "next/link";
import InfoPopover from "@/components/InfoPopover.jsx";
import ExplainableTodoApp from "@/components/ExplainableTodoApp.jsx";
import { ExplanationProvider } from "@/context/ExplanationContext.jsx";
import BlurLettersTitle from "@/components/BlurLettersTitle.jsx";

export default function Home() {
  return (
    <ExplanationProvider>
      <div className="min-h-screen p-8 pb-24">
        <div className="max-w-2xl mx-auto">
        <BlurLettersTitle text="To-Do | Normal Interface" />
          <div className="flex items-center justify-between mb-4 relative">
            <InfoPopover />
          </div>

          <ExplainableTodoApp />

          <div className="mt-6 flex justify-center">
            <Link
              href="/xui"
              className="inline-flex items-center gap-2 rounded-2xl border border-purple-300/25 bg-purple-400/20 px-5 py-3 text-white shadow-lg shadow-purple-950/30 backdrop-blur-xl transition duration-300 hover:border-purple-200/50 hover:bg-purple-300/30"
            >
              XUI
            </Link>
          </div>
        </div>
      </div>
    </ExplanationProvider>
  );
}