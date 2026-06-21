"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import useExplainableState from "@/hooks/useExplainableState.js";
import { ExplanationContext } from "@/context/ExplanationContext.jsx";
import { isNearDuplicate } from "@/lib/similarity.js";
import {
  GripVertical,
  Trash2,
  RotateCcw,
  Plus,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  RefreshCcw,
} from "lucide-react";

const AUTO_REMOVE_DELAY_MS = 3000;
const FEEDBACK_TIMEOUT_MS = 2200;

export default function ExplainableTodoApp() {
  const { logEvent, clearEventLog } = useContext(ExplanationContext);

  const [tasks, setTasksWithExplain, helpers] = useExplainableState(
    [],
    "TodoApp"
  );

  const [view, setView] = useState("active");
  const [newText, setNewText] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [showTaskList, setShowTaskList] = useState(true);

  const inputRef = useRef(null);
  const addEnabledRef = useRef(false);
  const emptyEnabledRef = useRef(false);
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

  const clearAllAutoRemoveTimers = () => {
    for (const [, timerId] of autoRemoveTimersRef.current) {
      clearTimeout(timerId);
    }

    autoRemoveTimersRef.current.clear();
  };

  const clearAutoRemoveTimer = (id) => {
    const existing = autoRemoveTimersRef.current.get(id);

    if (existing) {
      clearTimeout(existing);
      autoRemoveTimersRef.current.delete(id);
    }
  };

  const getTaskNameById = (id) => {
    const task = tasks.find((t) => t.id === id);
    return task?.text || "unknown task";
  };

  const handleResetApp = () => {
    const clearedTasksCount = tasks.length;

    clearAllAutoRemoveTimers();

    setNewText("");
    setView("active");
    setDraggedTaskId(null);
    setShowTaskList(true);

    addEnabledRef.current = false;
    emptyEnabledRef.current = false;

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    helpers.setState([]);
    clearEventLog();

    showFeedback("Application reset: all tasks and explanation history cleared.");

    setTimeout(() => {
      logEvent(
        "Application reset: all tasks and explanation history cleared",
        "TodoApp",
        {
          clearedTasks: clearedTasksCount,
          resetView: "active",
          taskListVisible: true,
        },
        "user",
        "semantic"
      );
    }, 0);
  };

  const handleToggleTaskList = () => {
    const nextVisible = !showTaskList;

    setShowTaskList(nextVisible);

    const message = nextVisible ? "Task list shown." : "Task list hidden.";

    showFeedback(message);

    logEvent(
      nextVisible ? "Task list shown" : "Task list hidden",
      "TodoApp",
      {
        visible: nextVisible,
        activeTasks: tasks.filter((t) => !t.archived).length,
        completedTasks: tasks.filter((t) => t.archived).length,
      },
      "user",
      "semantic"
    );
  };

  const addTask = (text, e) => {
    const trimmed = (text || "").trim();

    logEvent(
      `Add button pressed${trimmed ? `: ${trimmed}` : ""}`,
      "TodoApp",
      { text: trimmed },
      "user",
      "syntactic"
    );

    if (!trimmed) return;

    const match = tasks.find((t) => isNearDuplicate(t.text, trimmed));

    if (match) {
      const wasRemoved = !!match.archived;
      const previousText = match.text;

      logEvent(
        `Duplicate task detected: ${trimmed}`,
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
          `Task name updated: ${previousText} → ${trimmed}`,
          {
            id: match.id,
            text: trimmed,
            previousText,
            newText: trimmed,
            auto: true,
          }
        );
      }

      if (wasRemoved) {
        setTasksWithExplain(
          (prev) =>
            prev.map((t) =>
              t.id === match.id
                ? { ...t, archived: false, completed: false }
                : t
            ),
          `Removed duplicate task restored: ${trimmed}`,
          {
            id: match.id,
            text: trimmed,
            auto: true,
          }
        );
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

    setTasksWithExplain(
      (prev) => [newTask, ...prev],
      `Task added: ${trimmed}`,
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
        ? `Task marked as complete: ${taskName}`
        : `Task marked as incomplete: ${taskName}`,
      {
        id,
        text: taskName,
        completed: willBeCompleted,
      }
    );

    if (willBeCompleted) {
      clearAutoRemoveTimer(id);

      const timerId = setTimeout(() => {
        removeTask(id, {
          auto: true,
          elapsedMs: AUTO_REMOVE_DELAY_MS,
          taskName,
        });
      }, AUTO_REMOVE_DELAY_MS);

      autoRemoveTimersRef.current.set(id, timerId);
    } else {
      clearAutoRemoveTimer(id);
    }
  };

  const removeTask = (id, options = {}, e = null) => {
    if (!options.auto) {
      clearAutoRemoveTimer(id);
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
        ? `Completed task automatically removed: ${taskName}`
        : `Task manually removed: ${taskName}`,
      {
        id,
        text: taskName,
        auto: !!options.auto,
        elapsedMs: options.elapsedMs,
      }
    );

    showFeedback(
      options.auto
        ? `Completed task automatically removed: ${taskName}`
        : `Task manually removed: ${taskName}`
    );
  };

  const restoreTask = (id, e) => {
    const task = tasks.find((x) => x.id === id && x.archived);

    if (!task) return;

    const taskName = task.text;

    clearAutoRemoveTimer(id);

    setTasksWithExplain(
      (prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, archived: false, completed: false } : x
        ),
      `Task restored: ${taskName}`,
      {
        id,
        text: taskName,
      }
    );

    showFeedback(`Task restored: ${taskName}`);
  };

  const deleteTask = (id, e) => {
    const taskName = getTaskNameById(id);

    clearAutoRemoveTimer(id);

    setTasksWithExplain(
      (prev) => prev.filter((x) => x.id !== id),
      `Task permanently deleted: ${taskName}`,
      {
        id,
        text: taskName,
      }
    );

    showFeedback(`Permanently deleted: ${taskName}`);
  };

  const emptyRemoved = (e) => {
    clearAllAutoRemoveTimers();

    const removedTasks = tasks.filter((t) => t.archived);
    const count = removedTasks.length;
    const removedTaskNames = removedTasks.map((t) => t.text);

    setTasksWithExplain(
      (prev) => prev.filter((t) => !t.archived),
      count === 1
        ? `Permanently deleted: ${removedTaskNames[0]}`
        : `Permanently deleted: ${removedTaskNames.join(", ")}`,
      {
        count,
        tasks: removedTasks,
        text: removedTaskNames.join(", "),
      }
    );

    if (count > 0) {
      showFeedback(
        count === 1
          ? `Permanently deleted: ${removedTaskNames[0]}`
          : `Permanently deleted: ${removedTaskNames.join(", ")}`
      );
    }
  };

  const reorderTask = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const sourceTask = tasks.find((task) => task.id === sourceId);
    const targetTask = tasks.find((task) => task.id === targetId);

    const sourceName = sourceTask?.text || "unknown task";
    const targetName = targetTask?.text || "unknown task";

    setTasksWithExplain(
      (prev) => {
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
      },
      `Task reordered: ${sourceName}`,
      {
        id: sourceId,
        text: sourceName,
        targetId,
        targetText: targetName,
      }
    );
  };

  const removedCount = useMemo(
    () => tasks.filter((t) => t.archived).length,
    [tasks]
  );

  useEffect(() => {
    const enabled = removedCount > 0;

    if (enabled !== emptyEnabledRef.current) {
      logEvent(
        enabled ? "Enabled Empty completed" : "Disabled Empty completed",
        "TodoApp",
        { removedCount },
        "auto",
        "syntactic"
      );

      emptyEnabledRef.current = enabled;
    }
  }, [removedCount, logEvent]);

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
        className="rounded-xl p-1.5 text-white/45 cursor-grab transition hover:bg-white/10 hover:text-white/80 active:cursor-grabbing"
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

      <span className={`flex-1 ${t.completed ? "line-through opacity-60" : ""}`}>
        {t.text}
      </span>

      <button
        onClick={(e) => removeTask(t.id, {}, e)}
        className="rounded-xl p-1.5 text-red-300 transition hover:bg-red-400/10 hover:text-red-200"
        aria-label="Remove task"
        title="Remove task"
      >
        <Trash2 size={18} />
      </button>
    </li>
  );

  return (
    <>
      <div className="fixed right-6 top-6 z-40 flex items-center gap-2">
        <button
          onClick={handleToggleTaskList}
          className="inline-flex items-center gap-2 rounded-2xl border border-blue-300/25 bg-blue-400/20 px-4 py-2 text-sm text-white shadow-lg shadow-blue-950/30 backdrop-blur-xl transition duration-300 hover:border-blue-200/50 hover:bg-blue-300/30"
          aria-label={showTaskList ? "Hide task list" : "Show task list"}
        >
          {showTaskList ? <EyeOff size={15} /> : <Eye size={15} />}
          {showTaskList ? "Hide tasks" : "Show tasks"}
        </button>

        <button
          onClick={handleResetApp}
          className="inline-flex items-center gap-2 rounded-2xl border border-red-300/25 bg-red-400/15 px-4 py-2 text-sm text-white shadow-lg shadow-red-950/20 backdrop-blur-xl transition duration-300 hover:border-red-200/50 hover:bg-red-300/25"
          aria-label="Reset application"
        >
          <RefreshCcw size={15} />
          Reset
        </button>
      </div>

      <div className="max-w-xl w-full mx-auto rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-blue-950/40 backdrop-blur-2xl">
        <div className="mb-4 flex items-center gap-2">
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
                ? "border-blue-300/40 bg-blue-400/20 text-white shadow-lg shadow-blue-950/20"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Show completed tasks"
          >
            Completed
          </button>

          {view === "removed" && (
            <button
              onClick={emptyRemoved}
              disabled={removedCount === 0}
              className="ml-auto rounded-2xl border border-red-300/25 bg-red-400/15 px-4 py-2 text-white shadow-lg shadow-red-950/20 backdrop-blur-xl transition duration-300 hover:border-red-200/50 hover:bg-red-300/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-red-400/15"
              aria-label="Empty completed tasks"
            >
              Empty completed
            </button>
          )}
        </div>

        {!showTaskList ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-center text-sm text-white/60 backdrop-blur-xl">
            Task list hidden.
          </div>
        ) : view === "active" ? (
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
                      aria-label="Restore task"
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
    </>
  );
}