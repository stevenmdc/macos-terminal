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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function withRandomMs(text: string, minMs = 140, maxMs = 980): string {
  return `${text} (${randomInt(minMs, maxMs)}ms)`;
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
      { kind: "line", line: { type: "dim", value: "● done in 2.8s (exit 0)" }, delayMs: 120 },
    ];
  }

  if (normalized === "npm run lint") {
    return [
      { kind: "status", value: "Running npm run lint...", delayMs: 120 },
      { kind: "line", line: { type: "info", value: "▶ npm run lint" }, delayMs: 120 },
      { kind: "line", line: { type: "dim", value: "Linting project files..." }, delayMs: 320 },
      { kind: "line", line: { type: "success", value: "✓ No lint errors" }, delayMs: 240 },
      { kind: "line", line: { type: "dim", value: "● done in 1.2s (exit 0)" }, delayMs: 100 },
    ];
  }

  if (normalized === "git status") {
    return [
      { kind: "status", value: "Running git status...", delayMs: 120 },
      { kind: "line", line: { type: "info", value: "On branch main" }, delayMs: 120 },
      { kind: "line", line: { type: "out", value: "Changes not staged for commit:" }, delayMs: 180 },
      { kind: "line", line: { type: "dim", value: "  modified: app/page.tsx" }, delayMs: 80 },
      { kind: "line", line: { type: "dim", value: "  modified: components/TerminalWindow.tsx" }, delayMs: 80 },
      { kind: "line", line: { type: "dim", value: "● done in 0.3s (exit 0)" }, delayMs: 100 },
    ];
  }

  if (normalized === "agent boot --profile=business-full --dry-run=false") {
    const cycleDuration = (randomInt(72_000, 96_000) / 1000).toFixed(1);

    return [
      { kind: "status", value: "Booting OPENCLAW agentic runtime (8h cycle)...", delayMs: 2400 },
      {
        kind: "line",
        line: { type: "info", value: withRandomMs("▶ agent boot --profile=business-full --dry-run=false", 220, 780) },
        delayMs: 120,
      },
      { kind: "line", line: { type: "dim", value: "[BOOT] Runtime ready. Entering autonomous loop." }, delayMs: 2100 },
      { kind: "line", line: { type: "highlight", value: "PHASE 1/8 · INBOX SCAN" }, delayMs: 120 },
      {
        kind: "line",
        line: { type: "info", value: withRandomMs("● exec inbox.scan --sources=gmail,twitter,linkedin", 120, 420) },
        delayMs: 120,
      },
      { kind: "status", value: "Scanning inbox sources (gmail, twitter, linkedin)...", delayMs: 2800 },
      {
        kind: "line",
        line: { type: "out", value: "[INBOX] 42 items found · 9 high-priority · 7 requiring immediate response" },
        delayMs: 120,
      },
      {
        kind: "line",
        line: { type: "dim", value: withRandomMs("  ├ ● exec inbox.triage --priority=client_first --llm=sonnet", 220, 780) },
        delayMs: 120,
      },
      { kind: "status", value: "Generating reply drafts and triage queues...", delayMs: 3200 },
      {
        kind: "line",
        line: { type: "dim", value: withRandomMs("  └ ● exec inbox.reply --queue=P0,P1 --auto-send=true", 260, 920) },
        delayMs: 120,
      },
      { kind: "line", line: { type: "success", value: "[INBOX] Drafts ready: 7 · queued for approval: 2 · auto-sent: 3" }, delayMs: 120 },
      { kind: "line", line: { type: "highlight", value: "PHASE 2/8 · TREND SCAN" }, delayMs: 120 },
      {
        kind: "line",
        line: { type: "info", value: withRandomMs("● exec websearch.scan --topics=next.js,shopify,agentic workflows", 380, 1400) },
        delayMs: 120,
      },
      { kind: "status", value: "Running web trend scan and topic clustering...", delayMs: 3800 },
      {
        kind: "line",
        line: { type: "out", value: '[SEARCH] Signals aggregated: "agentic workflows", "Next.js", "solopreneur AI"' },
        delayMs: 120,
      },
      {
        kind: "line",
        line: { type: "dim", value: withRandomMs("  └ ● exec websearch.summarize --output=context/trends_today.md", 420, 1600) },
        delayMs: 120,
      },
      { kind: "line", line: { type: "highlight", value: "PHASE 3/8 · CONTENT BRAINSTORM" }, delayMs: 120 },
      {
        kind: "line",
        line: { type: "info", value: withRandomMs("● exec content.brainstorm --context=context/trends_today.md --count=12", 300, 1100) },
        delayMs: 120,
      },
      { kind: "status", value: "Selecting angles and generating editorial concepts...", delayMs: 2900 },
      {
        kind: "line",
        line: { type: "out", value: "[BRAINSTORM] 12 concepts generated · top 3 selected" },
        delayMs: 120,
      },
      {
        kind: "line",
        line: { type: "dim", value: withRandomMs("  └ ● exec content.select --pick=1,4 --reason=audience_fit", 180, 620) },
        delayMs: 120,
      },
      { kind: "line", line: { type: "highlight", value: "PHASE 4/8 · CONTENT WRITE" }, delayMs: 120 },
      {
        kind: "line",
        line: {
          type: "info",
          value: withRandomMs("● exec content.write --concepts=1,4 --formats=thread_x,post_linkedin,short_video_script", 520, 1900),
        },
        delayMs: 120,
      },
      { kind: "status", value: "Writing thread, LinkedIn post, and short video script...", delayMs: 4100 },
      {
        kind: "line",
        line: { type: "success", value: "[CONTENT] Deliverables generated: x_thread.md · linkedin.md · video_script.md" },
        delayMs: 120,
      },
      { kind: "line", line: { type: "highlight", value: "PHASE 5/8 · IMAGE GENERATION" }, delayMs: 120 },
      {
        kind: "line",
        line: { type: "info", value: withRandomMs("● exec image.generate --model=gpt-image-1 --count=6 --quality=hd", 900, 2600) },
        delayMs: 120,
      },
      { kind: "status", value: "Generating image batch (6 assets, HD)...", delayMs: 2400 },
      { kind: "progress", key: "image-progress", line: { type: "info", value: "[IMAGE] [█░░░░░░░░░] 10%" }, delayMs: 2300 },
      { kind: "progress", key: "image-progress", line: { type: "info", value: "[IMAGE] [██░░░░░░░░] 20%" }, delayMs: 2500 },
      { kind: "progress", key: "image-progress", line: { type: "info", value: "[IMAGE] [████░░░░░░] 40%" }, delayMs: 2600 },
      { kind: "progress", key: "image-progress", line: { type: "info", value: "[IMAGE] [██████░░░░] 60%" }, delayMs: 2800 },
      { kind: "progress", key: "image-progress", line: { type: "info", value: "[IMAGE] [████████░░] 80%" }, delayMs: 2400 },
      {
        kind: "progress",
        key: "image-progress",
        line: { type: "success", value: "[IMAGE] [██████████] 100% · 6/6 assets ready" },
        delayMs: 2200,
      },
      { kind: "line", line: { type: "err", value: "[FAIL] image.select returned low-confidence set (artifacts score too high)" }, delayMs: 260 },
      {
        kind: "line",
        line: { type: "dim", value: withRandomMs("  ├ ● exec image.select --retry=1 --criteria=brand_fit,no_artifacts --pick=3", 240, 860) },
        delayMs: 120,
      },
      { kind: "status", value: "Re-ranking candidates and applying artifact filter patch...", delayMs: 2100 },
      { kind: "line", line: { type: "success", value: "[FIX] solution found: switched to fallback candidate set (img_02,img_04,img_06)" }, delayMs: 120 },
      {
        kind: "line",
        line: { type: "dim", value: withRandomMs("  └ ● exec image.select --criteria=brand_fit,no_artifacts --pick=3", 160, 580) },
        delayMs: 120,
      },
      { kind: "line", line: { type: "highlight", value: "PHASE 6/8 · VIDEO COMPOSITION" }, delayMs: 120 },
      {
        kind: "line",
        line: { type: "info", value: withRandomMs("● exec video.compose --images=assets/selected --script=content/video_script.md", 1100, 3200) },
        delayMs: 120,
      },
      { kind: "status", value: "Composing short video from selected assets...", delayMs: 3000 },
      { kind: "progress", key: "video-progress", line: { type: "info", value: "[VIDEO] [█░░░░░░░░░] 10%" }, delayMs: 2600 },
      { kind: "progress", key: "video-progress", line: { type: "info", value: "[VIDEO] [███░░░░░░░] 30%" }, delayMs: 2900 },
      { kind: "progress", key: "video-progress", line: { type: "info", value: "[VIDEO] [█████░░░░░] 50%" }, delayMs: 3100 },
      { kind: "progress", key: "video-progress", line: { type: "info", value: "[VIDEO] [███████░░░] 70%" }, delayMs: 3300 },
      { kind: "progress", key: "video-progress", line: { type: "info", value: "[VIDEO] [█████████░] 90%" }, delayMs: 2700 },
      {
        kind: "progress",
        key: "video-progress",
        line: { type: "success", value: "[VIDEO] [██████████] 100% · rendered: video_agent_story_v1.mp4" },
        delayMs: 2400,
      },
      { kind: "line", line: { type: "err", value: "[FAIL] video.review detected weak hook (< 3s retention threshold)" }, delayMs: 220 },
      {
        kind: "line",
        line: { type: "dim", value: withRandomMs("  ├ ● exec video.compose --retry=1 --hook-cut=2.2s --cta-boost=true", 520, 1600) },
        delayMs: 120,
      },
      { kind: "status", value: "Applying narrative patch and regenerating intro cut...", delayMs: 2400 },
      { kind: "line", line: { type: "success", value: "[FIX] solution found: hook strengthened (+18% predicted retention)" }, delayMs: 120 },
      {
        kind: "line",
        line: { type: "dim", value: withRandomMs("  ├ ● exec video.review --checks=duration,hook_3s,cta_end", 320, 980) },
        delayMs: 120,
      },
      {
        kind: "line",
        line: { type: "dim", value: withRandomMs("  └ ● exec video.thumbnail --frame=2.4s --overlay=none", 140, 540) },
        delayMs: 120,
      },
      { kind: "line", line: { type: "highlight", value: "PHASE 7/8 · PUBLISH SCHEDULING" }, delayMs: 120 },
      {
        kind: "line",
        line: { type: "info", value: withRandomMs("● exec schedule.plan --calendar=true --timezone=Europe/Paris", 220, 760) },
        delayMs: 120,
      },
      { kind: "status", value: "Planning publishing slots and platform queue...", delayMs: 2600 },
      {
        kind: "line",
        line: { type: "success", value: "[PUBLISH] Slots reserved: 08:45, 12:30, 19:00 · monitor armed (6h window)" },
        delayMs: 120,
      },
      {
        kind: "line",
        line: { type: "dim", value: withRandomMs("  ├ ● exec publish --platform=linkedin --schedule=08:45", 120, 420) },
        delayMs: 120,
      },
      {
        kind: "line",
        line: { type: "dim", value: withRandomMs("  ├ ● exec publish --platform=twitter --schedule=12:30", 120, 420) },
        delayMs: 120,
      },
      {
        kind: "line",
        line: { type: "dim", value: withRandomMs("  └ ● exec publish --platform=tiktok,instagram --schedule=19:00,19:05", 180, 560) },
        delayMs: 120,
      },
      { kind: "line", line: { type: "highlight", value: "PHASE 8/8 · KPI SNAPSHOT" }, delayMs: 120 },
      {
        kind: "line",
        line: { type: "info", value: withRandomMs("● exec monitor.arm --triggers=reply,comment,mention --window=6h", 200, 640) },
        delayMs: 120,
      },
      { kind: "status", value: "Collecting KPI snapshot and writing daily report...", delayMs: 2800 },
      { kind: "line", line: { type: "out", value: "[KPI] MRR +2.1% · churn 2.0% · new signups +7 · github stars +12" }, delayMs: 120 },
      {
        kind: "line",
        line: { type: "dim", value: withRandomMs("  └ ● exec report.daily --output=logs/daily_20260428.md --push=notion", 240, 920) },
        delayMs: 120,
      },
      { kind: "line", line: { type: "success", value: "[REPORT] daily_20260428.md generated and synced" }, delayMs: 120 },
      { kind: "line", line: { type: "dim", value: `● done in ${cycleDuration}s (exit 0)` }, delayMs: 100 },
    ];
  }

  return [
    { kind: "status", value: `Running ${normalized}...`, delayMs: 120 },
    { kind: "line", line: { type: "info", value: `▶ ${normalized}` }, delayMs: 140 },
    { kind: "line", line: { type: "dim", value: "Executing virtual shell command..." }, delayMs: 280 },
    { kind: "line", line: { type: "success", value: "✓ command completed" }, delayMs: 220 },
    { kind: "line", line: { type: "dim", value: "● done in 0.9s (exit 0)" }, delayMs: 100 },
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
    { kind: "line", line: { type: "info", value: `> ${target}` }, delayMs: 120 },
    { kind: "status", value: "Reading repository context...", delayMs: 360 },
    { kind: "line", line: { type: "highlight", value: "● Read(app/page.tsx)" }, delayMs: 100 },
    { kind: "line", line: { type: "highlight", value: "● Read(components/TerminalWindow.tsx)" }, delayMs: 90 },
    { kind: "status", value: "Planning edit cascade...", delayMs: 280 },
    { kind: "line", line: { type: "highlight", value: `● Edit(${editTarget})` }, delayMs: 140 },
    { kind: "line", line: { type: "dim", value: "  └ +38 lines · -6 lines" }, delayMs: 100 },
    { kind: "status", value: "Running checks...", delayMs: 350 },
    { kind: "line", line: { type: "success", value: "✓ npm run lint" }, delayMs: 130 },
    { kind: "line", line: { type: "success", value: "✓ npm run build" }, delayMs: 130 },
    { kind: "line", line: { type: "dim", value: "" }, delayMs: 60 },
    { kind: "line", line: { type: "info", value: "● Done. Ready to apply patch." }, delayMs: 60 },
    { kind: "line", line: { type: "out", value: '> Try "claude code fix lint errors in onboarding flow"' }, delayMs: 60 },
    { kind: "line", line: { type: "dim", value: "? for shortcuts" }, delayMs: 40 },
  ];
}
