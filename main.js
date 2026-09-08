const { ItemView, Plugin, TFolder, setIcon } = require("obsidian");

const VIEW_TYPE = "folder-graph-view";
const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

function countDescendants(folder) {
  return folder.children.reduce((total, child) => {
    return child instanceof TFolder ? total + 1 + countDescendants(child) : total;
  }, 0);
}

function collectFolders(vault) {
  const root = vault.getRoot();
  const nodes = [{
    id: "__vault_root__",
    name: vault.getName(),
    path: "",
    parentPath: null,
    depth: 0,
    folder: root,
    descendants: countDescendants(root)
  }];

  const visit = (folder, depth) => {
    const folders = folder.children
      .filter((child) => child instanceof TFolder)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    for (const child of folders) {
      nodes.push({
        id: child.path,
        name: child.name,
        path: child.path,
        parentPath: folder.isRoot() ? "__vault_root__" : folder.path,
        depth,
        folder: child,
        descendants: countDescendants(child)
      });
      visit(child, depth + 1);
    }
  };

  visit(root, 1);
  return nodes;
}

function assignRadialLayout(nodes) {
  const byParent = new Map();
  for (const node of nodes) {
    if (node.parentPath === null) continue;
    if (!byParent.has(node.parentPath)) byParent.set(node.parentPath, []);
    byParent.get(node.parentPath).push(node);
  }

  const root = nodes[0];
  root.x = 0;
  root.y = 0;
  root.angle = 0;

  const placeChildren = (parent, startAngle, endAngle) => {
    const children = byParent.get(parent.id) || [];
    if (!children.length) return;

    const totalWeight = children.reduce((sum, child) => sum + child.descendants + 1, 0);
    let cursor = startAngle;
    for (const child of children) {
      const span = (endAngle - startAngle) * ((child.descendants + 1) / totalWeight);
      const angle = cursor + span / 2;
      const radius = 210 * child.depth;
      child.angle = angle;
      child.x = Math.cos(angle) * radius;
      child.y = Math.sin(angle) * radius;
      placeChildren(child, cursor, cursor + span);
      cursor += span;
    }
  };

  placeChildren(root, -Math.PI / 2, Math.PI * 1.5);
  return byParent;
}

class FolderGraphView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.viewport = { x: -500, y: -400, width: 1000, height: 800 };
    this.selectedPath = null;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Folder graph";
  }

  getIcon() {
    return "network";
  }

  async onOpen() {
    this.render();
  }

  async onClose() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  render() {
    const content = this.contentEl;
    content.empty();
    content.addClass("folder-graph-view");

    const toolbar = content.createDiv({ cls: "folder-graph-toolbar" });
    const title = toolbar.createDiv({ cls: "folder-graph-title" });
    title.createEl("strong", { text: "Folder graph" });

    const nodes = collectFolders(this.app.vault);
    title.createSpan({ cls: "folder-graph-count", text: `${nodes.length - 1} folders` });

    const actions = toolbar.createDiv({ cls: "folder-graph-actions" });
    const fitButton = actions.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "Fit graph to view" }
    });
    setIcon(fitButton, "scan");

    const refreshButton = actions.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "Refresh folder graph" }
    });
    setIcon(refreshButton, "refresh-cw");

    const stage = content.createDiv({ cls: "folder-graph-stage" });
    const svg = svgElement("svg", {
      class: "folder-graph-svg",
      role: "img",
      "aria-label": "Graph of vault folders"
    });
    stage.appendChild(svg);

    const graph = svgElement("g", { class: "folder-graph-canvas" });
    const edgeLayer = svgElement("g", { class: "folder-graph-edges" });
    const nodeLayer = svgElement("g", { class: "folder-graph-nodes" });
    graph.append(edgeLayer, nodeLayer);
    svg.appendChild(graph);

    assignRadialLayout(nodes);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const nodeElements = new Map();
    const edgeElements = [];

    for (const node of nodes) {
      if (node.parentPath === null) continue;
      const parent = nodeById.get(node.parentPath);
      if (!parent) continue;
      const line = svgElement("line", {
        class: "folder-graph-edge",
        x1: parent.x,
        y1: parent.y,
        x2: node.x,
        y2: node.y,
        "data-depth": node.depth
      });
      edgeLayer.appendChild(line);
      edgeElements.push({ line, parent, child: node });
    }

    const updateEdges = () => {
      for (const edge of edgeElements) {
        edge.line.setAttribute("x1", edge.parent.x);
        edge.line.setAttribute("y1", edge.parent.y);
        edge.line.setAttribute("x2", edge.child.x);
        edge.line.setAttribute("y2", edge.child.y);
      }
    };

    for (const node of nodes) {
      const group = svgElement("g", {
        class: `folder-graph-node${node.depth === 0 ? " is-root" : ""}`,
        transform: `translate(${node.x} ${node.y})`,
        tabindex: "0",
        role: "button",
        "aria-label": node.depth === 0 ? this.app.vault.getName() : `Folder: ${node.path}`,
        "data-depth": node.depth,
        "data-path": node.path || "/"
      });
      const hitArea = svgElement("circle", { class: "folder-graph-node-hit-area", r: 30 });
      const circle = svgElement("circle", { class: "folder-graph-node-circle", r: node.depth === 0 ? 13 : 9 });
      const label = svgElement("text", {
        class: "folder-graph-node-label",
        x: 0,
        y: node.depth === 0 ? 31 : 27,
        "text-anchor": "middle"
      });
      label.textContent = node.name;
      const tooltip = svgElement("title");
      tooltip.textContent = node.path || this.app.vault.getName();
      group.append(hitArea, circle, label, tooltip);
      nodeLayer.appendChild(group);
      nodeElements.set(node.id, group);

      const selectNode = () => {
        nodeLayer.querySelectorAll(".is-selected").forEach((el) => el.classList.remove("is-selected"));
        group.classList.add("is-selected");
        this.selectedPath = node.path;
      };

      group.addEventListener("click", (event) => {
        event.stopPropagation();
        selectNode();
      });
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectNode();
        }
      });
      group.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        this.revealFolder(node.folder);
      });

      let dragState = null;
      group.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        dragState = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, nodeX: node.x, nodeY: node.y };
        group.setPointerCapture(event.pointerId);
        group.classList.add("is-dragging");
      });
      group.addEventListener("pointermove", (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) return;
        const rect = svg.getBoundingClientRect();
        node.x = dragState.nodeX + (event.clientX - dragState.startX) * (this.viewport.width / rect.width);
        node.y = dragState.nodeY + (event.clientY - dragState.startY) * (this.viewport.height / rect.height);
        group.setAttribute("transform", `translate(${node.x} ${node.y})`);
        updateEdges();
      });
      const endDrag = (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) return;
        group.classList.remove("is-dragging");
        dragState = null;
      };
      group.addEventListener("pointerup", endDrag);
      group.addEventListener("pointercancel", endDrag);
    }

    const applyViewport = () => {
      svg.setAttribute("viewBox", `${this.viewport.x} ${this.viewport.y} ${this.viewport.width} ${this.viewport.height}`);
    };

    const fitGraph = () => {
      const xs = nodes.map((node) => node.x);
      const ys = nodes.map((node) => node.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const padding = 160;
      this.viewport = {
        x: minX - padding,
        y: minY - padding,
        width: Math.max(600, maxX - minX + padding * 2),
        height: Math.max(480, maxY - minY + padding * 2)
      };
      applyViewport();
    };

    fitButton.addEventListener("click", fitGraph);
    refreshButton.addEventListener("click", () => this.render());

    let panState = null;
    svg.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest(".folder-graph-node")) return;
      panState = { x: event.clientX, y: event.clientY, viewX: this.viewport.x, viewY: this.viewport.y };
      svg.setPointerCapture(event.pointerId);
      svg.classList.add("is-panning");
    });
    svg.addEventListener("pointermove", (event) => {
      if (!panState) return;
      const rect = svg.getBoundingClientRect();
      this.viewport.x = panState.viewX - (event.clientX - panState.x) * (this.viewport.width / rect.width);
      this.viewport.y = panState.viewY - (event.clientY - panState.y) * (this.viewport.height / rect.height);
      applyViewport();
    });
    const stopPan = () => {
      panState = null;
      svg.classList.remove("is-panning");
    };
    svg.addEventListener("pointerup", stopPan);
    svg.addEventListener("pointercancel", stopPan);
    svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const pointerX = this.viewport.x + ((event.clientX - rect.left) / rect.width) * this.viewport.width;
      const pointerY = this.viewport.y + ((event.clientY - rect.top) / rect.height) * this.viewport.height;
      const factor = event.deltaY > 0 ? 1.12 : 0.89;
      const nextWidth = Math.min(12000, Math.max(240, this.viewport.width * factor));
      const nextHeight = nextWidth * (rect.height / rect.width);
      const ratioX = (pointerX - this.viewport.x) / this.viewport.width;
      const ratioY = (pointerY - this.viewport.y) / this.viewport.height;
      this.viewport = {
        x: pointerX - ratioX * nextWidth,
        y: pointerY - ratioY * nextHeight,
        width: nextWidth,
        height: nextHeight
      };
      applyViewport();
    }, { passive: false });

    fitGraph();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.resizeObserver = new ResizeObserver(() => applyViewport());
    this.resizeObserver.observe(stage);
  }

  revealFolder(folder) {
    const explorerLeaf = this.app.workspace.getLeavesOfType("file-explorer")[0];
    if (explorerLeaf && explorerLeaf.view && typeof explorerLeaf.view.revealInFolder === "function") {
      explorerLeaf.view.revealInFolder(folder);
    }
  }
}

module.exports = class FolderGraphPlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new FolderGraphView(leaf, this));

    this.addRibbonIcon("network", "Open folder graph", () => this.activateView());
    this.addCommand({
      id: "open-folder-graph",
      name: "Open folder graph",
      callback: () => this.activateView()
    });

    let refreshFrame = null;
    const scheduleRefresh = () => {
      if (refreshFrame !== null) cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => {
        refreshFrame = null;
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          if (leaf.view instanceof FolderGraphView) leaf.view.render();
        }
      });
    };
    this.register(() => {
      if (refreshFrame !== null) cancelAnimationFrame(refreshFrame);
    });
    this.registerEvent(this.app.vault.on("create", (item) => {
      if (item instanceof TFolder) scheduleRefresh();
    }));
    this.registerEvent(this.app.vault.on("delete", (item) => {
      if (item instanceof TFolder) scheduleRefresh();
    }));
    this.registerEvent(this.app.vault.on("rename", (item) => {
      if (item instanceof TFolder) scheduleRefresh();
    }));
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async activateView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }
};
