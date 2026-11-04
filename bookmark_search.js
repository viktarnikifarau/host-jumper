const HostJumperBookmarkSearch = (() => {
  const DEFAULT_LIMIT = 8;

  function normalizeText(value) {
    return String(value || "").toLowerCase();
  }

  function tokenize(query) {
    const normalized = normalizeText(query).trim();
    return normalized ? normalized.split(/\s+/u) : [];
  }

  function isFolder(node) {
    return node?.type === "folder" || (!node?.url && Array.isArray(node?.children));
  }

  function createEntry(node, path) {
    const title = String(node.title || "");
    const url = String(node.url || "");
    const folderPath = path.slice();
    const lowerPath = folderPath.map(normalizeText);
    const lowerTitle = normalizeText(title);
    const lowerUrl = normalizeText(url);

    return {
      id: node.id,
      title,
      url,
      path: folderPath,
      lowerPath,
      lowerTitle,
      lowerUrl,
      searchText: normalizeText([...folderPath, title, url].join(" "))
    };
  }

  function publicResult(entry) {
    const path = entry.path.slice();
    return {
      id: entry.id,
      title: entry.title,
      url: entry.url,
      path,
      displayPath: [...path, entry.title || entry.url].join(" > ")
    };
  }

  function scoreEntry(entry, tokens) {
    if (!tokens.every((token) => entry.searchText.includes(token))) {
      return null;
    }

    let exactPathMatches = 0;
    let pathMatches = 0;
    let titleMatches = 0;
    let urlMatches = 0;

    for (const token of tokens) {
      if (entry.lowerPath.some((segment) => segment === token)) {
        exactPathMatches += 1;
      }
      if (entry.lowerPath.some((segment) => segment.includes(token))) {
        pathMatches += 1;
      }
      if (entry.lowerTitle.includes(token)) {
        titleMatches += 1;
      }
      if (entry.lowerUrl.includes(token)) {
        urlMatches += 1;
      }
    }

    let consecutivePathMatches = 0;
    for (let tokenStart = 0; tokenStart < tokens.length; tokenStart += 1) {
      for (let pathStart = 0; pathStart < entry.lowerPath.length; pathStart += 1) {
        let run = 0;
        while (
          tokenStart + run < tokens.length
          && pathStart + run < entry.lowerPath.length
          && entry.lowerPath[pathStart + run].includes(tokens[tokenStart + run])
        ) {
          run += 1;
        }
        consecutivePathMatches = Math.max(consecutivePathMatches, run);
      }
    }

    const exactPath = tokens.length === entry.lowerPath.length
      && tokens.every((token, index) => token === entry.lowerPath[index]);
    const exactTitle = entry.lowerTitle === tokens.join(" ");

    // Lexicographic scoring keeps folder matches ahead of title and URL matches.
    return [
      exactPath ? 1 : 0,
      consecutivePathMatches,
      exactPathMatches,
      pathMatches,
      exactTitle ? 1 : 0,
      titleMatches,
      urlMatches
    ];
  }

  function compareScores(left, right) {
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return right[index] - left[index];
      }
    }
    return 0;
  }

  function compareCandidates(left, right) {
    return compareScores(left.score, right.score)
      || left.entry.lowerTitle.localeCompare(right.entry.lowerTitle)
      || left.entry.lowerPath.join("\0").localeCompare(right.entry.lowerPath.join("\0"))
      || left.entry.lowerUrl.localeCompare(right.entry.lowerUrl)
      || left.entry.id.localeCompare(right.entry.id);
  }

  function addTopResult(results, candidate, limit) {
    let position = results.findIndex((existing) => compareCandidates(candidate, existing) < 0);
    if (position === -1) {
      position = results.length;
    }
    if (position >= limit) {
      return;
    }

    results.splice(position, 0, candidate);
    if (results.length > limit) {
      results.pop();
    }
  }

  function createIndex(bookmarksApi) {
    let entries = new Map();
    let nodes = new Map();
    let children = new Map();
    let folderPaths = new Map();
    let initialized = false;
    let initialization = null;
    let queue = Promise.resolve();

    async function rebuildTree() {
      const tree = await bookmarksApi.getTree();
      const nextEntries = new Map();
      const nextNodes = new Map();
      const nextChildren = new Map();
      const nextFolderPaths = new Map();

      function visit(node, parentId, parentPath, isRoot = false) {
        const storedNode = {
          id: node.id,
          parentId,
          title: String(node.title || ""),
          url: node.url == null ? null : String(node.url),
          folder: isFolder(node)
        };
        nextNodes.set(node.id, storedNode);

        if (parentId != null) {
          if (!nextChildren.has(parentId)) {
            nextChildren.set(parentId, new Set());
          }
          nextChildren.get(parentId).add(node.id);
        }

        if (storedNode.folder) {
          const path = isRoot ? [] : [...parentPath, storedNode.title];
          nextFolderPaths.set(node.id, path);
          nextChildren.set(node.id, new Set());
          for (const child of node.children || []) {
            visit(child, node.id, path);
          }
        } else if (storedNode.url != null) {
          nextEntries.set(node.id, createEntry(storedNode, parentPath));
        }
      }

      for (const root of tree || []) {
        visit(root, null, [], true);
      }

      // Swap complete maps atomically so queries never see a partial rebuild.
      entries = nextEntries;
      nodes = nextNodes;
      children = nextChildren;
      folderPaths = nextFolderPaths;
      initialized = true;
    }

    function ensureReady() {
      if (initialized) {
        return Promise.resolve();
      }
      if (!initialization) {
        initialization = rebuildTree().catch((error) => {
          initialization = null;
          throw error;
        });
      }
      return initialization;
    }

    function enqueue(operation) {
      const pending = queue.catch(() => undefined).then(async () => {
        await ensureReady();
        return operation();
      });
      queue = pending;
      return pending;
    }

    function attachToParent(id, parentId) {
      if (parentId == null) {
        return;
      }
      if (!children.has(parentId)) {
        children.set(parentId, new Set());
      }
      children.get(parentId).add(id);
    }

    function detachFromParent(id, parentId) {
      if (parentId != null) {
        children.get(parentId)?.delete(id);
      }
    }

    function refreshSubtree(id) {
      const node = nodes.get(id);
      if (!node) {
        return;
      }

      const parentPath = node.parentId == null ? [] : folderPaths.get(node.parentId) || [];
      if (node.folder) {
        const path = node.parentId == null ? [] : [...parentPath, node.title];
        folderPaths.set(id, path);
        for (const childId of children.get(id) || []) {
          refreshSubtree(childId);
        }
      } else if (node.url != null) {
        entries.set(id, createEntry(node, parentPath));
      }
    }

    function upsertSubtree(node, parentId) {
      const existing = nodes.get(node.id);
      if (existing) {
        detachFromParent(node.id, existing.parentId);
      }

      const storedNode = {
        id: node.id,
        parentId,
        title: String(node.title || ""),
        url: node.url == null ? null : String(node.url),
        folder: isFolder(node)
      };
      nodes.set(node.id, storedNode);
      attachToParent(node.id, parentId);

      if (storedNode.folder) {
        if (!children.has(node.id)) {
          children.set(node.id, new Set());
        }
        refreshSubtree(node.id);
        for (const child of node.children || []) {
          upsertSubtree(child, node.id);
        }
      } else if (storedNode.url != null) {
        refreshSubtree(node.id);
      } else {
        entries.delete(node.id);
      }
    }

    function removeSubtree(id) {
      for (const childId of children.get(id) || []) {
        removeSubtree(childId);
      }
      const node = nodes.get(id);
      if (node) {
        detachFromParent(id, node.parentId);
      }
      entries.delete(id);
      folderPaths.delete(id);
      children.delete(id);
      nodes.delete(id);
    }

    async function search(query, { limit = DEFAULT_LIMIT } = {}) {
      const tokens = tokenize(query);
      const maximum = Math.max(0, Math.floor(Number.isFinite(limit) ? limit : DEFAULT_LIMIT));
      if (!tokens.length || maximum === 0) {
        return [];
      }

      await ensureReady();
      await queue;

      const top = [];
      for (const entry of entries.values()) {
        const score = scoreEntry(entry, tokens);
        if (score) {
          addTopResult(top, { entry, score }, maximum);
        }
      }
      return top.map(({ entry }) => publicResult(entry));
    }

    return {
      ready: ensureReady,
      search,
      rebuild: () => enqueue(rebuildTree),
      onCreated: (id, node) => enqueue(() => {
        if (node.parentId != null && !nodes.has(node.parentId)) {
          return rebuildTree();
        }
        upsertSubtree({ ...node, id }, node.parentId ?? null);
        return undefined;
      }),
      onChanged: (id, changeInfo) => enqueue(() => {
        const node = nodes.get(id);
        if (!node) {
          return rebuildTree();
        }
        node.title = changeInfo.title == null ? node.title : String(changeInfo.title);
        node.url = changeInfo.url == null ? node.url : String(changeInfo.url);
        refreshSubtree(id);
        return undefined;
      }),
      onRemoved: (id) => enqueue(() => {
        removeSubtree(id);
      }),
      onMoved: (id, moveInfo) => enqueue(() => {
        const node = nodes.get(id);
        if (!node || (moveInfo.parentId != null && !nodes.has(moveInfo.parentId))) {
          return rebuildTree();
        }
        detachFromParent(id, node.parentId);
        node.parentId = moveInfo.parentId ?? null;
        attachToParent(id, node.parentId);
        refreshSubtree(id);
        return undefined;
      }),
      onImportEnded: () => enqueue(rebuildTree)
    };
  }

  return {
    DEFAULT_LIMIT,
    tokenize,
    createIndex
  };
})();
