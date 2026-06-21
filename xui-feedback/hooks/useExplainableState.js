"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ExplanationContext } from "@/context/ExplanationContext.jsx";

export default function useExplainableState(
  initialState,
  componentLabel,
  options = {}
) {
  const { logEvent } = useContext(ExplanationContext);

  const [state, setRawState] = useState(initialState);

  // Mantiene sempre lo stato più recente disponibile.
  // Serve per evitare problemi con timer o aggiornamenti asincroni ravvicinati.
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const logLexical = useCallback(
    (e, description = "Clicked", extra = {}, parentId = null) => {
      const coords =
        typeof e === "object" && e
          ? {
              x: e.clientX ?? null,
              y: e.clientY ?? null,
            }
          : {};

      return logEvent(
        description,
        componentLabel,
        {
          ...extra,
          coords,
        },
        "user",
        "lexical",
        parentId
      );
    },
    [logEvent, componentLabel]
  );

  const logSyntactic = useCallback(
    (description, details = {}, actionType = "user") => {
      return logEvent(
        description,
        componentLabel,
        details,
        actionType,
        "syntactic"
      );
    },
    [logEvent, componentLabel]
  );

  const logSemantic = useCallback(
    (description, details = {}, actionType = "user") => {
      return logEvent(
        description,
        componentLabel,
        details,
        actionType,
        "semantic"
      );
    },
    [logEvent, componentLabel]
  );

  const setState = useCallback((next) => {
    const previousState = stateRef.current;

    const resolved =
      typeof next === "function" ? next(previousState) : next;

    stateRef.current = resolved;
    setRawState(resolved);

    return resolved;
  }, []);

  const setStateWithExplain = useCallback(
    (next, semanticDescription, details = {}) => {
      const actionType = details.auto ? "auto" : "user";

      const previousState = stateRef.current;

      const resolved =
        typeof next === "function" ? next(previousState) : next;

      // Aggiorno prima il riferimento interno, così eventuali timer successivi
      // lavorano sullo stato più recente.
      stateRef.current = resolved;

      // Aggiorno lo stato React.
      setRawState(resolved);

      // Registro il log DOPO setRawState, ma fuori dal callback di setState.
      // Così evitiamo l'errore:
      // Cannot update a component while rendering a different component.
      const semanticEvent = logSemantic(
        semanticDescription,
        {
          newState: resolved,
          ...details,
        },
        actionType
      );

      return semanticEvent;
    },
    [logSemantic]
  );

  return [
    state,
    setStateWithExplain,
    {
      setState,
      logLexical,
      logSyntactic,
      logSemantic,
      stateRef,
    },
  ];
}