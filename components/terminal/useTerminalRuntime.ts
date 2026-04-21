"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { BUILTIN_COMMANDS } from "./commands";
import { buildCommandPackRuntime, parseCommandPackJson, type CommandPack } from "./commandPacks";
import { BASE_QUICK_ACTIONS, BUILTIN_COMMAND_NAMES, CWD_MAP, SPINNER_FRAMES } from "./constants";
import { parseCommandInput } from "./parser";
import { isAbortError, linesToSequentialStream, sleep } from "./streams";
import type { Line, LineInput, QuickAction, StreamEvent } from "./types";

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
  quickActions: QuickAction[];
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  runQuickAction: (action: QuickAction) => void;
  importCommandPack: (file: File) => Promise<void>;
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
  const [commandPacks, setCommandPacks] = useState<CommandPack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("running...");
  const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);

  const packRuntime = useMemo(
    () => buildCommandPackRuntime(commandPacks, BUILTIN_COMMAND_NAMES),
    [commandPacks],
  );
  const availableCommands = useMemo(
    () => [...BUILTIN_COMMAND_NAMES, ...packRuntime.commandNames].sort((a, b) => a.localeCompare(b)),
    [packRuntime.commandNames],
  );
  const commandTriggers = useMemo(
    () => [...BUILTIN_COMMAND_NAMES, ...packRuntime.triggerNames].sort((a, b) => a.localeCompare(b)),
    [packRuntime.triggerNames],
  );
  const quickActions = useMemo(() => {
    const merged: QuickAction[] = [...BASE_QUICK_ACTIONS];
    const seen = new Set<string>(BASE_QUICK_ACTIONS.map((item) => `${item.label}::${item.command}`));
    for (const action of packRuntime.quickActions) {
      const key = `${action.label}::${action.command}`;
      if (seen.has(key)) {
        continue;
      }
      merged.push(action);
      seen.add(key);
    }
    return merged;
  }, [packRuntime.quickActions]);

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

  async function importCommandPack(file: File) {
    let raw = "";
    try {
      raw = await file.text();
    } catch {
      appendLines([{ type: "err", value: `failed to read file: ${file.name}` }]);
      return;
    }

    const parseResult = parseCommandPackJson(raw);
    if (!parseResult.ok || !parseResult.pack) {
      appendLines([
        { type: "err", value: `invalid command pack: ${file.name}` },
        ...parseResult.errors.slice(0, 6).map((error) => ({ type: "dim" as const, value: `  - ${error}` })),
      ]);
      return;
    }
    const pack = parseResult.pack;

    let action: "added" | "updated" = "added";
    let rejectedForLimit = false;
    let acceptedCommandCount = 0;
    let warnings: string[] = [];

    setCommandPacks((prev) => {
      const existingIndex = prev.findIndex((existingPack) => existingPack.id === pack.id);
      if (existingIndex === -1 && prev.length >= 20) {
        rejectedForLimit = true;
        return prev;
      }

      const next =
        existingIndex === -1
          ? [...prev, pack]
          : prev.map((existingPack, index) => (index === existingIndex ? pack : existingPack));

      action = existingIndex === -1 ? "added" : "updated";
      const previewRuntime = buildCommandPackRuntime(next, BUILTIN_COMMAND_NAMES);
      const summary = previewRuntime.packSummaries.find((item) => item.id === pack.id);
      acceptedCommandCount = summary?.commandCount ?? 0;
      warnings = previewRuntime.warnings.filter((warning) => warning.includes(`"${pack.id}"`));
      return next;
    });

    if (rejectedForLimit) {
      appendLines([
        { type: "err", value: "cannot import more than 20 command packs" },
        { type: "dim", value: "remove one existing pack id, then import again" },
      ]);
      return;
    }

    const droppedCount = pack.commands.length - acceptedCommandCount;
    appendLines([
      {
        type: "success",
        value: `${action} pack "${pack.id}" with ${acceptedCommandCount} command${acceptedCommandCount > 1 ? "s" : ""}`,
      },
      ...(droppedCount > 0
        ? [
            {
              type: "dim" as const,
              value: `  ${droppedCount} command${droppedCount > 1 ? "s were" : " was"} skipped due to name conflicts`,
            },
          ]
        : []),
      ...warnings.slice(0, 3).map((warning) => ({ type: "dim" as const, value: `  ${warning}` })),
    ]);
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

    const commandContext = {
      cwd,
      history: nextHistory,
      availableCommands,
      loadedPacks: packRuntime.packSummaries,
    };

    const command = BUILTIN_COMMANDS[cmd] ?? packRuntime.commandMap[cmd];
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

  function runQuickAction(action: QuickAction) {
    setInputValue("");
    void run(action.command);
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
    quickActions,
    handleKeyDown,
    runQuickAction,
    importCommandPack,
  };
}
