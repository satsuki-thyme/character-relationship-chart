# Shared core

[日本語](README-ja.md)

This private package contains the data operations shared by the VS Code extension and the read-only Web host. It performs no file, network, storage, DOM or VS Code operations. Its only dependency is `jsonc-parser` 3.3.1, already installed by the root project.

```js
const core = require('./packages/core'); // From the project root.
const result = core.parseConfig(text);
if (!result.issues.length) {
  const nodes = core.graph.layout(result.graph, result.graph.layout);
  const routes = core.graph.routes(nodes, result.graph.edges);
}
```

| Export | Contract |
| --- | --- |
| `parseConfig(text)` | Parses and validates JSONC. Returns `issues` with UTF-16 source offsets and lengths; successful results also contain the original `config` and normalized `graph`. |
| `editConfig(text, operation)` | Returns edited JSONC `text`, `config`, optional `rename`, and the resulting `index`. Preserves unaffected comments and formatting. Throws for invalid operations or results. |
| `normalizeState(value, legacy = false)` | Validates and copies display-state data. Legacy mode retains the existing migration rules. |
| `parseState(text)` | Reads strict JSON display-state text, accepts a leading BOM, enforces the 200,000-character limit and validates its fields. Throws for invalid input. |
| `encodeState(value, legacy = false)` | Validates and serializes display state with two-space indentation and a final newline. |
| `LIMITS`, `VIEW_LIMITS` | Existing configuration limits and the display-text limit. |
| `graph` | Geometry API: `WIDTH`, `HEIGHT`, `wrap`, `signature`, `layout`, `routes`, and `bounds`. |

The data format remains version 1 with the existing `nodes`, `groups`, and `edges` keys. See [DATA_FORMAT.md](../../docs/DATA_FORMAT.md) for field and operation constraints. Hosts remain responsible for file selection, reading/writing bytes, document revisions, conflict detection, Undo and presentation of errors.

The package entry is CommonJS. The read-only Web build bundles the parsing and view-state modules with the published ESM entry of `jsonc-parser`; see [the Web viewer](../../web/README.md). `graph.js` also supports direct script loading as `globalThis.RelationsGraph`, which the current shared UI uses. `media/graph.js`, `src/config.js`, and `src/edit.js` are compatibility entry points for existing CommonJS callers.

`npm test` at the project root covers the public entry point in a JavaScript context without Node built-ins, `process`, `Buffer`, DOM or VS Code APIs, in addition to the existing configuration, editing, geometry and storage regression tests.
