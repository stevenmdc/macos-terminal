import type { LineInput, StreamEvent } from "./types";

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
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

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function linesToSequentialStream(
  lines: LineInput[],
  options?: { firstDelayMs?: number; lineDelayMs?: number },
): StreamEvent[] {
  const firstDelayMs = options?.firstDelayMs ?? 90;
  const lineDelayMs = options?.lineDelayMs ?? 70;
  return lines.map((line, index) => ({
    kind: "line" as const,
    line,
    delayMs: index === 0 ? firstDelayMs : lineDelayMs,
  }));
}

export function buildExecStream(target: string): StreamEvent[] {
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

export function buildClaudeCodeStream(task: string, cwd: string): StreamEvent[] {
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
