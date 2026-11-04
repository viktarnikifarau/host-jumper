const test = require("node:test");
const assert = require("node:assert/strict");
const {
  loadScripts,
  folder,
  bookmark,
  treeWith,
  plain
} = require("./helpers.js");

const { HostJumperBookmarkSearch } = loadScripts(["bookmark_search.js"]);

function createApi(initialTree) {
  let tree = initialTree;
  let getTreeCalls = 0;
  return {
    api: {
      async getTree() {
        getTreeCalls += 1;
        return tree;
      }
    },
    replaceTree(nextTree) {
      tree = nextTree;
    },
    get getTreeCalls() {
      return getTreeCalls;
    }
  };
}

function acceptanceTree() {
  return treeWith([
    folder("ci", "CI", [
      folder("ci-1", "CI-1", [
        bookmark("server-1", "Server 1", "https://server1.ci.example.test/")
      ])
    ])
  ]);
}

test("matches nested folder path, title, and URL with tokens in any order", async () => {
  const { api } = createApi(acceptanceTree());
  const index = HostJumperBookmarkSearch.createIndex(api);

  const expected = {
    id: "server-1",
    title: "Server 1",
    url: "https://server1.ci.example.test/",
    path: ["CI", "CI-1"],
    displayPath: "CI > CI-1 > Server 1"
  };
  assert.deepEqual(plain(await index.search("ci-1 server 1")), [expected]);
  assert.deepEqual(plain(await index.search("1 SERVER ci-1")), [expected]);
  assert.deepEqual(plain(await index.search("ci ci-1")), [expected]);
  assert.deepEqual(plain(await index.search("server1.ci.example.test")), [expected]);
  assert.equal((await index.search("   ")).length, 0);
});

test("ranks consecutive folder matches above title and URL matches", async () => {
  const tree = treeWith([
    folder("ci", "CI", [
      folder("ci-1", "CI-1", [
        bookmark("nested", "Server 1", "https://nested.example.test/")
      ])
    ]),
    bookmark("title", "ci-1 server 1", "https://title.example.test/"),
    bookmark("url", "Status", "https://example.test/ci-1/server/1")
  ]);
  const index = HostJumperBookmarkSearch.createIndex(createApi(tree).api);

  const results = await index.search("ci-1 server 1");
  assert.deepEqual(Array.from(results, (result) => result.id), ["nested", "title", "url"]);

  const pathResults = await index.search("ci ci-1");
  assert.equal(pathResults[0].id, "nested");
});

test("keeps duplicate titles as distinct results with their own paths", async () => {
  const tree = treeWith([
    folder("ci", "CI", [
      folder("ci-1", "CI-1", [bookmark("primary", "Server 1", "https://one.example.test/")])
    ]),
    folder("backup", "Backup", [
      folder("ci-1-backup", "CI-1", [bookmark("backup", "Server 1", "https://two.example.test/")])
    ]),
    bookmark("root", "Server 1", "https://root.example.test/")
  ]);
  const index = HostJumperBookmarkSearch.createIndex(createApi(tree).api);

  const results = await index.search("server 1", { limit: 10 });
  assert.equal(results.length, 3);
  assert.deepEqual(new Set(results.map((result) => result.id)), new Set(["primary", "backup", "root"]));
  assert.equal(results.find((result) => result.id === "backup").displayPath, "Backup > CI-1 > Server 1");
  assert.equal(results.find((result) => result.id === "root").displayPath, "Server 1");
});

test("matches case-insensitive special characters literally in folders and URLs", async () => {
  const tree = treeWith([
    folder("prod", "R&D [Prod]", [
      bookmark("special", "C++ Server", "https://example.test/a?x=Foo%20Bar&mode=A")
    ])
  ]);
  const index = HostJumperBookmarkSearch.createIndex(createApi(tree).api);

  const results = await index.search("r&d [prod] c++ foo%20bar&mode=a");
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "special");
  assert.equal((await index.search("r&d [stage]")).length, 0);
});

test("updates renamed, moved, created, changed, and removed subtrees without rebuilding", async () => {
  const initialTree = treeWith([
    folder("ci", "CI", [
      folder("ci-1", "CI-1", [bookmark("server", "Server 1", "https://old.example.test/")])
    ]),
    folder("archive", "Archive")
  ]);
  const source = createApi(initialTree);
  const index = HostJumperBookmarkSearch.createIndex(source.api);
  await index.ready();
  assert.equal(source.getTreeCalls, 1);

  await index.onChanged("ci-1", { title: "CI-2" });
  assert.equal((await index.search("ci-1")).length, 0);
  assert.equal((await index.search("ci-2 server"))[0].displayPath, "CI > CI-2 > Server 1");

  await index.onMoved("ci-1", { oldParentId: "ci", parentId: "archive" });
  assert.equal((await index.search("archive server"))[0].displayPath, "Archive > CI-2 > Server 1");

  await index.onCreated("api", {
    id: "api",
    parentId: "ci-1",
    title: "API & Docs",
    url: "https://api.example.test/"
  });
  assert.equal((await index.search("archive api"))[0].id, "api");

  await index.onChanged("api", { title: "API & Reference", url: "https://reference.example.test/" });
  const changed = (await index.search("reference.example.test"))[0];
  assert.equal(changed.title, "API & Reference");
  assert.equal(changed.url, "https://reference.example.test/");

  await index.onRemoved("archive", { parentId: "root" });
  assert.equal((await index.search("ci-2")).length, 0);
  assert.equal((await index.search("reference")).length, 0);
  assert.equal(source.getTreeCalls, 1, "incremental events should not fetch the tree again");

  source.replaceTree(treeWith([
    folder("imported", "Imported", [bookmark("new", "New bookmark", "https://new.example.test/")])
  ]));
  await index.onImportEnded();
  assert.equal(source.getTreeCalls, 2);
  assert.equal((await index.search("imported new"))[0].displayPath, "Imported > New bookmark");
  assert.equal((await index.search("server 1")).length, 0);
});

test("bounds result sets while preserving the best matches", async () => {
  const bookmarks = Array.from({ length: 100 }, (_, position) => (
    bookmark(`bookmark-${position}`, `Server ${position}`, `https://${position}.example.test/`)
  ));
  const tree = treeWith([
    folder("ci", "CI", [bookmark("best", "Server", "https://best.example.test/")]),
    ...bookmarks
  ]);
  const index = HostJumperBookmarkSearch.createIndex(createApi(tree).api);

  const results = await index.search("server");
  assert.equal(results.length, HostJumperBookmarkSearch.DEFAULT_LIMIT);
  assert.equal(results[0].id, "best");
  assert.equal((await index.search("server", { limit: 0 })).length, 0);
});
