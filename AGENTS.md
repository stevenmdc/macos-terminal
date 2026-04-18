<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data.
Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.
Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# macos-terminal — LLM Quick Guide

## Goal
- Build a macOS-like terminal landing page with animated background.
- Terminal is virtual/simulated (no real shell execution).

## Tech Stack / Dependencies
- `next@16.2.4` (App Router)
- `react@19.2.4`, `react-dom@19.2.4`
- `framer-motion@12.38.0`
- `tailwindcss@4`, `@tailwindcss/postcss@4`
- `typescript@5`, `eslint@9`, `eslint-config-next@16.2.4`

## Key Scripts
- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run start`

## High-Level Architecture
- `app/page.tsx`: scene composition (background + terminal)
- `components/AnimatedBackground.tsx`: animated atmosphere layers
- `components/TerminalWindow.tsx`: terminal UI shell only
- `components/terminal/useTerminalRuntime.ts`: state + runtime engine
- `components/terminal/commands.ts`: command registry
- `components/terminal/streams.ts`: sequential stream builders + sleep/abort helpers
- `components/terminal/parser.ts`: quoted command parser
- `components/terminal/constants.ts`: UI/runtime constants
- `components/terminal/types.ts`: shared terminal types
- `app/globals.css`: visual tokens + global utility classes

## Runtime Model (Terminal)
- Input string -> `parseCommandInput()`
- Command dispatch in runtime hook:
  - builtin fast-path: `cd`, `pwd`, `date`, `history`
  - registry commands from `commands.ts`
- Commands can return:
  - `lines` (instant output)
  - `stream` (sequential events with delays)
  - `clearBefore`, `exitCode`
- Stream events:
  - `status` updates loading label
  - `line` appends output progressively

## Interrupt / Control
- Running commands are abortable via `Ctrl+C` or `Esc`.
- Abort handled with `AbortController` + abort-aware `sleep()`.
- UI shows spinner and dynamic status label while running.

## Persistence
- History stored in `localStorage` key: `macos-terminal.history`
- Current cwd stored in `localStorage` key: `macos-terminal.cwd`

## Existing Virtual Commands
- `help`, `about`, `whoami`, `ls`, `cd`, `pwd`, `date`, `history`
- `exec <command>` (multi-step simulated cascades)
- `claude code <task>` (agent-style multi-step cascade)
- `projects`, `stack`, `contact`, `clear`

## How To Add a New Command
1. Add command in `components/terminal/commands.ts`.
2. For progressive output, build a stream in `streams.ts`.
3. Ensure command name is present in `ALL_COMMANDS` if needed for autocomplete.
4. Optionally add quick action in `QUICK_ACTIONS`.
5. Run `npm run lint` and `npm run build`.

## UI Notes
- Terminal window width is `w-full max-w-4xl` (intentionally fixed max).
- Output panel has fixed height + internal scroll.
- Background animation is decorative; respect readability first.

## Guardrails For Future Edits
- Keep terminal behavior deterministic and fast (no network assumptions).
- Avoid introducing real command execution in browser runtime.
- Keep command outputs coherent with existing CLI style.
- Preserve accessibility on input and keyboard shortcuts.

## Done Criteria For Any Terminal Change
- Command parsing works with quoted args where relevant.
- Streamed commands can be interrupted cleanly.
- No layout jump while commands run.
- `npm run lint` passes.
- `npm run build` passes.
