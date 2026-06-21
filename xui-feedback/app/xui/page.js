"use client";

import InfoPopover from "@/components/InfoPopover.jsx";
import ExplainableTodoApp from "@/components/ExplainableTodoApp.jsx";
import ExplanationPanel from "@/components/ExplanationPanel.jsx";
import { ExplanationProvider } from "@/context/ExplanationContext.jsx";
import BlurLettersTitle from "@/components/BlurLettersTitle.jsx";
export default function XuiHome() {
  return (
    <ExplanationProvider>
      <div className="min-h-screen p-8 pb-24">
        <div className="max-w-2xl mx-auto">
                                     <BlurLettersTitle />

          <div className="flex items-center justify-between mb-4 relative">
            <InfoPopover />
          </div>
          <ExplainableTodoApp />
        </div>

        <ExplanationPanel />
      </div>
    </ExplanationProvider>
  );
}


