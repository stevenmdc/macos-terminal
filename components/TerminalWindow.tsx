"use client";

import { Maximize2, Minimize2, Moon, Square, Sun } from "lucide-react";
import Image from "next/image";
import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { LINE_COLORS } from "./terminal/constants";
import type { Line, LineType } from "./terminal/types";
import { useTerminalRuntime } from "./terminal/useTerminalRuntime";

interface SlashItem {
  id: string;
  group: "Agent" | "Shell" | "Info";
  label: string;
  command: string;
  description: string;
}

type TerminalSize = "sm" | "md" | "lg";
type TerminalTheme = "light" | "dark";

interface TerminalSizePreset {
  id: TerminalSize;
  label: string;
  dimensions: string;
  maxWidthClass: string;
  outputHeightClass: string;
}

const SLASH_ITEMS: SlashItem[] = [
  {
    id: "claude",
    group: "Agent",
    label: "claude code",
    command: "claude code ",
    description: "Run agent-style cascade",
  },
  {
    id: "skills",
    group: "Agent",
    label: "skills",
    command: "skills",
    description: "List skill presets",
  },
  {
    id: "models",
    group: "Agent",
    label: "models",
    command: "models",
    description: "List model profiles",
  },
  {
    id: "reasoning",
    group: "Agent",
    label: "reasoning",
    command: "reasoning",
    description: "Show reasoning profile",
  },
  {
    id: "exec-build",
    group: "Shell",
    label: "exec build",
    command: "exec npm run build",
    description: "Simulate production build",
  },
  {
    id: "exec-lint",
    group: "Shell",
    label: "exec lint",
    command: "exec npm run lint",
    description: "Simulate lint run",
  },
  {
    id: "exec-status",
    group: "Shell",
    label: "exec git status",
    command: "exec git status",
    description: "Simulate git status",
  },
  {
    id: "mcp",
    group: "Info",
    label: "mcp",
    command: "mcp",
    description: "Show MCP connector status",
  },
  {
    id: "projects",
    group: "Info",
    label: "projects",
    command: "projects",
    description: "List active projects",
  },
  {
    id: "stack",
    group: "Info",
    label: "stack",
    command: "stack",
    description: "Show tech stack",
  },
  {
    id: "packs",
    group: "Info",
    label: "packs",
    command: "packs",
    description: "List loaded command packs",
  },
  {
    id: "history",
    group: "Info",
    label: "history",
    command: "history",
    description: "Show command history",
  },
  {
    id: "etat",
    group: "Info",
    label: "état",
    command: "état",
    description: "Show current terminal state",
  },
  {
    id: "help",
    group: "Info",
    label: "help",
    command: "help",
    description: "Show available commands",
  },
  {
    id: "clear",
    group: "Shell",
    label: "clear",
    command: "clear",
    description: "Clear terminal output",
  },
];

const TERMINAL_SIZE_PRESETS: Record<TerminalSize, TerminalSizePreset> = {
  sm: {
    id: "sm",
    label: "S",
    dimensions: "72x20",
    maxWidthClass: "max-w-3xl",
    outputHeightClass: "h-[340px] sm:h-[390px]",
  },
  md: {
    id: "md",
    label: "M",
    dimensions: "80x24",
    maxWidthClass: "max-w-4xl",
    outputHeightClass: "h-[420px] sm:h-[470px]",
  },
  lg: {
    id: "lg",
    label: "L",
    dimensions: "100x30",
    maxWidthClass: "max-w-5xl",
    outputHeightClass: "h-[500px] sm:h-[560px]",
  },
};

const TERMINAL_SIZE_BUTTONS = [
  { id: "sm" as const, icon: Minimize2, title: "Compact size" },
  { id: "md" as const, icon: Square, title: "Default size" },
  { id: "lg" as const, icon: Maximize2, title: "Large size" },
];

const DARK_LINE_COLORS: Record<Exclude<LineType, "cmd">, string> = {
  out: "text-[#d7dbe2]",
  err: "text-[#ff6b5f]",
  info: "text-[#4ca9c7]",
  highlight: "text-[#d8a448]",
  dim: "text-[#8f95a3]",
  success: "text-[#5fbf6d]",
};

function TrafficLight({ color }: { color: string }) {
  return <span className={`h-3 w-3 rounded-full ${color}`} />;
}

function PromptLine({
  cwd,
  cmd,
  promptClass,
  cmdClass,
}: {
  cwd: string;
  cmd: string;
  promptClass: string;
  cmdClass: string;
}) {
  return (
    <div className="font-mono text-base font-medium leading-7 break-all">
      <span className={promptClass}>steven@macbook-pro {cwd} %</span>{" "}
      <span className={cmdClass}>{cmd}</span>
    </div>
  );
}

function OutputLine({
  line,
  index,
  lineColors,
  promptClass,
  cmdClass,
}: {
  line: Line;
  index: number;
  lineColors: Record<Exclude<LineType, "cmd">, string>;
  promptClass: string;
  cmdClass: string;
}) {
  const lineStyle = {
    animationDelay: `${index * 14}ms`,
  } as const;

  if (line.type === "cmd") {
    return (
      <div style={lineStyle} className="terminal-line-reveal">
        <PromptLine
          cwd={line.cwd ?? "~"}
          cmd={line.value}
          promptClass={promptClass}
          cmdClass={cmdClass}
        />
      </div>
    );
  }

  return (
    <div
      style={lineStyle}
      className={`terminal-line-reveal font-mono text-base font-medium leading-7 whitespace-pre-wrap break-words ${lineColors[line.type]}`}
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
    importCommandPack,
  } = useTerminalRuntime();
  const importInputRef = useRef<HTMLInputElement>(null);

  const [terminalSize, setTerminalSize] = useState<TerminalSize>("md");
  const [terminalTheme, setTerminalTheme] = useState<TerminalTheme>("light");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [inputScrollLeft, setInputScrollLeft] = useState(0);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const slashQuery = inputValue.startsWith("/")
    ? inputValue.slice(1).trim().toLowerCase()
    : null;
  const activePreset = TERMINAL_SIZE_PRESETS[terminalSize];
  const inputPlaceholder = isLoading
    ? "command running... press Ctrl+C to interrupt"
    : "type 'help' to start";
  const isDark = terminalTheme === "dark";
  const lineColors = isDark ? DARK_LINE_COLORS : LINE_COLORS;
  const promptClass = isDark ? "text-[#4ca9c7]" : "text-[#1a6b8a]";
  const commandTextClass = isDark ? "text-[#d7dbe2]" : "text-[#22262c]";
  const placeholderClass = isDark ? "text-[#8f95a3]" : "text-[#9a9a8e]";
  const loadingClass = isDark ? "text-[#8f95a3]" : "text-[#9a9a8e]";
  const terminalStyle = {
    colorScheme: isDark ? "dark" : "light",
  } as CSSProperties;

  const slashItems = useMemo(() => {
    if (slashQuery === null) {
      return [] as SlashItem[];
    }
    if (slashQuery.length === 0) {
      return SLASH_ITEMS;
    }
    return SLASH_ITEMS.filter((item) => {
      const haystack =
        `${item.group} ${item.label} ${item.command} ${item.description}`.toLowerCase();
      return haystack.includes(slashQuery);
    });
  }, [slashQuery]);

  const showSlashMenu = !isLoading && slashQuery !== null;
  const slashSelectedItem = slashItems[slashSelectedIndex] ?? null;

  const groupedSlashItems = useMemo(() => {
    const order: Array<SlashItem["group"]> = ["Agent", "Shell", "Info"];
    return order
      .map((group) => ({
        group,
        items: slashItems.filter((item) => item.group === group),
      }))
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
        setSlashSelectedIndex(
          (prev) => (prev - 1 + slashItems.length) % slashItems.length,
        );
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
    <div className="relative mx-auto w-full">
      <div className={`mx-auto w-full ${activePreset.maxWidthClass}`}>
        <div
          style={terminalStyle}
          className={`relative overflow-hidden rounded-[18px] border ${
            isDark
              ? "border-[#2f3440] bg-[#15181e] shadow-[0_30px_74px_rgba(2,6,14,0.56)]"
              : "border-[#b6b1a6] bg-[var(--window-shell)] shadow-[0_30px_74px_rgba(16,20,27,0.23)]"
          }`}
          onClick={() => inputRef.current?.focus()}
        >
          <div
            className={`relative flex h-11 items-center border-b px-4 ${
              isDark
                ? "border-[#2f3440] bg-[#1d222b]"
                : "border-[#bfb9ae] bg-[var(--window-bar)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <TrafficLight color="bg-[#ff5f57]" />
              <TrafficLight color="bg-[#febc2e]" />
              <TrafficLight color="bg-[#28c840]" />
            </div>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="hidden items-center gap-2 sm:flex">
                <Image
                  src="/images/folder-icon.png"
                  alt="Folder icon"
                  width={24}
                  height={24}
                  className="h-auto w-auto rounded-sm"
                />
                <span
                  className={`font-mono text-base font-medium tracking-wide whitespace-nowrap ${
                    isDark ? "text-[#b3bac6]" : "text-[#636a72]"
                  }`}
                >
                  steven@macbook-pro - zsh - {activePreset.dimensions}
                </span>
              </div>

              <div className="flex items-center gap-2 sm:hidden">
                <Image
                  src="/images/folder-icon.png"
                  alt="Folder icon"
                  width={14}
                  height={14}
                  className="h-auto w-auto rounded-sm"
                />
                <span
                  className={`font-mono text-sm font-medium tracking-wide ${
                    isDark ? "text-[#b3bac6]" : "text-[#636a72]"
                  }`}
                >
                  terminal
                </span>
              </div>
            </div>
          </div>

          <div
            ref={outputRef}
            className={`${activePreset.outputHeightClass} overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5 ${
              isDark
                ? "bg-[#101419] [&::-webkit-scrollbar-thumb]:bg-[#485266]"
                : "bg-[var(--window-panel)] [&::-webkit-scrollbar-thumb]:bg-[#c2beb6]"
            }`}
          >
            <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
              {quickActions.map((action) => (
                <button
                  key={`${action.label}:${action.command}`}
                  type="button"
                  onClick={() => runQuickAction(action)}
                  className={`shrink-0 rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7f90b3] ${
                    isDark
                      ? "border-[#37414f] bg-[#1a1f27] text-[#adb4bf] hover:bg-[#252c36] hover:text-[#e2e6ed]"
                      : "border-[#d3cec2] bg-[#f2efe8] text-[#5f6368] hover:bg-[#e9e4da] hover:text-[#2b2e32]"
                  }`}
                >
                  {action.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className={`shrink-0 rounded-md border border-dashed px-2.5 py-1 font-mono text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7f90b3] ${
                  isDark
                    ? "border-[#48515d] bg-[#171d24] text-[#9ea6b3] hover:bg-[#252c36] hover:text-[#e2e6ed]"
                    : "border-[#b5aea2] bg-[#f7f4ee] text-[#6a6f77] hover:bg-[#eee8dd] hover:text-[#2b2e32]"
                }`}
              >
                import json
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) {
                    return;
                  }
                  void importCommandPack(file);
                }}
              />
            </div>

            {lines.map((line, index) => (
              <OutputLine
                key={line.id}
                line={line}
                index={index}
                lineColors={lineColors}
                promptClass={promptClass}
                cmdClass={commandTextClass}
              />
            ))}

            {isLoading && (
              <div className={`mt-2 font-mono text-base font-medium ${loadingClass}`}>
                {spinnerGlyph} {loadingLabel}
              </div>
            )}

            <div className="relative mt-2 flex items-center gap-0">
              <span className={`font-mono text-base font-medium whitespace-nowrap ${promptClass}`}>
                steven@macbook-pro {cwd} %
              </span>
              <div className="relative ml-1 w-full flex-1 overflow-hidden">
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
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  onScroll={(event) =>
                    setInputScrollLeft(event.currentTarget.scrollLeft)
                  }
                  placeholder=""
                  className="w-full flex-1 border-none bg-transparent font-mono text-base font-medium text-transparent caret-transparent outline-none"
                />
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-0 overflow-hidden font-mono text-base font-medium whitespace-pre ${commandTextClass}`}
                >
                  <span
                    style={{ transform: `translateX(-${inputScrollLeft}px)` }}
                    className="inline-block will-change-transform"
                  >
                    {inputValue.length > 0 ? (
                      inputValue
                    ) : !isInputFocused ? (
                      <span className={placeholderClass}>{inputPlaceholder}</span>
                    ) : null}
                    {!isLoading ? (
                      <span
                        className={`ml-px inline-block h-[1em] w-[0.58em] translate-y-[0.08em] rounded-[1px] ${
                          isDark ? "bg-[#4ca9c7]" : "bg-[#1a6b8a]"
                        }`}
                      />
                    ) : null}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {showSlashMenu && (
            <div
              className={`absolute bottom-11 left-4 right-4 z-[80] overflow-hidden rounded-lg border shadow-[0_14px_30px_rgba(20,24,31,0.14)] sm:bottom-12 sm:left-6 sm:right-6 ${
                isDark
                  ? "border-[#3a4351] bg-[#1b2129]"
                  : "border-[#cec9bf] bg-[#f5f2ec]"
              }`}
            >
              {slashItems.length === 0 ? (
                <div
                  className={`px-3 py-2 font-mono text-[12px] ${
                    isDark ? "text-[#8f95a3]" : "text-[#72767f]"
                  }`}
                >
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
                                      ? isDark
                                        ? "bg-[#2b3340] text-[#e2e6ed]"
                                        : "bg-[#e9e4da] text-[#22262c]"
                                      : isDark
                                        ? "text-[#adb4bf] hover:bg-[#252c36] hover:text-[#e2e6ed]"
                                        : "text-[#5f6368] hover:bg-[#ece7de] hover:text-[#2b2e32]"
                                  }`}
                                >
                                  <span>{item.label}</span>
                                  <span
                                    className={`ml-3 text-[11px] ${
                                      isDark ? "text-[#8f95a3]" : "text-[#8a8f96]"
                                    }`}
                                  >
                                    {item.description}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div
                    className={`hidden max-h-60 overflow-y-auto border-l p-3 sm:block ${
                      isDark
                        ? "border-[#343d4a] bg-[#161b23]"
                        : "border-[#dfdbd2] bg-[#f0ece4]"
                    }`}
                  >
                    {slashSelectedItem ? (
                      <div className="font-mono">
                        <div
                          className={`text-[10px] uppercase tracking-wide ${
                            isDark ? "text-[#8f95a3]" : "text-[#8a8f96]"
                          }`}
                        >
                          Preview
                        </div>
                        <div
                          className={`mt-1 text-[12px] ${
                            isDark ? "text-[#d7dbe2]" : "text-[#2b2f36]"
                          }`}
                        >
                          {slashSelectedItem.label}
                        </div>
                        <div
                          className={`mt-2 rounded border px-2 py-1 text-[11px] ${
                            isDark
                              ? "border-[#3a4351] bg-[#1b2129] text-[#adb4bf]"
                              : "border-[#d7d1c7] bg-[#f8f5ef] text-[#4f5561]"
                          }`}
                        >
                          {slashSelectedItem.command}
                        </div>
                        <div
                          className={`mt-2 text-[11px] ${
                            isDark ? "text-[#8f95a3]" : "text-[#6f7580]"
                          }`}
                        >
                          {slashSelectedItem.description}
                        </div>
                        <div
                          className={`mt-2 text-[10px] ${
                            isDark ? "text-[#8f95a3]" : "text-[#8a8f96]"
                          }`}
                        >
                          Enter/Tab to insert
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none fixed right-2 top-1/2 z-30 hidden -translate-y-1/2 lg:block">
        <div
          className={`pointer-events-auto flex flex-col gap-1 rounded-lg border p-1.5 shadow-[0_12px_30px_rgba(21,24,32,0.14)] backdrop-blur ${
            isDark
              ? "border-[#3a4351] bg-[#141a22]/95"
              : "border-[#c9c2b7] bg-[#f4f0e8]/95"
          }`}
        >
          {TERMINAL_SIZE_BUTTONS.map((item) => {
            const preset = TERMINAL_SIZE_PRESETS[item.id];
            const Icon = item.icon;
            const isActive = terminalSize === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={`${item.title} (${preset.dimensions})`}
                aria-pressed={isActive}
                title={`${item.title} (${preset.dimensions})`}
                onClick={() => setTerminalSize(item.id)}
                className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                  isActive
                    ? isDark
                      ? "border-[#5c78a2] bg-[#223248] text-[#b3d3ff]"
                      : "border-[#8ea3c6] bg-[#dbe7f9] text-[#2f4f78]"
                    : isDark
                      ? "border-[#3a4351] bg-[#1b2129] text-[#8f95a3] hover:bg-[#252c36] hover:text-[#e2e6ed]"
                      : "border-[#d8d2c8] bg-[#f8f4ec] text-[#6b717a] hover:bg-[#ede7dc] hover:text-[#2c3138]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="sr-only">{preset.label}</span>
              </button>
            );
          })}

          <div className={`my-1 h-px ${isDark ? "bg-[#3a4351]" : "bg-[#d8d2c8]"}`} />

          <button
            type="button"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTerminalTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
              isDark
                ? "border-[#3a4351] bg-[#1b2129] text-[#f4d37b] hover:bg-[#252c36]"
                : "border-[#d8d2c8] bg-[#f8f4ec] text-[#5f6368] hover:bg-[#ede7dc] hover:text-[#2c3138]"
            }`}
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
