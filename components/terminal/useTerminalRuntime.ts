"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { BUILTIN_COMMANDS } from "./commands";
import { BASE_QUICK_ACTIONS, BUILTIN_COMMAND_NAMES, CWD_MAP, SPINNER_FRAMES } from "./constants";
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
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

interface ExecuteOptions {
  execStateIndicator?: boolean;
}

export function useTerminalRuntime(): TerminalRuntime {
  const bootDate = new Date().toDateString();
  const initialCwd = "~/portfolio";
  const initialLines: Line[] = [
    { id: 1, type: "dim", value: `Last login: ${bootDate} on ttys001` },
    { id: 2, type: "success", value: "macos-terminal runtime ready. Type 'help' to start." },
    { id: 3, type: "dim", value: "" },
  ];

  const [lines, setLines] = useState<Line[]>(initialLines);
  const [inputValue, setInputValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [, setHistoryIndex] = useState(-1);
  const [cwd, setCwd] = useState<string>(initialCwd);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("running...");
  const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);

  const availableCommands = useMemo(
    () => [...BUILTIN_COMMAND_NAMES].sort((a, b) => a.localeCompare(b)),
    [],
  );
  const commandTriggers = useMemo(
    () => [...BUILTIN_COMMAND_NAMES].sort((a, b) => a.localeCompare(b)),
    [],
  );
  const quickActions = useMemo(() => {
    return [...BASE_QUICK_ACTIONS];
  }, []);

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

  function appendLine(line: LineInput): number {
    const id = nextId();
    setLines((prev) => [...prev, { ...line, id }]);
    return id;
  }

  function updateLine(id: number, line: LineInput) {
    setLines((prev) =>
      prev.map((existing) => {
        if (existing.id !== id) {
          return existing;
        }
        return { ...existing, ...line, id };
      }),
    );
  }

  async function runStream(events: StreamEvent[], signal: AbortSignal) {
    const progressLineIdByKey = new Map<string, number>();
    for (const event of events) {
      await sleep(event.delayMs ?? 0, signal);
      if (event.kind === "status") {
        setLoadingLabel(event.value);
      } else if (event.kind === "line") {
        appendLines([event.line]);
      } else {
        const existingLineId = progressLineIdByKey.get(event.key);
        if (typeof existingLineId === "number") {
          updateLine(existingLineId, event.line);
          continue;
        }

        const newLineId = appendLine(event.line);
        progressLineIdByKey.set(event.key, newLineId);
      }
    }
  }

  async function executeWithController(
    commandLabel: string,
    onRun: (signal: AbortSignal) => Promise<void>,
    onErrorMessage: string,
    options?: ExecuteOptions,
  ) {
    const controller = new AbortController();
    activeRunRef.current = controller;
    setIsLoading(true);
    setLoadingLabel(commandLabel);
    setSpinnerFrameIndex(0);
    const showExecState = options?.execStateIndicator === true;
    let execStateLineId: number | null = null;
    let execStateBlinkVisible = true;
    let execStateBlinkInterval: ReturnType<typeof setInterval> | null = null;
    let completedSuccessfully = false;

    if (showExecState) {
      execStateLineId = appendLine({ type: "info", value: "● exec" });
      execStateBlinkInterval = setInterval(() => {
        if (execStateLineId === null) {
          return;
        }
        execStateBlinkVisible = !execStateBlinkVisible;
        updateLine(execStateLineId, {
          type: "info",
          value: `${execStateBlinkVisible ? "●" : " "} exec`,
        });
      }, 420);
    }

    try {
      await onRun(controller.signal);
      completedSuccessfully = true;
    } catch (error) {
      if (isAbortError(error)) {
        appendLines([{ type: "err", value: "^C interrupted" }]);
      } else {
        appendLines([{ type: "err", value: onErrorMessage }]);
      }
    } finally {
      if (execStateBlinkInterval) {
        clearInterval(execStateBlinkInterval);
      }
      if (execStateLineId !== null) {
        updateLine(execStateLineId, {
          type: completedSuccessfully ? "success" : "err",
          value: completedSuccessfully ? "● done" : "● interrupted",
        });
      }
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

    if (cmd === "cmds" || cmd === "cmd") {
      const usageLines: LineInput[] = [
        { type: "err", value: "usage: cmds | cmds run <id> | cmd <id>" },
        { type: "dim", value: "example: cmds run 3" },
      ];

      const listCmds = async () => {
        const lines: LineInput[] = [
          { type: "info", value: "Pre-commands" },
          ...quickActions.map((action, index) => ({
            type: "out" as const,
            value: `  ${index + 1}  ${action.label} -> ${action.command}`,
          })),
          { type: "dim", value: "Run one with: cmds run <id> or cmd <id>" },
        ];
        await executeWithController(
          "reading pre-commands...",
          async (signal) => {
            await runStream(linesToSequentialStream(lines), signal);
          },
          "error running command: cmds",
        );
      };

      const runQuickCommandAtIndex = async (rawIndex: string | undefined) => {
        const parsedIndex = Number.parseInt(rawIndex ?? "", 10);
        if (!Number.isInteger(parsedIndex) || parsedIndex < 1 || parsedIndex > quickActions.length) {
          await executeWithController(
            "reading pre-commands...",
            async (signal) => {
              await runStream(linesToSequentialStream(usageLines), signal);
            },
            "error running command: cmds",
          );
          return;
        }

        await run(quickActions[parsedIndex - 1].command);
      };

      if (cmd === "cmd" && args.length === 1) {
        await runQuickCommandAtIndex(args[0]);
        return;
      }

      if (args.length === 0 || args[0] === "list") {
        await listCmds();
        return;
      }

      if (args[0] === "run") {
        await runQuickCommandAtIndex(args[1]);
        return;
      }

      await executeWithController(
        "reading pre-commands...",
        async (signal) => {
          await runStream(linesToSequentialStream(usageLines), signal);
        },
        "error running command: cmds",
      );
      return;
    }

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

    const commandContext = {
      cwd,
      history: nextHistory,
      availableCommands,
    };

    const command = BUILTIN_COMMANDS[cmd];
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
        const result = await command(args, commandContext);

        if (result.clearBefore) {
          setLines([]);
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
      { execStateIndicator: cmd === "exec" },
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
        const matches = commandTriggers.filter((command) => command.startsWith(partial));
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
    handleKeyDown,
  };
}
