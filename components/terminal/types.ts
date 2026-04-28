export type LineType = "out" | "err" | "info" | "highlight" | "dim" | "success" | "cmd";

export interface Line {
  id: number;
  type: LineType;
  value: string;
  cwd?: string;
}

export type LineInput = Omit<Line, "id">;

export interface CommandContext {
  cwd: string;
  history: string[];
  availableCommands: string[];
}

export interface CommandRun {
  clearBefore?: boolean;
  lines?: LineInput[];
  stream?: StreamEvent[];
  exitCode?: number;
}

export type StreamEvent =
  | { kind: "line"; line: LineInput; delayMs?: number }
  | { kind: "status"; value: string; delayMs?: number }
  | { kind: "progress"; key: string; line: LineInput; delayMs?: number };

export type CommandFn = (args: string[], ctx: CommandContext) => Promise<CommandRun>;

export interface QuickAction {
  label: string;
  command: string;
}
