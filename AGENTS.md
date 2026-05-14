# Obsidian community plugin

## Project overview

- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and optional
  `styles.css`.

## Environment & tooling

- Node.js: use current LTS (Node 18+ recommended).
- **Package manager: npm** (required - `package.json` defines npm scripts and
  dependencies).
- **Bundler: esbuild** (required - `esbuild.config.mjs` and build scripts
  depend on it). Config uses `jsx: "automatic"` and `format: "cjs"`. All
  dependencies (React, Radix UI, Lucide, OpenAI SDK) are bundled into
  `main.js`; only `obsidian`, `electron`, and CodeMirror packages are
  external.
- Types: `obsidian` type definitions.
- **JSX**: `tsconfig.json` uses `"jsx": "react-jsx"` (automatic JSX runtime).

### Dependencies

| Package               | Usage                                                     |
| --------------------- | --------------------------------------------------------- |
| `react` / `react-dom` | UI components in Obsidian ItemView                        |
| `lucide-react`        | Vector icons, tree-shaken automatically                   |
| `@radix-ui/*`         | Accessible UI primitives (Dialog, Popover, Tooltip, etc.) |
| `openai`              | LLM API client (streaming tool calls)                     |
| `obsidian`            | Plugin API (type definitions only, external at build)     |

### Install

```bash
npm install
```

### Dev (watch)

```bash
npm run dev
```

### Production build

```bash
npm run build
```

## Linting

- To use eslint install eslint from terminal: `npm install -g eslint`
- To use eslint to analyze this project use this command: `eslint main.ts`
- eslint will then create a report with suggestions for code improvement by file
  and line number.
- If your source code is in a folder, such as `src`, you can use eslint with
  this command to analyze all files in that folder: `eslint ./src/`

## File & folder conventions

- **Organize code into multiple files**: Split functionality across separate
  modules rather than putting everything in `main.ts`.
- Source lives in `src/`. Keep `main.ts` small and focused on plugin lifecycle
  (loading, unloading, registering commands).
- **React components**: Place Reac components in feature directories under a
  `components/` subfolder. One component per file, named after the component
  (e.g. `ChatPanel.tsx`).
- **Radix UI primitives**: Re-export or wrap Radix primitives in
  `ui/radix/` so they can be imported consistently across the codebase.
- **Example file structure**:
  ```
  src/
    main.ts           # Plugin entry point, lifecycle management
    settings.ts       # Settings interface and defaults
    commands/         # Command implementations
      command1.ts
      command2.ts
    ui/              # UI components, modals, views
      view.ts
      radix/         # Radix UI wrappers/re-exports
        dialog.tsx
        popover.tsx
        tooltip.tsx
    utils/           # Utility functions, helpers
      helpers.ts
      constants.ts
    types.ts         # TypeScript interfaces and types
  ```
- **Do not commit build artifacts**: Never commit `node_modules/`, `main.js`, or
  other generated files to version control.
- Keep the plugin small. Avoid large dependencies. Prefer browser-compatible
  packages.
- Generated output should be placed at the plugin root or `dist/` depending on
  your build setup. Release artifacts must end up at the top level of the plugin
  folder in the vault (`main.js`, `manifest.json`, `styles.css`).

## Manifest rules (`manifest.json`)

- Must include (non-exhaustive):
  - `id` (plugin ID; for local dev it should match the folder name)
  - `name`
  - `version` (Semantic Versioning `x.y.z`)
  - `minAppVersion`
  - `description`
  - `isDesktopOnly` (boolean)
  - Optional: `author`, `authorUrl`, `fundingUrl` (string or map)
- Never change `id` after release. Treat it as stable API.
- Keep `minAppVersion` accurate when using newer APIs.
- Canonical requirements are coded here:
  https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

## Testing

- Manual install for testing: copy `main.js`, `manifest.json`, `styles.css` (if
  any) to:
  ```
  <Vault>/.obsidian/plugins/<plugin-id>/
  ```
- Reload Obsidian and enable the plugin in **Settings → Community plugins**.

## Commands & settings

- Any user-facing commands should be added via `this.addCommand(...)`.
- If the plugin has configuration, provide a settings tab and sensible defaults.
- Persist settings using `this.loadData()` / `this.saveData()`.
- Use stable command IDs; avoid renaming once released.

## React UI development

The plugin embeds React 19 inside Obsidian via `ItemView`. Follow these
conventions for all React code.

### Mounting lifecycle

- Use `createRoot` from `react-dom/client` in `ItemView.onOpen()`.
- Call `root.unmount()` in `onClose()` to prevent memory leaks.
- Call `containerEl.empty()` before mounting to clear Obsidian's default view.

```tsx
import { ItemView, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";

export class MyView extends ItemView {
  private root: Root | null = null;

  protected async onOpen() {
    this.containerEl.empty();
    this.root = createRoot(this.containerEl);
    this.root.render(<MyComponent />);
  }

  async onClose() {
    this.root?.unmount();
  }
}
```

### Dependency injection

- Use React Context to provide `App`, `Plugin`, or service instances to the
  component tree. Define one context per concern in `src/context/`.
- Wrap provider at the root render call inside `onOpen()`.

### Hooks

- Prefer functional components with hooks over class components.
- Extract complex state/effect logic into custom hooks under `src/hooks/`.
- Clean up subscriptions, listeners, and timers in `useEffect` return functions.
- Use `useCallback` for handler props passed to child components to avoid
  unnecessary re-renders.

### Cleanup

- Always return cleanup functions from `useEffect` for event listeners,
  intervals, and AbortControllers.
- Never store React state in plugin instances — use refs for imperative handles.

## Icon usage (Lucide)

This project uses `lucide-react` for all icons. Lucide icons are tree-shaken
automatically by esbuild — only imported icons end up in the bundle.

### Import

```tsx
import { ArrowUp, Square, Bot, Settings } from "lucide-react";
```

### Common props

| Prop        | Type   | Default        | Description          |
| ----------- | ------ | -------------- | -------------------- |
| size        | number | 24             | Width & height in px |
| color       | string | `currentColor` | Inherits text color  |
| strokeWidth | number | 2              | Stroke width in px   |
| fill        | string | `none`         | Fill color           |

### Conventions

- Use `currentColor` (default) so icons adapt to text color in themes.
- Use `size` for consistent sizing; avoid custom width/height attributes.
- When an icon is the sole interactive element (button), wrap it in a
  `<button>` with `aria-label` for accessibility.
- Prefer Lucide's built-in icons over inline SVGs.

## Radix UI

Radix UI provides accessible, unstyled React primitives. Wrap each Radix
primitive in a thin re-export module under `ui/radix/` so imports stay
consistent across the codebase and the primitive can be swapped later.

### Usage pattern

```tsx
// ui/radix/dialog.tsx
export { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogClose } from "@radix-ui/react-dialog";
```

```tsx
// src/features/my-feature.tsx
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "../ui/radix/dialog";
```

Always style Radix components using Obsidian CSS variables
(`--background-primary`, `--text-normal`, etc.) to respect the user's theme.

### Radix packages to use

| Package                         | Purpose                        |
| ------------------------------- | ------------------------------ |
| `@radix-ui/react-dialog`        | Modals, confirmation dialogs   |
| `@radix-ui/react-popover`       | Floating panels, context menus |
| `@radix-ui/react-tooltip`       | Hover tooltips                 |
| `@radix-ui/react-dropdown-menu` | Action menus                   |
| `@radix-ui/react-select`        | Select/dropdown inputs         |
| `@radix-ui/react-tabs`          | Tabbed panels                  |

Import only what you use — esbuild tree-shakes unused exports.

## Versioning & releases

- Bump `version` in `manifest.json` (SemVer) and update `versions.json` to map
  plugin version → minimum app version.
- Create a GitHub release whose tag exactly matches `manifest.json`'s `version`.
  Do not use a leading `v`.
- Attach `manifest.json`, `main.js`, and `styles.css` (if present) to the
  release as individual assets.
- After the initial release, follow the process to add/update your plugin in the
  community catalog as required.

## Security, privacy, and compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**. In
particular:

- Default to local/offline operation. Only make network requests when essential
  to the feature.
- No hidden telemetry. If you collect optional analytics or call third-party
  services, require explicit opt-in and document clearly in `README.md` and in
  settings.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code
  outside of normal releases.
- Minimize scope: read/write only what's necessary inside the vault. Do not
  access files outside the vault.
- Clearly disclose any external services used, data sent, and risks.
- Respect user privacy. Do not collect vault contents, filenames, or personal
  information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.
- Register and clean up all DOM, app, and interval listeners using the provided
  `register*` helpers so the plugin unloads safely.

## UX & copy guidelines (for UI text, commands, settings)

- Prefer sentence case for headings, buttons, and titles.
- Use clear, action-oriented imperatives in step-by-step copy.
- Use **bold** to indicate literal UI labels. Prefer "select" for interactions.
- Use arrow notation for navigation: **Settings → Community plugins**.
- Keep in-app strings short, consistent, and free of jargon.

## Performance

- Keep startup light. Defer heavy work until needed.
- Avoid long-running tasks during `onload`; use lazy initialization.
- Batch disk access and avoid excessive vault scans.
- Debounce/throttle expensive operations in response to file system events.

## Coding conventions

- TypeScript with `"strict": true` preferred.
- **Keep `main.ts` minimal**: Focus only on plugin lifecycle (onload, onunload,
  addCommand calls). Delegate all feature logic to separate modules.
- **Split large files**: If any file exceeds ~200-300 lines, consider breaking
  it into smaller, focused modules.
- **Use clear module boundaries**: Each file should have a single, well-defined
  responsibility.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Avoid Node/Electron APIs if you want mobile compatibility; set `isDesktopOnly`
  accordingly.
- Prefer `async/await` over promise chains; handle errors gracefully.
- **React components**: Always use functional components with hooks. Never use
  class components for React views. Use `useCallback` for callbacks passed as
  props. Return cleanup functions from `useEffect` to prevent leaks.
- **Radix UI**: Always wrap Radix primitives in re-export modules under
  `ui/radix/`. Never import directly from `@radix-ui/*` package paths in
  feature code. Style with Obsidian CSS variables only.

## Mobile

- Where feasible, test on iOS and Android.
- Don't assume desktop-only behavior unless `isDesktopOnly` is `true`.
- Avoid large in-memory structures; be mindful of memory and storage
  constraints.

## Agent do/don't

**Do**

- Add commands with stable IDs (don't rename once released).
- Provide defaults and validation in settings.
- Write idempotent code paths so reload/unload doesn't leak listeners or
  intervals.
- Use `this.register*` helpers for everything that needs cleanup.
- **Fetch official documentation proactively**: Before implementing a feature
  that uses an external library, framework, or API, always use the `skill` tool
  to load its official documentation (via `webfetch` or skill-provided
  resources). Do not rely on assumptions or stale knowledge. This applies to:
  Obsidian API, Radix UI primitives, Lucide icons, OpenAI SDK, and any other
  third-party dependency.

**Don't**

- Introduce network calls without an obvious user-facing reason and
  documentation.
- Ship features that require cloud services without clear disclosure and
  explicit opt-in.
- Store or transmit vault contents unless essential and consented.
- Implement UI features based on assumptions about Radix UI or Obsidian
  component APIs — always verify against current official docs first.

## Common tasks

### Organize code across multiple files

**main.ts** (minimal, lifecycle only):

```ts
import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, MySettings } from "./settings";
import { registerCommands } from "./commands";

export default class MyPlugin extends Plugin {
  settings: MySettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    registerCommands(this);
  }
}
```

**settings.ts**:

```ts
export interface MySettings {
  enabled: boolean;
  apiKey: string;
}

export const DEFAULT_SETTINGS: MySettings = {
  enabled: true,
  apiKey: "",
};
```

**commands/index.ts**:

```ts
import { Plugin } from "obsidian";
import { doSomething } from "./my-command";

export function registerCommands(plugin: Plugin) {
  plugin.addCommand({
    id: "do-something",
    name: "Do something",
    callback: () => doSomething(plugin),
  });
}
```

### Add a command

```ts
this.addCommand({
  id: "your-command-id",
  name: "Do the thing",
  callback: () => this.doTheThing(),
});
```

### Persist settings

```ts
interface MySettings { enabled: boolean }
const DEFAULT_SETTINGS: MySettings = { enabled: true };

async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  await this.saveData(this.settings);
}
```

### Register listeners safely

```ts
this.registerEvent(this.app.workspace.on("file-open", (f) => {/* ... */}));
this.registerDomEvent(window, "resize", () => {/* ... */});
this.registerInterval(window.setInterval(() => {/* ... */}, 1000));
```

## Troubleshooting

- Plugin doesn't load after build: ensure `main.js` and `manifest.json` are at
  the top level of the plugin folder under
  `<Vault>/.obsidian/plugins/<plugin-id>/`.
- Build issues: if `main.js` is missing, run `npm run build` or `npm run dev` to
  compile your TypeScript source code.
- Commands not appearing: verify `addCommand` runs after `onload` and IDs are
  unique.
- Settings not persisting: ensure `loadData`/`saveData` are awaited and you
  re-render the UI after changes.
- Mobile-only issues: confirm you're not using desktop-only APIs; check
  `isDesktopOnly` and adjust.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines:
  https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
