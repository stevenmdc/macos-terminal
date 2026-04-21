import type {
  CommandContext,
  CommandFn,
  CommandPackSummary,
  CommandRun,
  LineInput,
  QuickAction,
  StreamEvent,
} from "./types";

const PACK_VERSION = 1;
const MAX_PACKS = 20;
const MAX_COMMANDS_PER_PACK = 60;
const MAX_EVENTS_PER_COMMAND = 200;
const MAX_LINES_PER_COMMAND = 120;
const MAX_ALIASES_PER_COMMAND = 12;
const MAX_QUICK_ACTIONS_PER_PACK = 12;

const LINE_TYPES = new Set<LineInput["type"]>(["out", "err", "info", "highlight", "dim", "success", "cmd"]);
const TEMPLATE_TOKEN_PATTERN = /\{\{(args|cwd|historyCount)\}\}/g;

export interface CommandPackQuickAction {
  label: string;
  command: string;
}

export interface CommandPackResponse {
  lines?: LineInput[];
  stream?: StreamEvent[];
}

export interface CommandPackCommand {
  name: string;
  description?: string;
  aliases: string[];
  response: CommandPackResponse;
  clearBefore?: boolean;
  exitCode?: number;
  quickAction?: CommandPackQuickAction;
}

export interface CommandPack {
  version: number;
  id: string;
  title?: string;
  commands: CommandPackCommand[];
}

export interface ParseCommandPackResult {
  ok: boolean;
  pack?: CommandPack;
  errors: string[];
}

export interface CommandPackRuntime {
  commandMap: Record<string, CommandFn>;
  commandNames: string[];
  triggerNames: string[];
  quickActions: QuickAction[];
  packSummaries: CommandPackSummary[];
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(
  value: unknown,
  path: string,
  errors: string[],
  options?: { required?: boolean; maxLength?: number },
): string | undefined {
  const required = options?.required ?? false;
  if (typeof value !== "string") {
    if (required) {
      errors.push(`${path} must be a string`);
    }
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    if (required) {
      errors.push(`${path} cannot be empty`);
    }
    return undefined;
  }

  const maxLength = options?.maxLength;
  if (maxLength && trimmed.length > maxLength) {
    errors.push(`${path} is too long (max ${maxLength} characters)`);
    return undefined;
  }

  return trimmed;
}

function asDelay(value: unknown, path: string, errors: string[]): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    errors.push(`${path} must be an integer`);
    return undefined;
  }
  if (value < 0 || value > 60_000) {
    errors.push(`${path} must be between 0 and 60000`);
    return undefined;
  }
  return value;
}

function parseLineInput(value: unknown, path: string, errors: string[]): LineInput | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  const typeRaw = asTrimmedString(value.type, `${path}.type`, errors, { required: true, maxLength: 16 });
  const text = asTrimmedString(value.value, `${path}.value`, errors, { required: true, maxLength: 400 });
  const cwd = value.cwd === undefined ? undefined : asTrimmedString(value.cwd, `${path}.cwd`, errors, { maxLength: 120 });

  if (!typeRaw || !text) {
    return null;
  }
  if (!LINE_TYPES.has(typeRaw as LineInput["type"])) {
    errors.push(`${path}.type must be one of: ${Array.from(LINE_TYPES).join(", ")}`);
    return null;
  }

  return {
    type: typeRaw as LineInput["type"],
    value: text,
    cwd,
  };
}

function parseStreamEvent(value: unknown, path: string, errors: string[]): StreamEvent | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  const kind = asTrimmedString(value.kind, `${path}.kind`, errors, { required: true, maxLength: 16 });
  if (!kind) {
    return null;
  }

  if (kind === "status") {
    const statusValue = asTrimmedString(value.value, `${path}.value`, errors, { required: true, maxLength: 200 });
    const delayMs = asDelay(value.delayMs, `${path}.delayMs`, errors);
    if (!statusValue) {
      return null;
    }
    return {
      kind: "status",
      value: statusValue,
      delayMs,
    };
  }

  if (kind === "line") {
    const line = parseLineInput(value.line, `${path}.line`, errors);
    const delayMs = asDelay(value.delayMs, `${path}.delayMs`, errors);
    if (!line) {
      return null;
    }
    return {
      kind: "line",
      line,
      delayMs,
    };
  }

  errors.push(`${path}.kind must be either "line" or "status"`);
  return null;
}

function parseCommand(input: unknown, index: number, errors: string[]): CommandPackCommand | null {
  const path = `commands[${index}]`;
  if (!isRecord(input)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  const name = asTrimmedString(input.name, `${path}.name`, errors, { required: true, maxLength: 48 });
  const description = input.description
    ? asTrimmedString(input.description, `${path}.description`, errors, { maxLength: 140 })
    : undefined;

  if (!name) {
    return null;
  }
  if (/\s/.test(name)) {
    errors.push(`${path}.name cannot contain spaces`);
    return null;
  }

  let aliases: string[] = [];
  if (input.aliases !== undefined) {
    if (!Array.isArray(input.aliases)) {
      errors.push(`${path}.aliases must be an array`);
      return null;
    }
    if (input.aliases.length > MAX_ALIASES_PER_COMMAND) {
      errors.push(`${path}.aliases supports up to ${MAX_ALIASES_PER_COMMAND} items`);
      return null;
    }

    const aliasSet = new Set<string>();
    aliases = input.aliases
      .map((value, aliasIndex) =>
        asTrimmedString(value, `${path}.aliases[${aliasIndex}]`, errors, { required: true, maxLength: 48 }),
      )
      .filter((value): value is string => Boolean(value))
      .filter((value) => {
        if (/\s/.test(value)) {
          errors.push(`${path}.aliases contains invalid value "${value}" (spaces are not allowed)`);
          return false;
        }
        if (value === name) {
          return false;
        }
        if (aliasSet.has(value)) {
          return false;
        }
        aliasSet.add(value);
        return true;
      });
  }

  if (!isRecord(input.response)) {
    errors.push(`${path}.response must be an object`);
    return null;
  }

  let lines: LineInput[] | undefined;
  if (input.response.lines !== undefined) {
    if (!Array.isArray(input.response.lines)) {
      errors.push(`${path}.response.lines must be an array`);
      return null;
    }
    if (input.response.lines.length > MAX_LINES_PER_COMMAND) {
      errors.push(`${path}.response.lines supports up to ${MAX_LINES_PER_COMMAND} items`);
      return null;
    }

    lines = input.response.lines
      .map((line, lineIndex) => parseLineInput(line, `${path}.response.lines[${lineIndex}]`, errors))
      .filter((line): line is LineInput => Boolean(line));
  }

  let stream: StreamEvent[] | undefined;
  if (input.response.stream !== undefined) {
    if (!Array.isArray(input.response.stream)) {
      errors.push(`${path}.response.stream must be an array`);
      return null;
    }
    if (input.response.stream.length > MAX_EVENTS_PER_COMMAND) {
      errors.push(`${path}.response.stream supports up to ${MAX_EVENTS_PER_COMMAND} events`);
      return null;
    }

    stream = input.response.stream
      .map((event, eventIndex) => parseStreamEvent(event, `${path}.response.stream[${eventIndex}]`, errors))
      .filter((event): event is StreamEvent => Boolean(event));
  }

  const clearBefore = input.clearBefore === true;
  if (input.clearBefore !== undefined && typeof input.clearBefore !== "boolean") {
    errors.push(`${path}.clearBefore must be a boolean`);
    return null;
  }

  let exitCode: number | undefined;
  if (input.exitCode !== undefined) {
    if (typeof input.exitCode !== "number" || !Number.isInteger(input.exitCode)) {
      errors.push(`${path}.exitCode must be an integer`);
      return null;
    }
    if (input.exitCode < 0 || input.exitCode > 255) {
      errors.push(`${path}.exitCode must be between 0 and 255`);
      return null;
    }
    exitCode = input.exitCode;
  }

  let quickAction: CommandPackQuickAction | undefined;
  if (input.quickAction !== undefined) {
    if (!isRecord(input.quickAction)) {
      errors.push(`${path}.quickAction must be an object`);
      return null;
    }
    const label = asTrimmedString(input.quickAction.label, `${path}.quickAction.label`, errors, {
      required: true,
      maxLength: 32,
    });
    const command = input.quickAction.command
      ? asTrimmedString(input.quickAction.command, `${path}.quickAction.command`, errors, { maxLength: 120 })
      : name;

    if (!label || !command) {
      return null;
    }

    quickAction = { label, command };
  }

  const hasOutput = clearBefore || (lines && lines.length > 0) || (stream && stream.length > 0);
  if (!hasOutput) {
    errors.push(`${path} must define response.lines, response.stream, or clearBefore`);
    return null;
  }

  return {
    name,
    description,
    aliases,
    response: {
      lines,
      stream,
    },
    clearBefore: clearBefore || undefined,
    exitCode,
    quickAction,
  };
}

function parseCommandPack(input: unknown): ParseCommandPackResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: ["root must be an object"] };
  }

  if (input.version !== PACK_VERSION) {
    errors.push(`version must be ${PACK_VERSION}`);
  }

  const id = asTrimmedString(input.id, "id", errors, { required: true, maxLength: 64 });
  if (id && !/^[a-z0-9][a-z0-9-_]*$/i.test(id)) {
    errors.push("id must match [a-z0-9][a-z0-9-_]*");
  }

  const title = input.title ? asTrimmedString(input.title, "title", errors, { maxLength: 100 }) : undefined;

  if (!Array.isArray(input.commands)) {
    errors.push("commands must be an array");
    return { ok: false, errors };
  }

  if (input.commands.length === 0) {
    errors.push("commands cannot be empty");
    return { ok: false, errors };
  }

  if (input.commands.length > MAX_COMMANDS_PER_PACK) {
    errors.push(`commands supports up to ${MAX_COMMANDS_PER_PACK} items`);
    return { ok: false, errors };
  }

  const commands = input.commands
    .map((command, index) => parseCommand(command, index, errors))
    .filter((command): command is CommandPackCommand => Boolean(command));

  const seenNames = new Set<string>();
  for (const command of commands) {
    if (seenNames.has(command.name)) {
      errors.push(`duplicate command name "${command.name}" in pack "${id ?? "unknown"}"`);
      continue;
    }
    seenNames.add(command.name);
  }

  if (errors.length > 0 || !id) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    pack: {
      version: PACK_VERSION,
      id,
      title,
      commands,
    },
  };
}

function interpolateTemplateValue(value: string, args: string[], ctx: CommandContext): string {
  const argText = args.join(" ");
  return value.replace(TEMPLATE_TOKEN_PATTERN, (_fullMatch, token: string) => {
    if (token === "args") {
      return argText;
    }
    if (token === "cwd") {
      return ctx.cwd;
    }
    return String(ctx.history.length);
  });
}

function buildRunFromTemplate(command: CommandPackCommand, args: string[], ctx: CommandContext): CommandRun {
  const lines = command.response.lines?.map((line) => ({
    ...line,
    value: interpolateTemplateValue(line.value, args, ctx),
    cwd: line.cwd ? interpolateTemplateValue(line.cwd, args, ctx) : undefined,
  }));

  const stream = command.response.stream?.map((event) => {
    if (event.kind === "status") {
      return {
        ...event,
        value: interpolateTemplateValue(event.value, args, ctx),
      } satisfies StreamEvent;
    }

    return {
      ...event,
      line: {
        ...event.line,
        value: interpolateTemplateValue(event.line.value, args, ctx),
        cwd: event.line.cwd ? interpolateTemplateValue(event.line.cwd, args, ctx) : undefined,
      },
    } satisfies StreamEvent;
  });

  return {
    lines,
    stream,
    clearBefore: command.clearBefore,
    exitCode: command.exitCode,
  };
}

function createCommandFnFromPackCommand(command: CommandPackCommand): CommandFn {
  return async (args, ctx) => buildRunFromTemplate(command, args, ctx);
}

export function parseCommandPackJson(raw: string): ParseCommandPackResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      errors: [`invalid JSON: ${(error as Error).message}`],
    };
  }

  return parseCommandPack(parsed);
}

export function parseStoredCommandPacks(raw: string | null): CommandPack[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const nextPacks: CommandPack[] = [];
    for (const candidate of parsed) {
      if (nextPacks.length >= MAX_PACKS) {
        break;
      }
      const result = parseCommandPack(candidate);
      if (result.ok && result.pack) {
        nextPacks.push(result.pack);
      }
    }
    return nextPacks;
  } catch {
    return [];
  }
}

export function buildCommandPackRuntime(packs: CommandPack[], builtinCommands: readonly string[]): CommandPackRuntime {
  const commandMap: Record<string, CommandFn> = {};
  const commandNames: string[] = [];
  const triggerNames = new Set<string>();
  const quickActions: QuickAction[] = [];
  const quickActionKeys = new Set<string>();
  const packSummaries: CommandPackSummary[] = [];
  const warnings: string[] = [];
  const reserved = new Set<string>(builtinCommands);

  for (const pack of packs) {
    let accepted = 0;

    for (const command of pack.commands) {
      if (reserved.has(command.name) || commandMap[command.name]) {
        warnings.push(`skipping "${command.name}" from pack "${pack.id}" (name conflict)`);
        continue;
      }

      const runner = createCommandFnFromPackCommand(command);
      commandMap[command.name] = runner;
      commandNames.push(command.name);
      triggerNames.add(command.name);
      accepted += 1;

      for (const alias of command.aliases) {
        if (reserved.has(alias) || commandMap[alias]) {
          warnings.push(`skipping alias "${alias}" from pack "${pack.id}" (name conflict)`);
          continue;
        }
        commandMap[alias] = runner;
        triggerNames.add(alias);
      }

      if (command.quickAction && quickActions.length < MAX_QUICK_ACTIONS_PER_PACK * MAX_PACKS) {
        const key = `${command.quickAction.label}::${command.quickAction.command}`;
        if (!quickActionKeys.has(key)) {
          quickActions.push(command.quickAction);
          quickActionKeys.add(key);
        }
      }
    }

    packSummaries.push({
      id: pack.id,
      title: pack.title ?? pack.id,
      commandCount: accepted,
    });
  }

  const sortedNames = [...commandNames].sort((a, b) => a.localeCompare(b));
  const sortedTriggers = [...triggerNames].sort((a, b) => a.localeCompare(b));

  return {
    commandMap,
    commandNames: sortedNames,
    triggerNames: sortedTriggers,
    quickActions,
    packSummaries,
    warnings,
  };
}
