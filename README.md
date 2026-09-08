# Folder Graph

Folder Graph is an Obsidian plugin that displays the complete folder hierarchy of a vault as an interactive radial graph. It intentionally renders folders only. Notes, attachments, and other files are never added as nodes. I put this together as a quick and dirty viewer for a specific purpose. I have no plans to develop it further. It is what it is.

The plugin is self-contained and has no external runtime dependencies or network requirements.

## Features

- Displays every vault folder in a radial hierarchy centered on the vault root
- Excludes all files from the graph
- Automatically refreshes when folders are created, renamed, or deleted
- Supports panning and zooming
- Allows nodes to be dragged into temporary custom positions
- Reveals a folder in Obsidian's File Explorer when its node is double-clicked
- Provides CSS variables, classes, and data attributes for visual customization
- Works with desktop and mobile Obsidian

## Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create this directory inside your vault:

   ```text
   .obsidian/plugins/folder-graph/
   ```

3. Copy the three downloaded files into that directory.
4. Reload Obsidian.
5. Open **Settings → Community plugins** and enable **Folder Graph**.

## Usage

Open the graph using the network icon in the left ribbon or run **Folder Graph: Open folder graph** from the command palette. This icon is the same as the graph view icon, but inverted.

### Controls

| Action | Control |
| --- | --- |
| Pan | Drag an empty part of the graph |
| Zoom | Scroll over the graph |
| Select a folder | Click its node |
| Move a node | Drag its node |
| Reveal in File Explorer | Double-click its node |
| Fit the complete graph | Select the fit button in the view toolbar |
| Rebuild the graph | Select the refresh button in the view toolbar |

Dragged node positions last until the view is refreshed or reopened.

## CSS customization

The default visual rules are defined in `styles.css`. The variables at the beginning of `.folder-graph-view` provide the quickest way to restyle the graph:

```css
.folder-graph-view {
  --folder-graph-node-fill: var(--interactive-accent);
  --folder-graph-node-stroke: var(--background-primary);
  --folder-graph-node-stroke-width: 3px;
  --folder-graph-node-radius: 9px;
  --folder-graph-root-fill: var(--color-purple);
  --folder-graph-root-radius: 13px;
  --folder-graph-selected-fill: var(--color-orange);
  --folder-graph-label-color: var(--text-normal);
  --folder-graph-label-size: 13px;
  --folder-graph-label-weight: 500;
  --folder-graph-edge-color: var(--background-modifier-border-focus);
  --folder-graph-edge-width: 1.5px;
  --folder-graph-stage-background: var(--background-primary);
}
```

Each node exposes its depth and full vault-relative path as data attributes. This makes it possible to style individual levels or folders.

```css
/* All top-level folders */
.folder-graph-node[data-depth="1"] .folder-graph-node-circle {
  fill: var(--color-green);
  r: 12px;
}

/* One specific folder */
.folder-graph-node[data-path="foldername"] .folder-graph-node-circle {
  fill: #d97757;
}

/* Labels for folders at the second level */
.folder-graph-node[data-depth="2"] .folder-graph-node-label {
  fill: var(--color-cyan);
  font-weight: 700;
}
```

Useful selectors include:

| Selector | Element |
| --- | --- |
| `.folder-graph-node` | Every folder node |
| `.folder-graph-node.is-root` | Vault root node |
| `.folder-graph-node.is-selected` | Currently selected node |
| `.folder-graph-node[data-depth="n"]` | Nodes at hierarchy depth `n` |
| `.folder-graph-node[data-path="path"]` | Node with the given vault-relative path |
| `.folder-graph-node-circle` | Visible node circle |
| `.folder-graph-node-label` | Folder name label |
| `.folder-graph-edge` | Parent-child connection line |
| `.folder-graph-stage` | Graph background |

For durable personal overrides, place custom rules in an Obsidian CSS snippet and enable it under **Settings → Appearance → CSS snippets**.

## Plugin files

```text
folder-graph/
├── main.js
├── manifest.json
├── styles.css
└── README.md
```

Folder Graph requires Obsidian 1.4.0 or later.
