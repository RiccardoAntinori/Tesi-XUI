"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import useExplainableState from "@/hooks/useExplainableState.js";
import { ExplanationContext } from "@/context/ExplanationContext.jsx";
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
  Eye,
  EyeOff,
  RefreshCcw,
} from "lucide-react";

const AUTO_ARCHIVE_DELAY_MS = 5000;

export default function ExplainableTodoApp() {
  const { logEvent, clearEventLog } = useContext(ExplanationContext);

  const [tasks, setTasksWithExplain, helpers] = useExplainableState(
    [],
    "TodoApp"
  );

  const [view, setView] = useState("active");
  const [newText, setNewText] = useState("");
  const [showTaskList, setShowTaskList] = useState(true);

  const inputRef = useRef(null);
  const addEnabledRef = useRef(false);
  const emptyEnabledRef = useRef(false);
  const autoArchiveTimersRef = useRef(new Map());

  const clearAutoArchiveTimer = (id) => {
    const existing = autoArchiveTimersRef.current.get(id);

    if (existing) {
      clearTimeout(existing);
      autoArchiveTimersRef.current.delete(id);
    }
  };

  const clearAllAutoArchiveTimers = () => {
    for (const [, timerId] of autoArchiveTimersRef.current) {
      clearTimeout(timerId);
    }

    autoArchiveTimersRef.current.clear();
  };

  const getTaskNameById = (id) => {
    const task = tasks.find((t) => t.id === id);
    return task?.text || "unknown task";
  };

  const handleResetApp = () => {
    const clearedTasksCount = tasks.length;

    clearAllAutoArchiveTimers();

    setNewText("");
    setView("active");
    setShowTaskList(true);

    addEnabledRef.current = false;
    emptyEnabledRef.current = false;

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    helpers.setState([]);
    clearEventLog();

    setTimeout(() => {
      logEvent(
        "Interface reset: all tasks and previous explanation history cleared",
        "TodoApp",
        {
          clearedTasks: clearedTasksCount,
          resetView: "active",
          taskListVisible: true,
          clearedExplanationHistory: true,
        },
        "user",
        "semantic"
      );
    }, 0);
  };

  const handleToggleTaskList = () => {
    const nextVisible = !showTaskList;

    setShowTaskList(nextVisible);

    logEvent(
      nextVisible ? "Task list shown" : "Task list hidden",
      "TodoApp",
      {
        visible: nextVisible,
        activeTasks: tasks.filter((t) => !t.archived).length,
        archivedTasks: tasks.filter((t) => t.archived).length,
      },
      "user",
      "semantic"
    );
  };

  const addTask = (text, e) => {
    const trimmed = (text || "").trim();

    logEvent(
      `Pressed Add${trimmed ? `: ${trimmed}` : ""}`,
      "TodoApp",
      { text: trimmed },
      "user",
      "syntactic"
    );

    if (!trimmed) return;

    const match = tasks.find((t) => isNearDuplicate(t.text, trimmed));

    if (match) {
      const wasArchived = !!match.archived;
      const previousText = match.text;

      logEvent(
        `Add task duplicate detected: ${trimmed}`,
        "TodoApp",
        {
          id: match.id,
          text: trimmed,
          previousText,
          matchedId: match.id,
        },
        "user",
        "semantic"
      );

      if (trimmed !== previousText) {
        setTasksWithExplain(
          (prev) =>
            prev.map((t) =>
              t.id === match.id ? { ...t, text: trimmed } : t
            ),
          `Updated existing task name: ${previousText} → ${trimmed}`,
          {
            id: match.id,
            text: trimmed,
            previousText,
            newText: trimmed,
            auto: true,
          }
        );
      }

      if (wasArchived) {
        setTasksWithExplain(
          (prev) =>
            prev.map((t) =>
              t.id === match.id ? { ...t, archived: false } : t
            ),
          `Unarchived duplicate task: ${trimmed}`,
          {
            id: match.id,
            text: trimmed,
            auto: true,
          }
        );
      }

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      setNewText("");
      return;
    }

    const newTask = {
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
      archived: false,
    };

    setTasksWithExplain(
      (prev) => [newTask, ...prev],
      `Added task: ${trimmed}`,
      {
        id: newTask.id,
        text: trimmed,
        task: newTask,
      }
    );

    setNewText("");
  };

  const toggleComplete = (id, e) => {
    const currentTask = tasks.find((t) => t.id === id);
    const taskName = currentTask?.text || "unknown task";
    const willBeCompleted = !currentTask?.completed;

    const updated = tasks.map((t) =>
      t.id === id ? { ...t, completed: willBeCompleted } : t
    );

    setTasksWithExplain(
      updated,
      willBeCompleted
        ? `Marked task complete: ${taskName}`
        : `Marked task incomplete: ${taskName}`,
      {
        id,
        text: taskName,
        completed: willBeCompleted,
      }
    );

    if (willBeCompleted) {
      clearAutoArchiveTimer(id);

      const timerId = setTimeout(() => {
        archiveTask(id, {
          auto: true,
          elapsedMs: AUTO_ARCHIVE_DELAY_MS,
          taskName,
        });
      }, AUTO_ARCHIVE_DELAY_MS);

      autoArchiveTimersRef.current.set(id, timerId);
    } else {
      clearAutoArchiveTimer(id);
    }
  };

  const archiveTask = (id, options = {}, e = null) => {
    if (!options.auto) {
      clearAutoArchiveTimer(id);
    }

    const taskName = options.taskName || getTaskNameById(id);

    setTasksWithExplain(
      (prev) => {
        const task = prev.find((x) => x.id === id);

        if (!task) return prev;

        return prev.map((x) =>
          x.id === id ? { ...x, archived: true } : x
        );
      },
      options.auto
        ? `Auto-archived task after 5s: ${taskName}`
        : `Archived task: ${taskName}`,
      {
        id,
        text: taskName,
        auto: !!options.auto,
        elapsedMs: options.elapsedMs,
      }
    );
  };

  const restoreTask = (id, e) => {
    const task = tasks.find((x) => x.id === id && x.archived);

    if (!task) return;

    const taskName = task.text;

    clearAutoArchiveTimer(id);

    setTasksWithExplain(
      (prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, archived: false, completed: false } : x
        ),
      `Restored task: ${taskName}`,
      {
        id,
        text: taskName,
      }
    );
  };

  const deleteTask = (id, e) => {
    const taskName = getTaskNameById(id);

    clearAutoArchiveTimer(id);

    setTasksWithExplain(
      (prev) => prev.filter((x) => x.id !== id),
      `Deleted permanently: ${taskName}`,
      {
        id,
        text: taskName,
      }
    );
  };

  const emptyArchive = (e) => {
    clearAllAutoArchiveTimers();

    const archivedTasks = tasks.filter((t) => t.archived);
    const count = archivedTasks.length;
    const archivedTaskNames = archivedTasks.map((t) => t.text);

    setTasksWithExplain(
      (prev) => prev.filter((t) => !t.archived),
      count === 1
        ? `Emptied archive: ${archivedTaskNames[0]}`
        : `Emptied archive: ${archivedTaskNames.join(", ")}`,
      {
        count,
        tasks: archivedTasks,
        text: archivedTaskNames.join(", "),
      }
    );
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

    setTasksWithExplain(
      arr,
      `Reordered task ${direction}: ${item.text}`,
      {
        id,
        text: item.text,
        direction,
        from: index,
        to: newIndex,
      }
    );
  };

  const archivedCount = useMemo(
    () => tasks.filter((t) => t.archived).length,
    [tasks]
  );

  useEffect(() => {
    const enabled = archivedCount > 0;

    if (enabled !== emptyEnabledRef.current) {
      logEvent(
        enabled ? "Enabled Empty archive" : "Disabled Empty archive",
        "TodoApp",
        { archivedCount },
        "auto",
        "syntactic"
      );

      emptyEnabledRef.current = enabled;
    }
  }, [archivedCount, logEvent]);

  const handleAddClick = (e) => {
    addTask(newText, e);
  };

  const handleEnter = (e) => {
    if (e.key === "Enter") {
      addTask(newText, e);
    }
  };

  return (
    <>
      <div className="fixed right-6 top-6 z-40 flex items-center gap-2">
        <button
          onClick={handleToggleTaskList}
          className="inline-flex items-center gap-1 rounded border border-black/10 dark:border-white/20 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          aria-label={showTaskList ? "Hide task list" : "Show task list"}
        >
          {showTaskList ? "H" : "S"}
        </button>

        <button
          onClick={handleResetApp}
          className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
          aria-label="Reset application"
        >
          R
        </button>
      </div>

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

              const enabled = v.trim().length > 0;

              if (enabled !== addEnabledRef.current) {
                logEvent(
                  enabled ? "Enabled Add button" : "Disabled Add button",
                  "TodoApp",
                  { length: v.trim().length },
                  "auto",
                  "syntactic"
                );

                addEnabledRef.current = enabled;
              }
            }}
            className="flex-1 rounded border border-black/10 dark:border-white/20 px-3 py-2 bg-transparent"
          />

          <button
            onClick={handleAddClick}
            disabled={!newText.trim()}
            className="inline-flex items-center gap-1 rounded bg-blue-600 hover:bg-blue-700 disabled:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2"
            aria-label="Add task"
          >
            <Plus size={16} />
            Add
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

        {!showTaskList ? null : view === "active" ? (
          <ul className="space-y-2">
            {tasks
              .filter((t) => !t.archived)
              .map((t) => (
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
    </>
  );
}