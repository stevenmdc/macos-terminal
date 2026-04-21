import type { LineType, QuickAction } from "./types";

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

export const STORAGE_HISTORY_KEY = "macos-terminal.history";
export const STORAGE_CWD_KEY = "macos-terminal.cwd";
export const STORAGE_COMMAND_PACKS_KEY = "macos-terminal.command-packs";

export const BASE_QUICK_ACTIONS: QuickAction[] = [
  { label: "help", command: "help" },
  { label: "état", command: "état" },
  { label: "skills", command: "skills" },
  { label: "models", command: "models" },
  { label: "exec npm run build", command: "exec npm run build" },
  {
    label: "claude code...",
    command: "claude code visualize all states of onboarding and push each screen to figma",
  },
  { label: "projects", command: "projects" },
  { label: "stack", command: "stack" },
  { label: "clear", command: "clear" },
];

export const CWD_MAP: Record<string, string[]> = {
  "~/portfolio": ["app", "components", "public", "package.json", "README.md"],
  "~/portfolio/app": ["layout.tsx", "page.tsx", "globals.css"],
  "~/portfolio/components": ["TerminalWindow.tsx", "AnimatedBackground.tsx"],
  "~/portfolio/public": ["images", "favicon.ico"],
};

export const BUILTIN_COMMAND_NAMES = [
  "help",
  "about",
  "whoami",
  "ls",
  "cd",
  "pwd",
  "date",
  "history",
  "état",
  "etat",
  "skills",
  "models",
  "mcp",
  "reasoning",
  "exec",
  "claude",
  "projects",
  "stack",
  "contact",
  "packs",
  "clear",
] as const;

export const LINE_COLORS: Record<Exclude<LineType, "cmd">, string> = {
  out: "text-[#262a30]",
  err: "text-[#c0392b]",
  info: "text-[#1a6b8a]",
  highlight: "text-[#b8860b]",
  dim: "text-[#9a9a8e]",
  success: "text-[#2d7a3a]",
};
