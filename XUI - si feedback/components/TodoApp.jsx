"use client";

import { useMemo, useRef, useState } from "react";
import { isNearDuplicate } from "@/lib/similarity.js";
import {
  GripVertical,
  Trash2,
  RotateCcw,
  Plus,
  CheckSquare,
  Square,
} from "lucide-react";

const AUTO_REMOVE_DELAY_MS = 3000;
const FEEDBACK_TIMEOUT_MS = 2200;

export default function TodoApp() {
  // Standard React state - no explainability
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState("active"); // 'active' | 'removed'
  const [newText, setNewText] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [feedback, setFeedback] = useState("");

  const inputRef = useRef(null);
  const autoRemoveTimersRef = useRef(new Map());
  const feedbackTimerRef = useRef(null);

  const showFeedback = (message) => {
    setFeedback(message);

    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }

    feedbackTimerRef.current = setTimeout(() => {
      setFeedback("");
      feedbackTimerRef.current = null;
    }, FEEDBACK_TIMEOUT_MS);
  };

  const clearAutoRemoveTimer = (id) => {
    const existing = autoRemoveTimersRef.current.get(id);

    if (existing) {
      clearTimeout(existing);
      autoRemoveTimersRef.current.delete(id);
    }
  };

  const addTask = (text, e) => {
    const trimmed = (text || "").trim();

    if (!trimmed) return;

    // Duplicate detection across all tasks, including removed tasks.
    const match = tasks.find((t) => isNearDuplicate(t.text, trimmed));

    if (match) {
      const wasRemoved = !!match.archived;
      const previousText = match.text;

      // Update existing task name if text changed.
      if (trimmed !== previousText) {
        setTasks((prev) =>
          prev.map((t) => (t.id === match.id ? { ...t, text: trimmed } : t))
        );
      }

      // Bring back a removed task if the user adds it again.
      if (wasRemoved) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === match.id
              ? { ...t, archived: false, completed: false }
              : t
          )
        );

        showFeedback(`Task duplicato ripristinato: ${trimmed}`);
      }

      inputRef.current && (inputRef.current.value = "");
      setNewText("");
      return;
    }

    const newTask = {
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
      archived: false,
    };

    setTasks((prev) => [newTask, ...prev]);
    setNewText("");
    showFeedback(`Task aggiunto: ${trimmed}`);
  };

  const toggleComplete = (id, e) => {
    const updated = tasks.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );

    const toggled = updated.find((t) => t.id === id);
    const taskText = toggled?.text || "task";

    setTasks(updated);

    if (toggled.completed) {
      showFeedback(`Task completato: ${taskText}`);

      clearAutoRemoveTimer(id);

      const timerId = setTimeout(() => {
        removeTask(id, {
          auto: true,
          elapsedMs: AUTO_REMOVE_DELAY_MS,
        });
      }, AUTO_REMOVE_DELAY_MS);

      autoRemoveTimersRef.current.set(id, timerId);
    } else {
      showFeedback(`Task segnato come non completato: ${taskText}`);
      clearAutoRemoveTimer(id);
    }
  };

  const removeTask = (id, options = {}, e = null) => {
    if (!options.auto) {
      clearAutoRemoveTimer(id);
    }

    const task = tasks.find((x) => x.id === id);
    const taskText = task?.text || "task";

    setTasks((prev) => {
      const task = prev.find((x) => x.id === id);

      if (!task) return prev;

      return prev.map((x) =>
        x.id === id ? { ...x, archived: true } : x
      );
    });

    showFeedback(
      options.auto
        ? `Task completato rimosso automaticamente: ${taskText}`
        : `Task rimosso: ${taskText}`
    );
  };

  const restoreTask = (id, e) => {
    const task = tasks.find((x) => x.id === id && x.archived);

    if (!task) return;

    clearAutoRemoveTimer(id);

    setTasks((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, archived: false, completed: false } : x
      )
    );

    showFeedback(`Task ripristinato: ${task.text}`);
  };

  const deleteTask = (id, e) => {
    const task = tasks.find((x) => x.id === id);
    const taskText = task?.text || "task";

    clearAutoRemoveTimer(id);

    setTasks((prev) => prev.filter((x) => x.id !== id));

    showFeedback(`Task eliminato definitivamente: ${taskText}`);
  };

  const emptyRemoved = (e) => {
    for (const [, timerId] of autoRemoveTimersRef.current) {
      clearTimeout(timerId);
    }

    autoRemoveTimersRef.current.clear();

    const count = tasks.filter((t) => t.archived).length;

    setTasks((prev) => prev.filter((t) => !t.archived));

    if (count > 0) {
      showFeedback(`${count} task eliminati definitivamente.`);
    }
  };

  const reorderTask = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    setTasks((prev) => {
      const source = prev.find((task) => task.id === sourceId);
      const target = prev.find((task) => task.id === targetId);

      if (!source || !target || source.archived !== target.archived) {
        return prev;
      }

      const sourceIndex = prev.findIndex((task) => task.id === sourceId);
      const targetIndex = prev.findIndex((task) => task.id === targetId);

      const reordered = [...prev];
      const [movedTask] = reordered.splice(sourceIndex, 1);

      reordered.splice(targetIndex, 0, movedTask);

      return reordered;
    });
  };

  const removedCount = useMemo(
    () => tasks.filter((t) => t.archived).length,
    [tasks]
  );

  const handleAddClick = (e) => {
    addTask(newText, e);
  };

  const handleEnter = (e) => {
    if (e.key === "Enter") {
      addTask(newText, e);
    }
  };

  const renderTask = (t) => (
    <li
      key={t.id}
      draggable={view === "active"}
      onDragStart={(e) => {
        setDraggedTaskId(t.id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", t.id);
      }}
      onDragOver={(e) => {
        if (view !== "active") return;

        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();

        const sourceId = e.dataTransfer.getData("text/plain") || draggedTaskId;

        reorderTask(sourceId, t.id);
        setDraggedTaskId(null);
      }}
      onDragEnd={() => setDraggedTaskId(null)}
      className={`flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] p-3 text-white shadow-lg shadow-black/20 backdrop-blur-xl transition duration-300 hover:border-blue-300/25 hover:bg-white/[0.1] ${
        draggedTaskId === t.id ? "opacity-50" : "opacity-100"
      }`}
    >
      <span
        className="cursor-grab rounded-xl p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white/80 active:cursor-grabbing"
        aria-label="Drag task to reorder"
        title="Trascina per riordinare"
      >
        <GripVertical size={16} />
      </span>

      <button
        onClick={(e) => toggleComplete(t.id, e)}
        className="rounded-xl p-1.5 text-white/85 transition hover:bg-white/10 hover:text-white"
        aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
      >
        {t.completed ? <CheckSquare size={18} /> : <Square size={18} />}
      </button>

      <span
        className={`flex-1 ${
          t.completed ? "line-through opacity-60" : ""
        }`}
      >
        {t.text}
      </span>

      <button
        onClick={(e) => removeTask(t.id, {}, e)}
        className="rounded-xl p-1.5 text-red-300 transition hover:bg-red-400/10 hover:text-red-200"
        aria-label="Remove task"
        title="Rimuovi task"
      >
        <Trash2 size={18} />
      </button>
    </li>
  );

  return (
    <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-blue-950/40 backdrop-blur-2xl">
      <div className="mb-4 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Add a task"
          onKeyDown={handleEnter}
          aria-label="Task input"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          className="flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/45 shadow-inner shadow-white/5 backdrop-blur-xl outline-none transition duration-300 focus:border-blue-300/60 focus:bg-white/15 focus:ring-4 focus:ring-blue-400/10"
        />

        <button
          onClick={handleAddClick}
          disabled={!newText.trim()}
          className="inline-flex items-center gap-2 rounded-2xl border border-blue-300/25 bg-blue-400/20 px-5 py-3 text-white shadow-lg shadow-blue-950/30 backdrop-blur-xl transition duration-300 hover:border-blue-200/50 hover:bg-blue-300/30 hover:shadow-blue-700/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-blue-400/20"
          aria-label="Add task"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100 shadow-lg shadow-red-950/20 backdrop-blur-xl"
        >
          {feedback}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => setView("active")}
          className={`rounded-2xl border px-4 py-2 backdrop-blur-xl transition duration-300 ${
            view === "active"
              ? "border-blue-300/40 bg-blue-400/20 text-white shadow-lg shadow-blue-950/20"
              : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
          }`}
          aria-label="Show active tasks"
        >
          Active
        </button>

        <button
          onClick={() => setView("removed")}
          className={`rounded-2xl border px-4 py-2 backdrop-blur-xl transition duration-300 ${
            view === "removed"
              ? "border-orange-300/50 bg-orange-400/25 text-orange-50 shadow-lg shadow-orange-950/25"
              : "border-orange-300/20 bg-orange-400/10 text-orange-100/75 hover:border-orange-300/35 hover:bg-orange-400/20 hover:text-orange-50"
          }`}
          aria-label="Show removed tasks"
        >
          Rimossi
        </button>

        {view === "removed" && (
          <button
            onClick={emptyRemoved}
            disabled={removedCount === 0}
            className="ml-auto rounded-2xl border border-red-300/25 bg-red-400/15 px-4 py-2 text-white shadow-lg shadow-red-950/20 backdrop-blur-xl transition duration-300 hover:border-red-200/50 hover:bg-red-300/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-red-400/15"
            aria-label="Empty removed tasks"
          >
            Svuota rimossi
          </button>
        )}
      </div>

      {view === "active" ? (
        <ul className="space-y-2">
          {tasks.filter((t) => !t.archived).map(renderTask)}
        </ul>
      ) : (
        <ul className="space-y-2">
          {tasks
            .filter((t) => t.archived)
            .map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] p-3 text-white shadow-lg shadow-black/20 backdrop-blur-xl transition duration-300 hover:border-blue-300/25 hover:bg-white/[0.1]"
              >
                <span className="flex-1">{t.text}</span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => restoreTask(t.id, e)}
                    className="rounded-xl p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                    aria-label="Restore"
                  >
                    <RotateCcw size={16} />
                  </button>

                  <button
                    onClick={(e) => deleteTask(t.id, e)}
                    className="rounded-xl p-1.5 text-red-300 transition hover:bg-red-400/10 hover:text-red-200"
                    aria-label="Delete permanently"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}