import type { LineType } from "./types";

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

export const STORAGE_HISTORY_KEY = "macos-terminal.history";
export const STORAGE_CWD_KEY = "macos-terminal.cwd";

export const QUICK_ACTIONS = [
  "help",
  "état",
  "skills",
  "models",
  "exec npm run build",
  "claude code visualize all states of onboarding and push each screen to figma",
  "projects",
  "stack",
  "clear",
] as const;

export const CWD_MAP: Record<string, string[]> = {
  "~/portfolio": ["app", "components", "public", "package.json", "README.md"],
  "~/portfolio/app": ["layout.tsx", "page.tsx", "globals.css"],
  "~/portfolio/components": ["TerminalWindow.tsx", "AnimatedBackground.tsx"],
  "~/portfolio/public": ["images", "favicon.ico"],
};

export const ALL_COMMANDS = [
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
  "clear",
] as const;

export const LINE_COLORS: Record<Exclude<LineType, "cmd">, string> = {
  out: "text-[#262a30]",
  err: "text-[#b42318]",
  info: "text-[#2d587f]",
  highlight: "text-[#2f6f3b]",
  dim: "text-[#6d727a]",
  success: "text-[#2e7a4b]",
};
