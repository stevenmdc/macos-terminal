import { CWD_MAP } from "./constants";
import { buildClaudeCodeStream, buildExecStream } from "./streams";
import type { CommandFn, LineInput } from "./types";

export const BUILTIN_COMMANDS: Record<string, CommandFn> = {
  help: async (_, ctx) => ({
    lines: [
      { type: "info", value: "Available commands" },
      {
        type: "dim",
        value: `  ${ctx.availableCommands.join("  ")}`,
      },
      { type: "dim", value: "  shortcuts: [tab] autocomplete, [↑↓] history, [ctrl+c|esc] interrupt, [ctrl+l] clear" },
      { type: "dim", value: '  examples: exec npm run build · claude code "design onboarding flow" · cmds · cmd 1' },
    ],
  }),
  about: async () => ({
    lines: [
      { type: "out", value: "Steven - solo full-stack maker building practical products." },
      { type: "out", value: "Focus: Next.js, Supabase, Stripe, automation and local AI." },
      { type: "info", value: "Principle: ship simple, iterate fast, keep ownership." },
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
  état: async (_, ctx) => ({
    lines: [
      { type: "info", value: "Terminal state" },
      { type: "out", value: `cwd        ${ctx.cwd}` },
      { type: "out", value: `history    ${ctx.history.length} commands` },
      { type: "dim", value: "runtime    virtual cascade engine enabled" },
      { type: "dim", value: "interrupt  Ctrl+C or Esc" },
    ],
  }),
  etat: async (_, ctx) => BUILTIN_COMMANDS["état"]([], ctx),
  skills: async () => ({
    lines: [
      { type: "info", value: "Skill presets (virtual)" },
      { type: "out", value: "  /skills terminal-ui            Terminal interaction patterns" },
      { type: "out", value: "  /skills product-docs           Product docs and handoff notes" },
      { type: "out", value: "  /skills frontend-polish        Visual polish and responsive QA" },
      { type: "dim", value: "Tip: use slash menu to insert these quickly." },
    ],
  }),
  models: async () => ({
    lines: [
      { type: "info", value: "Model profiles (virtual)" },
      { type: "out", value: "  gpt-5.4         quality-first default" },
      { type: "out", value: "  gpt-5.4-mini    faster/cheaper iteration" },
      { type: "out", value: "  claude-opus     long-form agentic flows" },
      { type: "dim", value: "Use 'reasoning' to inspect current reasoning profile." },
    ],
  }),
  mcp: async () => ({
    lines: [
      { type: "info", value: "MCP connectors (virtual status)" },
      { type: "out", value: "  github      available" },
      { type: "out", value: "  local-files available" },
      { type: "out", value: "  terminal    available" },
      { type: "dim", value: "In this UI, MCP calls are simulated." },
    ],
  }),
  reasoning: async () => ({
    lines: [
      { type: "info", value: "Reasoning profile (virtual)" },
      { type: "out", value: "  mode        high" },
      { type: "out", value: "  strategy    sequential tool-first execution" },
      { type: "out", value: "  fallback    interrupt + recover" },
      { type: "dim", value: "Profile can be changed later per command family." },
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
