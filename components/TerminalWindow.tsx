"use client";

import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { LINE_COLORS } from "./terminal/constants";
import type { Line } from "./terminal/types";
import { useTerminalRuntime } from "./terminal/useTerminalRuntime";

interface SlashItem {
  id: string;
  group: "Agent" | "Shell" | "Info";
  label: string;
  command: string;
  description: string;
}

const SLASH_ITEMS: SlashItem[] = [
  { id: "claude", group: "Agent", label: "claude code", command: "claude code ", description: "Run agent-style cascade" },
  { id: "skills", group: "Agent", label: "skills", command: "skills", description: "List skill presets" },
  { id: "models", group: "Agent", label: "models", command: "models", description: "List model profiles" },
  { id: "reasoning", group: "Agent", label: "reasoning", command: "reasoning", description: "Show reasoning profile" },
  { id: "exec-build", group: "Shell", label: "exec build", command: "exec npm run build", description: "Simulate production build" },
  { id: "exec-lint", group: "Shell", label: "exec lint", command: "exec npm run lint", description: "Simulate lint run" },
  { id: "exec-status", group: "Shell", label: "exec git status", command: "exec git status", description: "Simulate git status" },
  { id: "mcp", group: "Info", label: "mcp", command: "mcp", description: "Show MCP connector status" },
  { id: "projects", group: "Info", label: "projects", command: "projects", description: "List active projects" },
  { id: "stack", group: "Info", label: "stack", command: "stack", description: "Show tech stack" },
  { id: "history", group: "Info", label: "history", command: "history", description: "Show command history" },
  { id: "etat", group: "Info", label: "état", command: "état", description: "Show current terminal state" },
  { id: "help", group: "Info", label: "help", command: "help", description: "Show available commands" },
  { id: "clear", group: "Shell", label: "clear", command: "clear", description: "Clear terminal output" },
];

function TrafficLight({ color }: { color: string }) {
  return <span className={`h-3 w-3 rounded-full ${color}`} />;
}

function PromptLine({ cwd, cmd }: { cwd: string; cmd: string }) {
  return (
    <div className="font-mono text-[13px] leading-[1.75] break-all">
      <span className="text-[#2d7b4c]">steven@macbook-pro {cwd} %</span>{" "}
      <span className="text-[#22262c]">{cmd}</span>
    </div>
  );
}

function OutputLine({ line, index }: { line: Line; index: number }) {
  const lineStyle = {
    animationDelay: `${index * 14}ms`,
  } as const;

  if (line.type === "cmd") {
    return (
      <div style={lineStyle} className="terminal-line-reveal">
        <PromptLine cwd={line.cwd ?? "~"} cmd={line.value} />
      </div>
    );
  }

  return (
    <div
      style={lineStyle}
      className={`terminal-line-reveal font-mono text-[13px] leading-[1.75] whitespace-pre-wrap break-words ${LINE_COLORS[line.type]}`}
    >
      {line.value}
    </div>
  );
}

export default function TerminalWindow() {
  const {
    lines,
    inputValue,
    setInputValue,
    cwd,
    isLoading,
    loadingLabel,
    spinnerGlyph,
    outputRef,
    inputRef,
    quickActions,
    handleKeyDown,
    runQuickAction,
  } = useTerminalRuntime();

  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const slashQuery = inputValue.startsWith("/") ? inputValue.slice(1).trim().toLowerCase() : null;

  const slashItems = useMemo(() => {
    if (slashQuery === null) {
      return [] as SlashItem[];
    }
    if (slashQuery.length === 0) {
      return SLASH_ITEMS;
    }
    return SLASH_ITEMS.filter((item) => {
      const haystack = `${item.group} ${item.label} ${item.command} ${item.description}`.toLowerCase();
      return haystack.includes(slashQuery);
    });
  }, [slashQuery]);

  const showSlashMenu = !isLoading && slashQuery !== null;
  const slashSelectedItem = slashItems[slashSelectedIndex] ?? null;

  const groupedSlashItems = useMemo(() => {
    const order: Array<SlashItem["group"]> = ["Agent", "Shell", "Info"];
    return order
      .map((group) => ({ group, items: slashItems.filter((item) => item.group === group) }))
      .filter((entry) => entry.items.length > 0);
  }, [slashItems]);

  const slashIndexById = useMemo(() => {
    return slashItems.reduce<Record<string, number>>((acc, item, index) => {
      acc[item.id] = index;
      return acc;
    }, {});
  }, [slashItems]);

  function applySlashItem(item: SlashItem) {
    setInputValue(item.command);
    setSlashSelectedIndex(0);
    inputRef.current?.focus();
  }

  function handleInputChange(nextValue: string) {
    if (nextValue.startsWith("/")) {
      setSlashSelectedIndex(0);
    }
    setInputValue(nextValue);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (showSlashMenu && slashItems.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashSelectedIndex((prev) => (prev + 1) % slashItems.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashSelectedIndex((prev) => (prev - 1 + slashItems.length) % slashItems.length);
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applySlashItem(slashItems[slashSelectedIndex] ?? slashItems[0]);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setInputValue("");
        return;
      }
    }

    handleKeyDown(event);
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div
        className="overflow-hidden rounded-[18px] border border-[#b6b1a6] bg-[var(--window-shell)] shadow-[0_30px_74px_rgba(16,20,27,0.23)]"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex h-11 items-center gap-2 border-b border-[#bfb9ae] bg-[var(--window-bar)] px-4">
          <TrafficLight color="bg-[#ff5f57]" />
          <TrafficLight color="bg-[#febc2e]" />
          <TrafficLight color="bg-[#28c840]" />
          <span className="mx-auto hidden pr-[42px] font-mono text-[12px] tracking-wide text-[#636a72] sm:block">
            steven@macbook-pro - zsh - 80x24
          </span>
          <span className="mx-auto pr-[42px] font-mono text-[12px] tracking-wide text-[#636a72] sm:hidden">
            terminal
          </span>
        </div>

        <div
          ref={outputRef}
          className="h-[420px] overflow-y-auto bg-[var(--window-panel)] px-4 py-4 sm:h-[470px] sm:px-6 sm:py-5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[#c2beb6] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
        >
          <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
            {quickActions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => runQuickAction(action)}
                className="shrink-0 rounded-md border border-[#d3cec2] bg-[#f2efe8] px-2.5 py-1 font-mono text-[11px] text-[#5f6368] transition-colors hover:bg-[#e9e4da] hover:text-[#2b2e32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7f90b3]"
              >
                {action.startsWith("claude code") ? "claude code..." : action}
              </button>
            ))}
          </div>

          {lines.map((line, index) => (
            <OutputLine key={line.id} line={line} index={index} />
          ))}

          {isLoading && (
            <div className="mt-2 font-mono text-[13px] text-[#6f7580]">
              {spinnerGlyph} {loadingLabel}
            </div>
          )}
        </div>

        <div className="relative flex flex-col items-start gap-1 border-t border-[#cbc5bb] bg-[#eeebe4] px-5 py-2.5 sm:flex-row sm:items-center sm:gap-0 sm:px-6 sm:py-3">
          {showSlashMenu && (
            <div className="absolute bottom-full left-4 right-4 z-20 mb-2 overflow-hidden rounded-lg border border-[#cec9bf] bg-[#f5f2ec] shadow-[0_14px_30px_rgba(20,24,31,0.14)] sm:left-6 sm:right-6">
              {slashItems.length === 0 ? (
                <div className="px-3 py-2 font-mono text-[12px] text-[#72767f]">
                  No slash command found.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_270px]">
                  <div className="max-h-60 overflow-y-auto overscroll-contain py-1">
                    {groupedSlashItems.map((group) => (
                      <div key={group.group}>
                        <div className="px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-[#8a8f96]">
                          {group.group}
                        </div>
                        <ul>
                          {group.items.map((item) => {
                            const idx = slashIndexById[item.id] ?? 0;
                            const isSelected = idx === slashSelectedIndex;
                            return (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() => applySlashItem(item)}
                                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left font-mono text-[12px] transition-colors ${
                                    isSelected
                                      ? "bg-[#e9e4da] text-[#22262c]"
                                      : "text-[#5f6368] hover:bg-[#ece7de] hover:text-[#2b2e32]"
                                  }`}
                                >
                                  <span>{item.label}</span>
                                  <span className="ml-3 text-[11px] text-[#8a8f96]">{item.description}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="hidden max-h-60 overflow-y-auto border-l border-[#dfdbd2] bg-[#f0ece4] p-3 sm:block">
                    {slashSelectedItem ? (
                      <div className="font-mono">
                        <div className="text-[10px] uppercase tracking-wide text-[#8a8f96]">Preview</div>
                        <div className="mt-1 text-[12px] text-[#2b2f36]">{slashSelectedItem.label}</div>
                        <div className="mt-2 rounded border border-[#d7d1c7] bg-[#f8f5ef] px-2 py-1 text-[11px] text-[#4f5561]">
                          {slashSelectedItem.command}
                        </div>
                        <div className="mt-2 text-[11px] text-[#6f7580]">{slashSelectedItem.description}</div>
                        <div className="mt-2 text-[10px] text-[#8a8f96]">Enter/Tab to insert</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}

          <span className="font-mono text-[12px] text-[#2d7b4c] sm:whitespace-nowrap sm:text-[13px]">
            steven@macbook-pro {cwd} %&nbsp;
          </span>
          <input
            ref={inputRef}
            type="text"
            aria-label="Terminal command input"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={inputValue}
            onChange={(event) => handleInputChange(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={isLoading ? "command running... press Ctrl+C to interrupt" : "type 'help' to start"}
            className="w-full flex-1 border-none bg-transparent font-mono text-[13px] text-[#20242a] outline-none placeholder:text-[#80858d] caret-[#2d7b4c]"
          />
        </div>
      </div>
    </div>
  );
}
