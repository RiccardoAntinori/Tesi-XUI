 "use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isNearDuplicate } from "@/lib/similarity.js";
import {
  ArrowUp,
  ArrowDown,
  Archive,
  Trash2,
  RotateCcw,
  Plus,
  CheckSquare,
  Square,
} from "lucide-react";

export default function TodoApp() {
  // Standard React state - no explainability
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState("active"); // 'active' | 'archive'
  const [newText, setNewText] = useState("");
  const inputRef = useRef(null);
  const autoArchiveTimersRef = useRef(new Map());

  const addTask = (text, e) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;

    // Duplicate detection across all tasks (including archived)
    const match = tasks.find((t) => isNearDuplicate(t.text, trimmed));
    if (match) {
      const wasArchived = !!match.archived;
      const previousText = match.text;

      // Update existing task name if text changed
      if (trimmed !== previousText) {
        setTasks((prev) =>
          prev.map((t) => (t.id === match.id ? { ...t, text: trimmed } : t))
        );
      }

      // Unarchive if needed
      if (wasArchived) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === match.id ? { ...t, archived: false } : t
          )
        );
      }

      inputRef.current && (inputRef.current.value = "");
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
  };

  const toggleComplete = (id, e) => {
    const updated = tasks.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    const toggled = updated.find((t) => t.id === id);
    setTasks(updated);

    // Auto-archive after 10s if completed
    if (toggled.completed) {
      const timerId = setTimeout(() => {
        archiveTask(id, { auto: true });
      }, 10000);
      autoArchiveTimersRef.current.set(id, timerId);
    } else {
      const existing = autoArchiveTimersRef.current.get(id);
      if (existing) {
        clearTimeout(existing);
        autoArchiveTimersRef.current.delete(id);
      }
    }
  };

  const archiveTask = (id, options = {}, e = null) => {
    // Clear auto-archive timer if manually archiving
    if (!options.auto) {
      const existing = autoArchiveTimersRef.current.get(id);
      if (existing) {
        clearTimeout(existing);
        autoArchiveTimersRef.current.delete(id);
      }
    }

    setTasks((prev) => {
      const t = prev.find((x) => x.id === id);
      if (!t) return prev; // Task not found, return unchanged
      return prev.map((x) => (x.id === id ? { ...x, archived: true } : x));
    });
  };

  const restoreTask = (id, e) => {
    const t = tasks.find((x) => x.id === id && x.archived);
    if (!t) return;

    // Clear any auto-archive timer when restoring
    const existing = autoArchiveTimersRef.current.get(id);
    if (existing) {
      clearTimeout(existing);
      autoArchiveTimersRef.current.delete(id);
    }

    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, archived: false } : x)));
  };

  const deleteTask = (id, e) => {
    // Clear any auto-archive timer when permanently deleting
    const existing = autoArchiveTimersRef.current.get(id);
    if (existing) {
      clearTimeout(existing);
      autoArchiveTimersRef.current.delete(id);
    }

    setTasks((prev) => prev.filter((x) => x.id !== id));
  };

  const emptyArchive = (e) => {
    // Clear all auto-archive timers when emptying trash
    for (const [id, timerId] of autoArchiveTimersRef.current) {
      clearTimeout(timerId);
    }
    autoArchiveTimersRef.current.clear();

    setTasks((prev) => prev.filter((t) => !t.archived));
  };

  const moveTask = (id, direction, e) => {
    const index = tasks.findIndex((t) => t.id === id);
    if (index < 0) return;
    const newIndex =
      direction === "up"
        ? Math.max(0, index - 1)
        : Math.min(tasks.length - 1, index + 1);
    if (newIndex === index) return;
    const arr = [...tasks];
    const [item] = arr.splice(index, 1);
    arr.splice(newIndex, 0, item);
    setTasks(arr);
  };

  const archivedCount = useMemo(
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

  return (
    <div className="max-w-xl w-full mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <input
          ref={inputRef}
          type="text"
          placeholder="Add a task"
          onKeyDown={handleEnter}
          aria-label="Task input"
          value={newText}
          onChange={(e) => {
            const v = e.target.value;
            setNewText(v);
          }}
          className="flex-1 rounded border border-black/10 dark:border-white/20 px-3 py-2 bg-transparent"
        />
        <button
          onClick={handleAddClick}
          disabled={!newText.trim()}
          className="inline-flex items-center gap-1 rounded bg-blue-600 hover:bg-blue-700 disabled:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2"
          aria-label="Add task"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setView("active")}
          className={`px-3 py-1 rounded ${
            view === "active"
              ? "bg-black/10 dark:bg-white/10"
              : "border border-black/10 dark:border-white/20"
          }`}
          aria-label="Show active tasks"
        >
          Active
        </button>
        <button
          onClick={() => setView("archive")}
          className={`px-3 py-1 rounded ${
            view === "archive"
              ? "bg-black/10 dark:bg-white/10"
              : "border border-black/10 dark:border-white/20"
          }`}
          aria-label="Show archive"
        >
          Archive
        </button>
        {view === "archive" && (
          <button
            onClick={emptyArchive}
            disabled={archivedCount === 0}
            className="ml-auto px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Empty archive"
          >
            Empty archive
          </button>
        )}
      </div>

      {view === "active" ? (
        <ul className="space-y-2">
          {tasks
            .filter((t) => !t.archived)
            .map((t, idx) => (
              <li
                key={t.id}
                className="flex items-center gap-2 border border-black/10 dark:border-white/20 rounded p-2"
              >
                <button
                  onClick={(e) => toggleComplete(t.id, e)}
                  className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
                  aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                >
                  {t.completed ? (
                    <CheckSquare size={18} />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
                <span
                  className={`flex-1 ${
                    t.completed ? "line-through opacity-60" : ""
                  }`}
                >
                  {t.text}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => moveTask(t.id, "up", e)}
                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
                    aria-label="Move up"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    onClick={(e) => moveTask(t.id, "down", e)}
                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
                    aria-label="Move down"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    onClick={(e) => archiveTask(t.id, {}, e)}
                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
                    aria-label="Archive"
                  >
                    <Archive size={16} />
                  </button>
                </div>
              </li>
            ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {tasks
            .filter((t) => t.archived)
            .map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 border border-black/10 dark:border-white/20 rounded p-2"
              >
                <span className="flex-1">{t.text}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => restoreTask(t.id, e)}
                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
                    aria-label="Restore"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    onClick={(e) => deleteTask(t.id, e)}
                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-red-600"
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
