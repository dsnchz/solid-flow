<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=Ecosystem&background=tiles&project=solid-flow" alt="solid-flow">
</p>

# Solid Flow

Solid Flow is a port of [Svelte Flow](https://svelteflow.dev/) for SolidJS.

It is a highly customizable component for building interactive graphs and node-based editors.

☣️ **Solid Flow is alpha and currently under development. The API intends to follow React/Svelte Flow closely but some things might change for the sake of SolidJS.** ☣️

## Remaining TODOs for v0.1.0:

- [ ] Synchronize userland state with internal Solid Flow state (in-progress)
- [ ] Add core CSS styles from @xyflow/system and Svelte Flow (in-progress)
- [ ] Port Svelte Flow tests
- [ ] Add a playground app and smoketest library
- [ ] Add more examples
- [ ] Add a documentation site

## Key Features

- **Easy to use:** Seamless zooming and panning, single- and multi selection of graph elements and keyboard shortcuts are supported out of the box
- **Customizable:** Different [node](https://svelteflow.dev/examples) and [edge types](https://svelteflow.dev/examples/edges/edge-types) and support for custom nodes with multiple handles and custom edges
- **Fast rendering:** Only nodes that have changed are re-rendered
- **Hooks and Utils:** [Hooks](https://svelteflow.dev/api-reference/hooks) for handling nodes, edges and the viewport and graph [helper functions](https://svelteflow.dev/api-reference/utils)
- **Plugin Components:** [Background](https://svelteflow.dev/api-reference/components/background), [MiniMap](https://svelteflow.dev/api-reference/components/minimap) and [Controls](https://svelteflow.dev/api-reference/components/controls)
- **Reliable**: Written in [Typescript](https://www.typescriptlang.org)

## Installation

The easiest way to get the latest version of Solid Flow is to install it via npm, yarn or pnpm:

```sh
npm install @xyflow/system solid-flow
```

## Contributing: Getting Started

Some pre-requisites before install dependencies:

- Install Node Version Manager (NVM)
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  ```
- Install Bun
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

### Installing Dependencies

```bash
nvm use
bun install
```

### Local Development Build

```bash
bun start
```

### Linting & Formatting

```bash
bun run lint    # checks source for lint violations
bun run format  # checks source for format violations

bun run lint:fix    # fixes lint violations
bun run format:fix  # fixes format violations
```

### Contributing

The only requirements when contributing are:

- You keep a clean git history in your branch
  - rebasing `main` instead of making merge commits.
- Using proper commit message formats that adhere to [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/)
  - Additionally, squashing (via rebase) commits that are not [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/)
- CI checks pass before merging into `main`
