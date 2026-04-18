"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { COMMANDS } from "./commands";
import { ALL_COMMANDS, CWD_MAP, QUICK_ACTIONS, SPINNER_FRAMES, STORAGE_CWD_KEY, STORAGE_HISTORY_KEY } from "./constants";
import { parseCommandInput } from "./parser";
import { isAbortError, linesToSequentialStream, sleep } from "./streams";
import type { Line, LineInput, StreamEvent } from "./types";

interface TerminalRuntime {
  lines: Line[];
  inputValue: string;
  setInputValue: (value: string) => void;
  cwd: string;
  isLoading: boolean;
  loadingLabel: string;
  spinnerGlyph: string;
  outputRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  quickActions: readonly string[];
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  runQuickAction: (action: string) => void;
}

export function useTerminalRuntime(): TerminalRuntime {
  const bootDate = new Date().toDateString();
  const initialCwd = "~/portfolio";
  const initialLines: Line[] = [
    { id: 1, type: "dim", value: `Last login: ${bootDate} on ttys001` },
    { id: 2, type: "success", value: "macos-terminal runtime ready. Type 'help' to start." },
    { id: 3, type: "dim", value: "" },
    { id: 4, type: "cmd", value: "", cwd: initialCwd },
  ];

  const [lines, setLines] = useState<Line[]>(initialLines);
  const [inputValue, setInputValue] = useState("");
  const [history, setHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_HISTORY_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const [, setHistoryIndex] = useState(-1);
  const [cwd, setCwd] = useState<string>(() => {
    if (typeof window === "undefined") {
      return initialCwd;
    }
    return window.localStorage.getItem(STORAGE_CWD_KEY) || initialCwd;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("running...");
  const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);

  const lineIdRef = useRef(initialLines.length);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRunRef = useRef<AbortController | null>(null);

  const nextId = () => {
    lineIdRef.current += 1;
    return lineIdRef.current;
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines, isLoading]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
  }, [history]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_CWD_KEY, cwd);
  }, [cwd]);

  useEffect(() => {
    if (!isLoading) {
      return;
    }
    const id = setInterval(() => {
      setSpinnerFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 90);
    return () => clearInterval(id);
  }, [isLoading]);

  function appendLines(newLines: LineInput[]) {
    setLines((prev) => [...prev, ...newLines.map((line) => ({ ...line, id: nextId() }))]);
  }

  async function runStream(events: StreamEvent[], signal: AbortSignal) {
    for (const event of events) {
      await sleep(event.delayMs ?? 0, signal);
      if (event.kind === "status") {
        setLoadingLabel(event.value);
      } else {
        appendLines([event.line]);
      }
    }
  }

  async function executeWithController(
    commandLabel: string,
    onRun: (signal: AbortSignal) => Promise<void>,
    onErrorMessage: string,
  ) {
    const controller = new AbortController();
    activeRunRef.current = controller;
    setIsLoading(true);
    setLoadingLabel(commandLabel);
    setSpinnerFrameIndex(0);

    try {
      await onRun(controller.signal);
    } catch (error) {
      if (isAbortError(error)) {
        appendLines([{ type: "err", value: "^C interrupted" }]);
      } else {
        appendLines([{ type: "err", value: onErrorMessage }]);
      }
    } finally {
      if (activeRunRef.current === controller) {
        activeRunRef.current = null;
      }
      setIsLoading(false);
      setLoadingLabel("running...");
    }
  }

  function interruptActiveRun() {
    if (activeRunRef.current) {
      activeRunRef.current.abort();
    }
  }

  async function run(rawInput: string) {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return;
    }

    if (isLoading) {
      appendLines([{ type: "dim", value: "A command is already running. Press Ctrl+C to interrupt." }]);
      return;
    }

    appendLines([{ type: "cmd", value: trimmed, cwd }]);

    const nextHistory = [trimmed, ...history];
    setHistory(nextHistory);
    setHistoryIndex(-1);

    const parsed = parseCommandInput(trimmed);
    if (parsed.length === 0) {
      return;
    }

    const [cmd, ...args] = parsed;

    if (cmd === "cd") {
      const target = args[0];
      let nextCwd = cwd;
      let invalidTarget: string | null = null;

      if (!target || target === "~") {
        nextCwd = "~/portfolio";
      } else if (target === "..") {
        const parts = cwd.split("/");
        parts.pop();
        nextCwd = parts.join("/") || "~";
      } else {
        const next = `${cwd}/${target}`;
        if (CWD_MAP[next]) {
          nextCwd = next;
        } else {
          invalidTarget = target;
        }
      }

      await executeWithController(
        "running cd...",
        async (signal) => {
          if (invalidTarget) {
            await runStream(
              linesToSequentialStream(
                [
                  { type: "err", value: `cd: no such file or directory: ${invalidTarget}` },
                  { type: "dim", value: "" },
                ],
                { firstDelayMs: 120, lineDelayMs: 60 },
              ),
              signal,
            );
            return;
          }

          setCwd(nextCwd);
          await runStream(
            linesToSequentialStream(
              [
                { type: "dim", value: `cwd -> ${nextCwd}` },
                { type: "dim", value: "" },
              ],
              { firstDelayMs: 120, lineDelayMs: 60 },
            ),
            signal,
          );
        },
        "error running command: cd",
      );
      return;
    }

    if (cmd === "pwd") {
      await executeWithController(
        "reading cwd...",
        async (signal) => {
          await runStream(linesToSequentialStream([{ type: "out", value: cwd }]), signal);
        },
        "error running command: pwd",
      );
      return;
    }

    if (cmd === "date") {
      await executeWithController(
        "reading date...",
        async (signal) => {
          await runStream(linesToSequentialStream([{ type: "out", value: new Date().toString() }]), signal);
        },
        "error running command: date",
      );
      return;
    }

    if (cmd === "history") {
      const historyLines =
        nextHistory.length === 0
          ? [{ type: "dim" as const, value: "No history yet." }]
          : nextHistory
              .slice(0, 20)
              .map((entry, idx) => ({ type: "dim" as const, value: `${idx + 1}  ${entry}` }));

      await executeWithController(
        "reading history...",
        async (signal) => {
          await runStream(linesToSequentialStream(historyLines), signal);
        },
        "error running command: history",
      );
      return;
    }

    const command = COMMANDS[cmd];
    if (!command) {
      await executeWithController(
        `running ${cmd}...`,
        async (signal) => {
          await runStream(
            linesToSequentialStream(
              [
                { type: "err", value: `command not found: ${cmd}` },
                { type: "dim", value: "hint: type 'help' to list available commands" },
              ],
              { firstDelayMs: 120, lineDelayMs: 70 },
            ),
            signal,
          );
        },
        `error running command: ${cmd}`,
      );
      return;
    }

    await executeWithController(
      `running ${cmd}...`,
      async (signal) => {
        const result = await command(args, { cwd, history: nextHistory });

        if (result.clearBefore) {
          setLines([{ id: nextId(), type: "cmd", value: "", cwd }]);
          return;
        }

        if (result.lines && result.lines.length > 0) {
          await runStream(linesToSequentialStream(result.lines), signal);
        }

        if (result.stream && result.stream.length > 0) {
          await runStream(result.stream, signal);
        }

        if (typeof result.exitCode === "number" && result.exitCode !== 0) {
          await runStream(
            linesToSequentialStream([{ type: "err", value: `exit ${result.exitCode}` }], {
              firstDelayMs: 70,
              lineDelayMs: 70,
            }),
            signal,
          );
        }
      },
      `error running command: ${cmd}`,
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.ctrlKey && event.key.toLowerCase() === "c") || event.key === "Escape") {
      event.preventDefault();
      interruptActiveRun();
      return;
    }

    if (event.key === "Enter") {
      const value = inputValue;
      setInputValue("");
      void run(value);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHistoryIndex((prev) => {
        const next = Math.min(prev + 1, history.length - 1);
        setInputValue(history[next] ?? "");
        return next;
      });
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHistoryIndex((prev) => {
        const next = prev - 1;
        if (next < 0) {
          setInputValue("");
          return -1;
        }
        setInputValue(history[next] ?? "");
        return next;
      });
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const trimmed = inputValue.trimStart();
      const pieces = parseCommandInput(trimmed);

      if (pieces.length <= 1 && !trimmed.includes(" ")) {
        const partial = pieces[0] ?? trimmed;
        const matches = ALL_COMMANDS.filter((command) => command.startsWith(partial));
        if (matches.length === 1) {
          setInputValue(`${matches[0]} `);
        } else if (matches.length > 1) {
          appendLines([{ type: "dim", value: matches.join("  ") }]);
        }
      }
      return;
    }

    if (event.key.toLowerCase() === "l" && event.ctrlKey) {
      event.preventDefault();
      setLines([]);
    }
  }

  function runQuickAction(action: string) {
    setInputValue("");
    void run(action);
    inputRef.current?.focus();
  }

  return {
    lines,
    inputValue,
    setInputValue,
    cwd,
    isLoading,
    loadingLabel,
    spinnerGlyph: SPINNER_FRAMES[spinnerFrameIndex],
    outputRef,
    inputRef,
    quickActions: QUICK_ACTIONS,
    handleKeyDown,
    runQuickAction,
  };
}
