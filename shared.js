const HostJumper = (() => {
  const STORAGE_KEY = "paths";
  const EXPORT_VERSION = 1;

  function createId() {
    return crypto.randomUUID ? crypto.randomUUID() : `path-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function extractParams(urlString) {
    const params = {};
    const url = new URL(urlString);

    url.pathname
      .split("/")
      .filter(Boolean)
      .forEach((segment, index) => {
        params[String(index + 1)] = decodeURIComponent(segment);
      });

    const hash = url.hash.replace(/^#/, "");
    if (hash) {
      const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : hash;
      if (query.includes("=")) {
        new URLSearchParams(query).forEach((value, key) => {
          params[key] = value;
        });
      }
    }

    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return params;
  }

  function normalizePath(input) {
    let path = String(input || "").trim();
    if (!path) {
      return "/";
    }

    try {
      if (/^https?:\/\//i.test(path)) {
        const url = new URL(path);
        path = `${url.pathname}${url.search}${url.hash}`;
      }
    } catch (error) {
      // Keep the original value and fall through to slash-normalization.
    }

    if (!path.startsWith("/")) {
      path = `/${path}`;
    }

    return path;
  }

  function resolvePath(pathTemplate, currentUrl) {
    const url = new URL(currentUrl);
    const params = extractParams(currentUrl);
    const missing = [];
    const resolvedPath = normalizePath(pathTemplate).replace(/\{([^{}]+)\}/g, (_, placeholder) => {
      const names = placeholder.split(",").map((name) => name.trim()).filter(Boolean);
      const match = names.find((name) => params[name] != null && params[name] !== "");
      if (!match) {
        missing.push(placeholder.trim());
        return "";
      }
      return encodeURIComponent(params[match]);
    });

    return {
      url: `${url.origin}${resolvedPath}`,
      missing
    };
  }

  function normalizeUses(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      return 0;
    }
    return Math.floor(n);
  }

  function formatUses(value) {
    const uses = normalizeUses(value);
    return uses === 1 ? "1 use" : `${uses} uses`;
  }

  function buildPickerItems(paths, currentUrl) {
    return (paths || []).map((item) => {
      const resolved = resolvePath(item.path, currentUrl);
      return {
        id: item.id,
        label: item.label || item.path,
        path: item.path,
        uses: normalizeUses(item.uses),
        url: resolved.url,
        missing: resolved.missing
      };
    });
  }

  async function getPaths() {
    const data = await browser.storage.local.get(STORAGE_KEY);
    return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  }

  async function savePaths(paths) {
    await browser.storage.local.set({ [STORAGE_KEY]: paths });
  }

  async function incrementPathUse(id) {
    if (!id) {
      return;
    }

    const paths = await getPaths();
    let changed = false;
    const next = paths.map((item) => {
      if (item.id !== id) {
        return item;
      }
      changed = true;
      return { ...item, uses: normalizeUses(item.uses) + 1 };
    });

    if (changed) {
      await savePaths(next);
    }
  }

  function serializeConfig(paths) {
    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      paths: (paths || [])
        .map((item) => ({
          label: String(item?.label || "").trim(),
          path: normalizePath(item?.path || "")
        }))
        .filter((item) => item.path !== "/")
    };
  }

  function parseConfig(input) {
    let parsed = input;
    if (typeof input === "string") {
      try {
        parsed = JSON.parse(input);
      } catch (error) {
        throw new Error("Configuration file is not valid JSON.");
      }
    }
    const rawPaths = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray(parsed.paths)
        ? parsed.paths
        : null;

    if (!rawPaths) {
      throw new Error("Configuration file has no paths.");
    }

    const paths = rawPaths
      .map((item) => {
        if (typeof item === "string") {
          const path = normalizePath(item);
          return path === "/" ? null : { id: createId(), label: "", path, uses: 0 };
        }

        if (!item || typeof item !== "object") {
          return null;
        }

        const path = normalizePath(item.path || "");
        if (path === "/") {
          return null;
        }

        return {
          id: createId(),
          label: String(item.label || "").trim(),
          path,
          uses: 0
        };
      })
      .filter(Boolean);

    if (!paths.length) {
      throw new Error("Configuration file contains no valid paths.");
    }

    return paths;
  }

  function mergePaths(current, incoming) {
    const seen = new Set((current || []).map((item) => item.path));
    const merged = (current || []).slice();

    for (const item of incoming || []) {
      if (seen.has(item.path)) {
        continue;
      }
      seen.add(item.path);
      merged.push(item);
    }

    return merged;
  }

  return {
    STORAGE_KEY,
    EXPORT_VERSION,
    createId,
    extractParams,
    normalizePath,
    normalizeUses,
    formatUses,
    resolvePath,
    buildPickerItems,
    getPaths,
    savePaths,
    incrementPathUse,
    serializeConfig,
    parseConfig,
    mergePaths
  };
})();
