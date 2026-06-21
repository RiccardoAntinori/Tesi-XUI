"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const ExplanationContext = createContext({
  eventLog: [],
  logEvent: () => {},
  clearEventLog: () => {},
  currentSemanticActionRef: { current: null },
  levelsEnabled: {
    lexical: true,
    syntactic: true,
    semantic: true,
  },
  toggleLevel: () => {},
  setLevelsEnabled: () => {},
  focusTaskId: null,
  setFocusTaskId: () => {},
});

function buildEvent({
  component,
  level = "semantic",
  actionType = "user",
  description,
  details = {},
  parentId = null,
  logLevel,
}) {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    component,
    level,
    actionType,
    description,
    details,
    parentId,
    logLevel:
      logLevel ||
      (level === "lexical"
        ? "debug"
        : level === "syntactic"
        ? "info"
        : "notice"),
  };
}

export function ExplanationProvider({ children }) {
  const [eventLog, setEventLog] = useState([]);
  const [levelsEnabled, setLevelsEnabled] = useState({
    lexical: false,
    syntactic: true,
    semantic: true,
  });
  const [focusTaskId, setFocusTaskId] = useState(null);
  const currentSemanticActionRef = useRef(null);

  const logEvent = useCallback(
    (
      description,
      component,
      details = {},
      actionType = "user",
      level = "semantic",
      parentIdOverride = null,
      options = {}
    ) => {
      const parentId =
        level === "lexical"
          ? parentIdOverride || currentSemanticActionRef.current
          : null;

      const event = buildEvent({
        component,
        level,
        actionType,
        description,
        details,
        parentId,
        logLevel: options.logLevel,
      });

      if (level === "semantic") {
        currentSemanticActionRef.current = event.id;
      }

      setEventLog((prev) => [event, ...prev]);

      return event;
    },
    []
  );

  const clearEventLog = useCallback(() => {
    setEventLog([]);
    setFocusTaskId(null);
    currentSemanticActionRef.current = null;
  }, []);

  const toggleLevel = useCallback((level) => {
    setLevelsEnabled((prev) => ({
      ...prev,
      [level]: !prev[level],
    }));
  }, []);

  const value = useMemo(
    () => ({
      eventLog,
      logEvent,
      clearEventLog,
      currentSemanticActionRef,
      levelsEnabled,
      toggleLevel,
      setLevelsEnabled,
      focusTaskId,
      setFocusTaskId,
    }),
    [
      eventLog,
      logEvent,
      clearEventLog,
      levelsEnabled,
      toggleLevel,
      focusTaskId,
    ]
  );

  useEffect(() => {
    function summarizeTarget(target) {
      if (!target || typeof target !== "object") return "unknown";

      const el = target;
      const dataComponent = el.getAttribute && el.getAttribute("data-component");
      const role = el.getAttribute && el.getAttribute("role");
      const id = el.id ? `#${el.id}` : "";

      const className =
        el.className && typeof el.className === "string"
          ? `.${el.className
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .join(".")}`
          : "";

      const base = dataComponent || role || el.tagName || "node";

      return `${base}${id}${className}`;
    }

    function getAriaLabel(el) {
      let cur = el;

      for (let i = 0; i < 4 && cur; i++) {
        if (typeof cur.getAttribute === "function") {
          const ariaLabel = cur.getAttribute("aria-label");

          if (ariaLabel) return ariaLabel;

          const labelledById = cur.getAttribute("aria-labelledby");

          if (labelledById && typeof document !== "undefined") {
            const ref = document.getElementById(labelledById);

            if (ref && typeof ref.textContent === "string") {
              const text = ref.textContent.trim();

              if (text) return text;
            }
          }
        }

        cur = cur.parentElement;
      }

      return null;
    }

    function getTextSnippet(el) {
      if (!el) return null;

      try {
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();

        if (!text) return null;

        return text.length > 40 ? `${text.slice(0, 37)}...` : text;
      } catch {
        return null;
      }
    }

    const isInsideExplainUI = (node) => {
      if (!node || typeof node.closest !== "function") return false;

      return (
        node.closest('[aria-label="Explanation log panel"]') ||
        node.closest('[data-explain-ui="explanation"]') ||
        node.closest('[data-explain-ui="explain-handle"]')
      );
    };

    const clickHandler = (e) => {
      try {
        const el = e.target;

        if (isInsideExplainUI(el)) return;

        const targetSummary = summarizeTarget(el);
        const coords = {
          x: e.clientX ?? null,
          y: e.clientY ?? null,
        };

        const ariaLabel = getAriaLabel(el);
        const textSnippet = getTextSnippet(el);
        const componentLabel = ariaLabel || targetSummary;

        const desc = ariaLabel
          ? "Click"
          : textSnippet
          ? `Click ${textSnippet}`
          : "Click";

        logEvent(
          desc,
          componentLabel,
          {
            coords,
            targetSummary,
            ariaLabel,
            textSnippet,
          },
          "user",
          "lexical"
        );
      } catch {}
    };

    const keyHandler = (e) => {
      try {
        const active =
          typeof document !== "undefined" ? document.activeElement : null;

        const el = active || e.target;

        if (isInsideExplainUI(el)) return;

        const targetSummary = summarizeTarget(el);
        const ariaLabel = getAriaLabel(el);
        const textSnippet = getTextSnippet(el);

        const details = {
          key: e.key,
          code: e.code,
          ctrl: e.ctrlKey,
          meta: e.metaKey,
          alt: e.altKey,
          shift: e.shiftKey,
          targetSummary,
          ariaLabel,
          textSnippet,
        };

        const componentLabel = ariaLabel || targetSummary;
        const desc = `Keydown ${e.key}`;

        logEvent(desc, componentLabel, details, "user", "lexical");
      } catch {}
    };

    if (typeof window !== "undefined") {
      window.addEventListener("click", clickHandler, { capture: true });
      window.addEventListener("keydown", keyHandler, { capture: true });
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("click", clickHandler, { capture: true });
        window.removeEventListener("keydown", keyHandler, { capture: true });
      }
    };
  }, [logEvent]);

  return (
    <ExplanationContext.Provider value={value}>
      {children}
    </ExplanationContext.Provider>
  );
}