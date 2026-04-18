"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";

type LineType = "out" | "err" | "info" | "highlight" | "dim" | "success" | "cmd";

interface Line {
  id: number;
  type: LineType;
  value: string;
  cwd?: string;
}

type LineInput = Omit<Line, "id">;

interface CommandContext {
  cwd: string;
  history: string[];
}

interface CommandRun {
  clearBefore?: boolean;
  lines?: LineInput[];
  stream?: StreamEvent[];
  exitCode?: number;
}

type StreamEvent =
  | { kind: "line"; line: LineInput; delayMs?: number }
  | { kind: "status"; value: string; delayMs?: number };

type CommandFn = (args: string[], ctx: CommandContext) => Promise<CommandRun>;

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

const STORAGE_HISTORY_KEY = "macos-terminal.history";
const STORAGE_CWD_KEY = "macos-terminal.cwd";

const QUICK_ACTIONS = [
  "help",
  "exec npm run build",
  "claude code visualize all states of onboarding and push each screen to figma",
  "projects",
  "stack",
  "clear",
] as const;

const CWD_MAP: Record<string, string[]> = {
  "~/portfolio": ["app", "components", "public", "package.json", "README.md"],
  "~/portfolio/app": ["layout.tsx", "page.tsx", "globals.css"],
  "~/portfolio/components": ["TerminalWindow.tsx", "AnimatedBackground.tsx"],
  "~/portfolio/public": ["images", "favicon.ico"],
};

const ALL_COMMANDS = [
  "help",
  "about",
  "whoami",
  "ls",
  "cd",
  "pwd",
  "date",
  "history",
  "exec",
  "claude",
  "projects",
  "stack",
  "contact",
  "clear",
] as const;

const LINE_COLORS: Record<Exclude<LineType, "cmd">, string> = {
  out: "text-[#262a30]",
  err: "text-[#b42318]",
  info: "text-[#2d587f]",
  highlight: "text-[#2f6f3b]",
  dim: "text-[#6d727a]",
  success: "text-[#2e7a4b]",
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function parseCommandInput(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaped) {
    current += "\\";
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function buildExecStream(target: string): StreamEvent[] {
  const normalized = target.trim();
  if (!normalized) {
    return [
      { kind: "line", line: { type: "err", value: "usage: exec <command>" } },
      { kind: "line", line: { type: "dim", value: "example: exec npm run build" }, delayMs: 60 },
    ];
  }

  if (normalized === "npm run build") {
    return [
      { kind: "status", value: "Running npm run build...", delayMs: 120 },
      { kind: "line", line: { type: "info", value: "▶ npm run build" }, delayMs: 140 },
      { kind: "line", line: { type: "dim", value: "Creating an optimized production build..." }, delayMs: 300 },
      { kind: "line", line: { type: "success", value: "✓ Compiled successfully" }, delayMs: 420 },
      { kind: "line", line: { type: "dim", value: "Running TypeScript checks..." }, delayMs: 240 },
      { kind: "line", line: { type: "success", value: "✓ TypeScript passed" }, delayMs: 260 },
      { kind: "line", line: { type: "out", value: "Route (app)  /" }, delayMs: 180 },
      { kind: "line", line: { type: "success", value: "● done in 2.8s (exit 0)" }, delayMs: 120 },
    ];
  }

  if (normalized === "npm run lint") {
    return [
      { kind: "status", value: "Running npm run lint...", delayMs: 120 },
      { kind: "line", line: { type: "info", value: "▶ npm run lint" }, delayMs: 120 },
      { kind: "line", line: { type: "dim", value: "Linting project files..." }, delayMs: 320 },
      { kind: "line", line: { type: "success", value: "✓ No lint errors" }, delayMs: 240 },
      { kind: "line", line: { type: "success", value: "● done in 1.2s (exit 0)" }, delayMs: 100 },
    ];
  }

  if (normalized === "git status") {
    return [
      { kind: "status", value: "Running git status...", delayMs: 120 },
      { kind: "line", line: { type: "info", value: "On branch main" }, delayMs: 120 },
      { kind: "line", line: { type: "out", value: "Changes not staged for commit:" }, delayMs: 180 },
      { kind: "line", line: { type: "dim", value: "  modified: app/page.tsx" }, delayMs: 80 },
      { kind: "line", line: { type: "dim", value: "  modified: components/TerminalWindow.tsx" }, delayMs: 80 },
      { kind: "line", line: { type: "success", value: "● done in 0.3s (exit 0)" }, delayMs: 100 },
    ];
  }

  return [
    { kind: "status", value: `Running ${normalized}...`, delayMs: 120 },
    { kind: "line", line: { type: "info", value: `▶ ${normalized}` }, delayMs: 140 },
    { kind: "line", line: { type: "dim", value: "Executing virtual shell command..." }, delayMs: 280 },
    { kind: "line", line: { type: "success", value: "✓ command completed" }, delayMs: 220 },
    { kind: "line", line: { type: "success", value: "● done in 0.9s (exit 0)" }, delayMs: 100 },
  ];
}

function buildClaudeCodeStream(task: string, cwd: string): StreamEvent[] {
  const target = task.trim() || "audit this repo and suggest the next 3 actions";
  const editTarget = target.toLowerCase().includes("onboarding")
    ? "src/screens/Onboarding/Welcome.tsx"
    : "components/TerminalWindow.tsx";

  return [
    { kind: "status", value: "Booting Claude Code agent...", delayMs: 120 },
    { kind: "line", line: { type: "out", value: "Claude Code v2.1.42" }, delayMs: 120 },
    { kind: "line", line: { type: "dim", value: "Opus 4.6 · Claude Enterprise" }, delayMs: 80 },
    { kind: "line", line: { type: "dim", value: `/Users/np/code/claude-cli-internal (${cwd})` }, delayMs: 80 },
    { kind: "line", line: { type: "dim", value: "" }, delayMs: 40 },
    { kind: "line", line: { type: "info", value: `› ${target}` }, delayMs: 120 },
    { kind: "status", value: "Reading repository context...", delayMs: 360 },
    { kind: "line", line: { type: "highlight", value: "• Read(app/page.tsx)" }, delayMs: 100 },
    { kind: "line", line: { type: "highlight", value: "• Read(components/TerminalWindow.tsx)" }, delayMs: 90 },
    { kind: "status", value: "Planning edit cascade...", delayMs: 280 },
    { kind: "line", line: { type: "highlight", value: `• Edit(${editTarget})` }, delayMs: 140 },
    { kind: "line", line: { type: "dim", value: "  └ +38 lines · -6 lines" }, delayMs: 100 },
    { kind: "status", value: "Running checks...", delayMs: 350 },
    { kind: "line", line: { type: "success", value: "✓ npm run lint" }, delayMs: 130 },
    { kind: "line", line: { type: "success", value: "✓ npm run build" }, delayMs: 130 },
    { kind: "line", line: { type: "dim", value: "" }, delayMs: 60 },
    { kind: "line", line: { type: "success", value: "* Done. Ready to apply patch." }, delayMs: 60 },
    { kind: "line", line: { type: "out", value: '> Try "claude code fix lint errors in onboarding flow"' }, delayMs: 60 },
    { kind: "line", line: { type: "dim", value: "? for shortcuts" }, delayMs: 40 },
  ];
}

const COMMANDS: Record<string, CommandFn> = {
  help: async () => ({
    lines: [
      { type: "info", value: "Available commands" },
      {
        type: "dim",
        value:
          "  help  about  whoami  ls  cd  pwd  date  history  exec  claude  projects  stack  contact  clear",
      },
      { type: "dim", value: "  shortcuts: [tab] autocomplete, [↑↓] history, [ctrl+c|esc] interrupt, [ctrl+l] clear" },
      { type: "dim", value: "  examples: exec npm run build · claude code \"design onboarding flow\"" },
    ],
  }),
  about: async () => ({
    lines: [
      { type: "out", value: "Steven - solo full-stack maker building practical products." },
      { type: "out", value: "Focus: Next.js, Supabase, Stripe, automation and local AI." },
      { type: "success", value: "Principle: ship simple, iterate fast, keep ownership." },
    ],
  }),
  whoami: async () => ({
    lines: [
      { type: "out", value: "steven" },
      { type: "dim", value: "uid=1000(steven) gid=1000(staff) groups=staff,admin" },
    ],
  }),
  ls: async (_, ctx) => {
    const files = CWD_MAP[ctx.cwd] ?? CWD_MAP["~/portfolio"];
    const directories = files.filter((entry) => !entry.includes("."));
    const plainFiles = files.filter((entry) => entry.includes("."));
    const lines: LineInput[] = [];

    if (directories.length > 0) {
      lines.push({ type: "info", value: directories.map((d) => `${d}/`).join("  ") });
    }
    if (plainFiles.length > 0) {
      lines.push({ type: "out", value: plainFiles.join("  ") });
    }

    return { lines };
  },
  projects: async () => ({
    lines: [
      { type: "highlight", value: "code-ste.vercel.app" },
      { type: "out", value: "  Starter kits and productized templates." },
      { type: "highlight", value: "3dprint-ste.com" },
      { type: "out", value: "  Subscription STL catalog for practical prints." },
      { type: "highlight", value: "OpenClaw" },
      { type: "out", value: "  Local automation agent running on Raspberry Pi." },
    ],
  }),
  stack: async () => ({
    lines: [
      { type: "out", value: "Frontend : Next.js, Tailwind CSS, Framer Motion" },
      { type: "out", value: "Backend  : Supabase, PostgreSQL, Edge Functions" },
      { type: "out", value: "Ops      : Vercel, Cloudflare, GitHub Actions" },
      { type: "out", value: "AI       : Anthropic API, Ollama, vLLM" },
    ],
  }),
  contact: async () => ({
    lines: [
      { type: "out", value: "X         @stevenmdc" },
      { type: "out", value: "Location  Brest, France" },
      { type: "dim", value: "DMs open for collabs and product engineering work." },
    ],
  }),
  exec: async (args) => ({
    stream: buildExecStream(args.join(" ")),
  }),
  claude: async (args, ctx) => {
    if (args[0] !== "code") {
      return {
        lines: [
          { type: "err", value: "usage: claude code <task>" },
          { type: "dim", value: 'example: claude code "visualize all onboarding states and push to figma"' },
        ],
        exitCode: 2,
      };
    }

    return {
      stream: buildClaudeCodeStream(args.slice(1).join(" "), ctx.cwd),
    };
  },
  clear: async () => ({ lines: [], clearBefore: true }),
};

function TrafficLight({ color }: { color: string }) {
  return <span className={`h-3 w-3 rounded-full ${color}`} />;
}

function PromptLine({ cwd, cmd }: { cwd: string; cmd: string }) {
  return (
    <div className="font-mono text-[13px] leading-[1.75] break-all">
      <span className="text-[#2d7b4c]">steven@macbook {cwd} %</span>{" "}
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
  const bootDate = new Date().toDateString();
  const initialLines: Line[] = [
    { id: 1, type: "dim", value: `Last login: ${bootDate} on ttys001` },
    { id: 2, type: "success", value: "macos-terminal runtime ready. Type 'help' to start." },
    { id: 3, type: "dim", value: "" },
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
      return "~/portfolio";
    }
    return window.localStorage.getItem(STORAGE_CWD_KEY) || "~/portfolio";
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

      if (!target || target === "~") {
        setCwd("~/portfolio");
      } else if (target === "..") {
        setCwd((prev) => {
          const parts = prev.split("/");
          parts.pop();
          return parts.join("/") || "~";
        });
      } else {
        const next = `${cwd}/${target}`;
        if (CWD_MAP[next]) {
          setCwd(next);
        } else {
          appendLines([{ type: "err", value: `cd: no such file or directory: ${target}` }]);
        }
      }

      appendLines([{ type: "dim", value: "" }]);
      return;
    }

    if (cmd === "pwd") {
      appendLines([{ type: "out", value: cwd }]);
      return;
    }

    if (cmd === "date") {
      appendLines([{ type: "out", value: new Date().toString() }]);
      return;
    }

    if (cmd === "history") {
      if (nextHistory.length === 0) {
        appendLines([{ type: "dim", value: "No history yet." }]);
        return;
      }

      appendLines(
        nextHistory
          .slice(0, 20)
          .map((entry, idx) => ({ type: "dim" as const, value: `${idx + 1}  ${entry}` })),
      );
      return;
    }

    const command = COMMANDS[cmd];
    if (!command) {
      appendLines([
        { type: "err", value: `command not found: ${cmd}` },
        { type: "dim", value: "hint: type 'help' to list available commands" },
      ]);
      return;
    }

    const controller = new AbortController();
    activeRunRef.current = controller;
    setIsLoading(true);
    setLoadingLabel(`running ${cmd}...`);
    setSpinnerFrameIndex(0);

    try {
      const result = await command(args, { cwd, history: nextHistory });

      if (result.clearBefore) {
        setLines([]);
      } else if (result.lines && result.lines.length > 0) {
        appendLines(result.lines);
      }

      if (result.stream && result.stream.length > 0) {
        await runStream(result.stream, controller.signal);
      }

      if (typeof result.exitCode === "number" && result.exitCode !== 0) {
        appendLines([{ type: "err", value: `exit ${result.exitCode}` }]);
      }
    } catch (error) {
      if (isAbortError(error)) {
        appendLines([{ type: "err", value: "^C interrupted" }]);
      } else {
        appendLines([{ type: "err", value: `error running command: ${cmd}` }]);
      }
    } finally {
      if (activeRunRef.current === controller) {
        activeRunRef.current = null;
      }
      setIsLoading(false);
      setLoadingLabel("running...");
    }
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
            steven@macbook - zsh - 80x24
          </span>
          <span className="mx-auto pr-[42px] font-mono text-[12px] tracking-wide text-[#636a72] sm:hidden">
            terminal
          </span>
        </div>

        <div
          ref={outputRef}
          className="h-[min(56vh,420px)] overflow-y-auto bg-[var(--window-panel)] px-4 py-4 sm:h-[min(62vh,470px)] sm:px-6 sm:py-5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[#c2beb6] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
        >
          <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
            {QUICK_ACTIONS.map((action) => (
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
              {SPINNER_FRAMES[spinnerFrameIndex]} {loadingLabel}
            </div>
          )}
        </div>

        <div className="flex flex-col items-start gap-1 border-t border-[#cbc5bb] bg-[#eeebe4] px-5 py-2.5 sm:flex-row sm:items-center sm:gap-0 sm:px-6 sm:py-3">
          <span className="font-mono text-[12px] text-[#2d7b4c] sm:whitespace-nowrap sm:text-[13px]">
            steven@macbook {cwd} %&nbsp;
          </span>
          <input
            ref={inputRef}
            type="text"
            aria-label="Terminal command input"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "command running... press Ctrl+C to interrupt" : "type 'help' to start"}
            className="w-full flex-1 border-none bg-transparent font-mono text-[13px] text-[#20242a] outline-none placeholder:text-[#80858d] caret-[#2d7b4c]"
          />
        </div>
      </div>
    </div>
  );
}
