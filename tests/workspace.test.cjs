const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../dist/index.js");
const shape = (id, x = 0, extra = {}) =>
  api.createElement("rectangle", {
    id,
    x,
    y: 0,
    width: 100,
    height: 80,
    ...extra,
  });
test("workspace reload validates board scope, migrates v0 and clamps camera zoom", () => {
  const workspace = api.emptyWorkspace("a");
  workspace.version = 0;
  workspace.viewpoints = [
    { id: "v", name: "Focus", viewport: { panX: 20, panY: 30, zoom: 100 } },
  ];
  const result = api.normalizeWorkspace(
    JSON.parse(JSON.stringify(workspace)),
    "a",
  );
  assert.equal(result.version, 1);
  assert.equal(result.viewpoints[0].viewport.zoom, 5);
  assert.throws(() => api.normalizeWorkspace(workspace, "b"));
  assert.throws(() =>
    api.normalizeWorkspace({ ...workspace, version: 99 }, "a"),
  );
});
test("library normalizes geometry, remaps internal bindings and detaches external targets", () => {
  const a = shape("a", 100),
    b = shape("b", 300),
    edge = api.createElement("arrow", {
      id: "edge",
      x: 200,
      y: 40,
      width: 100,
      height: 0,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      startBinding: { elementId: "a", fixedPoint: { x: 1, y: 0.5 } },
      endBinding: { elementId: "b", fixedPoint: { x: 0, y: 0.5 } },
    });
  const entry = api.createLibraryEntry([a, b, edge], ["a", "edge"], "Decision");
  assert.equal(entry.elements[0].x, 0);
  assert.equal(entry.elements[1].endBinding, null);
  const first = api.insertLibraryEntry(entry, { x: 500, y: 200 }),
    second = api.insertLibraryEntry(entry, { x: 500, y: 200 });
  assert.equal(first[0].x, 500);
  assert.equal(first[1].startBinding.elementId, first[0].id);
  assert.notEqual(first[0].id, second[0].id);
  assert.equal(first[0].y, 200);
});
test("selection bookmarks report hidden and deleted members without changing their state", () => {
  const elements = [
    shape("a"),
    shape("b", 200, { hidden: true }),
    shape("c", 400, { isDeleted: true }),
  ];
  const before = JSON.stringify(elements);
  assert.deepEqual(
    api.restoreSelectionBookmark(
      { id: "saved", name: "Saved", ids: ["a", "b", "c"] },
      elements,
    ),
    { ids: ["a", "b"], hidden: ["b"], missing: ["c"] },
  );
  assert.equal(JSON.stringify(elements), before);
});
test("style presets cannot replace identity, geometry or text and report incompatible fields", () => {
  const a = shape("a", 20, { text: "Keep" }),
    edge = api.createElement("arrow", { id: "edge", x: 0, y: 0 });
  const preset = {
    id: "p",
    name: "Red",
    style: {
      id: "hijack",
      x: 999,
      text: "replace",
      strokeColor: "#ff0000",
      borderRadius: 18,
    },
  };
  const result = api.applyStylePreset(
    [a, edge],
    new Set(["a", "edge"]),
    preset,
  );
  assert.equal(result.elements[0].id, "a");
  assert.equal(result.elements[0].x, 20);
  assert.equal(result.elements[0].text, "Keep");
  assert.equal(result.elements[0].strokeColor, "#ff0000");
  assert.ok(result.skipped.includes("borderRadius"));
  assert.throws(() =>
    api.applyStylePreset([a], new Set(["a"]), {
      ...preset,
      style: { fontSize: -1 },
    }),
  );
});
test("CSV handles quoted labels, cycles and errors before creating a preview", () => {
  const items = api.parseDiagram(
    'id,label,target\na,"Hello, world",b\nb,"A ""quote""",a',
  );
  assert.equal(items.length, 4);
  assert.equal(items[0].text, "Hello, world");
  assert.equal(items[1].text, 'A "quote"');
  assert.notEqual(items[0].x, items[1].x);
  for (const bad of ["a,One,z", "a,One,\na,Two,", 'a,"unterminated', ""])
    assert.throws(() => api.parseDiagram(bad));
});

test("CSV keeps a headerless node named id and rejects text after a closing quote", () => {
  const items = api.parseDiagram("id,First node,second\nsecond,Second node,");
  assert.equal(items.length, 3);
  assert.equal(items[0].text, "First node");
  assert.equal(items[2].startBinding.elementId, items[0].id);
  assert.equal(items[2].endBinding.elementId, items[1].id);
  assert.equal(api.parseDiagram("id,label\na,First node").length, 1);
  assert.equal(api.parseDiagram('id,label,target\na,"Line one\nLine two",').length, 1);
  assert.throws(() => api.parseDiagram('a,"First"garbage,'), /quoted field/i);
});
test("graph layout preserves locked objects and updates bound endpoints", () => {
  const items = api.parseDiagram("a,One,b\nb,Two,");
  items[1] = { ...items[1], locked: true };
  const before = JSON.stringify(items[1]);
  const next = api.layoutDiagram(
    items,
    new Set(items.map((e) => e.id)),
    "mind-map",
  );
  assert.equal(JSON.stringify(next[1]), before);
  assert.equal(next[2].endBinding.elementId, next[1].id);
});
test("relationship outline exposes connected targets while excluding hidden/deleted nodes", () => {
  const items = api.parseDiagram("a,One,b\nb,Two,");
  const outline = api.relationshipOutline(items);
  assert.equal(outline[0].connections[0].targetId, items[1].id);
  assert.equal(
    api.relationshipOutline(items.map((e) => ({ ...e, hidden: true }))).length,
    0,
  );
});
test("links reject unsafe schemes and metadata validates crops and future calculation versions", () => {
  for (const target of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///C:/secret",
  ])
    assert.throws(() => api.validateObjectLink({ kind: "url", target }));
  assert.equal(
    api.validateObjectLink({ kind: "url", target: "https://example.com" })
      .target,
    "https://example.com",
  );
  const image = api.createElement("image", {
    id: "image",
    assetId: "asset",
    dataUrl: "",
    width: 100,
    height: 100,
  });
  assert.equal(
    api.deserializeBoard({ elements: [image] }).elements[0].assetId,
    "asset",
  );
  assert.throws(() =>
    api.setImageCrop(image, { x: 0.8, y: 0, width: 0.5, height: 1 }),
  );
  const cropped = api.setImageCrop(
    image,
    { x: 0.1, y: 0.2, width: 0.5, height: 0.5 },
    "ellipse",
  );
  assert.equal(cropped.dataUrl, image.dataUrl);
  assert.equal(api.hitTestElement({ x: 1, y: 1 }, cropped, 0), false);
  assert.equal(api.hitTestElement({ x: 50, y: 50 }, cropped, 0), true);
  const card = api.createCalculationCard(
    { version: 5, expression: "x+1", variables: { x: 1 }, result: "2" },
    { x: 0, y: 0 },
  );
  assert.equal(
    api.deserializeBoard({ elements: [card] }).elements[0].text,
    "x+1\n= 2",
  );
});
test("typed ports bind, survive rename/move/duplication and detach on deletion", () => {
  const target = shape("a", 100, {
      ports: [
        { id: "p", name: "Input", point: { x: 0, y: 0.5 }, accepts: ["arrow"] },
      ],
    }),
    edge = api.createElement("arrow", {
      id: "edge",
      x: 0,
      y: 0,
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 40 },
      ],
    });
  const bound = api.bindConnectionPort([target, edge], "edge", "end", "a", "p");
  assert.equal(bound[1].endBinding.portId, "p");
  const moved = api.updateBoundElements([
    { ...bound[0], x: 300, ports: [{ ...target.ports[0], name: "Renamed" }] },
    bound[1],
  ]);
  assert.equal(api.resolveBinding(moved[1].endBinding, moved).x, 300);
  const copies = api.duplicateElements(moved);
  assert.equal(copies[1].endBinding.elementId, copies[0].id);
  assert.equal(copies[1].endBinding.portId, "p");
  assert.equal(
    api.updateBoundElements([{ ...moved[0], ports: [] }, moved[1]])[1]
      .endBinding,
    null,
  );
  assert.throws(() =>
    api.bindConnectionPort(
      [target, { ...edge, type: "line" }],
      "edge",
      "end",
      "a",
      "p",
    ),
  );
});
test("stroke recognition offers a replacement without modifying the original", () => {
  const pen = api.createElement("pen", {
    id: "pen",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    strokeColor: "red",
    points: [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
      { x: 50, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 50 },
      { x: 0, y: 0 },
    ],
  });
  const before = JSON.stringify(pen),
    suggestion = api.recognizeStroke(pen);
  assert.equal(suggestion.element.type, "rectangle");
  assert.equal(suggestion.element.id, "pen");
  assert.equal(suggestion.element.strokeColor, "red");
  assert.equal(JSON.stringify(pen), before);
  assert.equal(api.recognizeStroke(shape("a")), null);
});
test("version comparison identifies restore additions, removals and metadata changes", () => {
  assert.deepEqual(
    api.compareBoardVersions(
      [shape("a"), shape("b")],
      [shape("a", 0, { displayName: "New name" }), shape("c")],
    ),
    { added: ["c"], removed: ["b"], changed: ["a"] },
  );
});
test("clipboard roundtrip remaps references and rejects unsupported/hostile payloads", () => {
  const items = api.parseDiagram("a,One,b\nb,Two,");
  const encoded = api.serializeBoardClipboard(
      items,
      items.map((el) => el.id),
    ),
    copy = api.parseBoardClipboard(encoded, { x: 50, y: 60 });
  assert.equal(copy.length, 3);
  assert.equal(copy[2].startBinding.elementId, copy[0].id);
  assert.notEqual(copy[0].id, items[0].id);
  assert.throws(() =>
    api.parseBoardClipboard('{"version":99,"elements":[]}', { x: 0, y: 0 }),
  );
});

test("clipboard and library copies remap object links inside the copied selection", () => {
  const items = [
    shape("a", 0, { link: { kind: "object", target: "b" } }),
    shape("b", 200, { link: { kind: "object", target: "outside" } }),
  ];
  const entry = api.createLibraryEntry(items, ["a", "b"], "Linked pair");
  assert.equal(entry.elements[0].link.target, entry.elements[1].id);
  const copy = api.parseBoardClipboard(
    api.serializeBoardClipboard(items, ["a", "b"]),
    { x: 50, y: 60 },
  );
  assert.equal(copy[0].link.target, copy[1].id);
  assert.equal(copy[1].link.target, "outside");
  assert.equal(items[0].link.target, "b");
  const selfLinked = shape("self", 0, { link: { kind: "object", target: "self" } });
  const duplicate = api.duplicateElement(selfLinked);
  assert.equal(duplicate.link.target, duplicate.id);
});
test("PDF planning handles paper sizes, tiling and resource ceilings", () => {
  const p = api.pdfPagePlan(1400, 1000, { paper: "letter", paginate: true });
  assert.equal(p.columns, 3);
  assert.equal(p.rows, 2);
  const fit = api.pdfPagePlan(1400, 1000, { paper: "letter" });
  assert.ok(fit.scale < 1);
  assert.equal(fit.columns, 1);
  assert.throws(() =>
    api.pdfPagePlan(1e8, 1e8, { paper: "a4", paginate: true }),
  );
  assert.throws(() =>
    api.pdfPagePlan(100, 100, { paper: { width: 10, height: 10 } }),
  );
});
test("media resolution deduplicates fetches and removes revoked bytes", async () => {
  const images = [0, 1].map((i) =>
    api.createElement("image", { id: "i" + i, assetId: "a", dataUrl: "" }),
  );
  let calls = 0;
  const result = await api.resolveBoardMedia(
    images,
    {
      resolveMedia: async () => {
        calls++;
        return null;
      },
    },
    new AbortController().signal,
  );
  assert.equal(calls, 1);
  assert.ok(result.every((el) => el.dataUrl === ""));
  assert.ok(api.referenceMedia(result).every((el) => el.dataUrl === ""));
});
test("local room expires presence, removes disconnects and keeps transient state outside board history", () => {
  let time = 1000;
  const room = api.createLocalBoardRoom(() => time),
    a = room.connect({ sessionId: "a", userId: "a", name: "A", color: "red" }),
    b = room.connect({ sessionId: "b", userId: "b", name: "B", color: "blue" });
  a.awareness.publish({
    ...a.awareness.self,
    updatedAt: time,
    selection: ["node"],
    cursor: { x: 50, y: 60 },
  });
  assert.equal(b.awareness.getPeers().length, 1);
  time += 16000;
  assert.equal(b.awareness.getPeers().length, 0);
  a.awareness.publish({ ...a.awareness.self, updatedAt: time, selection: [] });
  a.disconnect();
  assert.equal(b.awareness.getPeers().length, 0);
  assert.throws(() => a.awareness.publish(null));
});
test("host voting rejects replay, limits, stale revisions and removed notes; hides totals", async () => {
  const room = api.createLocalBoardRoom();
  room.setVoteTargets(["note"]);
  const a = room.connect({
      sessionId: "a",
      userId: "u",
      name: "A",
      color: "red",
    }),
    b = room.connect({ sessionId: "b", userId: "u", name: "A", color: "red" });
  const vote = async (session, id) =>
    session.workshop.dispatch(
      { type: "vote", objectId: "note", delta: 1, requestId: id },
      session.workshop.getSnapshot().revision,
    );
  await vote(a, "1");
  await vote(b, "1");
  assert.equal(a.workshop.getSnapshot().voting.myVotes.note, 1);
  await vote(a, "2");
  await vote(b, "3");
  await assert.rejects(vote(a, "4"));
  assert.equal(a.workshop.getSnapshot().voting.totals, undefined);
  await assert.rejects(
    a.workshop.dispatch(
      { type: "voting", open: false, reveal: true },
      a.workshop.getSnapshot().revision,
    ),
  );
  room.setVoteTargets([]);
  await assert.rejects(vote(a, "5"));
});
test("timer reconstructs remaining time after pause and reconnect with moderator permissions", async () => {
  let now = 1000;
  const room = api.createLocalBoardRoom(() => now),
    host = room.connect(
      { sessionId: "host", userId: "host", name: "Host", color: "red" },
      true,
    );
  const dispatch = (action) =>
    host.workshop.dispatch(action, host.workshop.getSnapshot().revision);
  await dispatch({ type: "timer", operation: "reset", durationMs: 10000 });
  await dispatch({ type: "timer", operation: "start" });
  now += 3000;
  await dispatch({ type: "timer", operation: "pause" });
  now += 20000;
  let s = host.workshop.getSnapshot();
  assert.equal(api.timerRemaining(s.timer, s.serverNow), 7000);
  await dispatch({ type: "timer", operation: "start" });
  now += 2000;
  s = host.workshop.getSnapshot();
  assert.equal(api.timerRemaining(s.timer, s.serverNow), 5000);
});
test("comments retain an orphan anchor and enforce moderator resolution", async () => {
  const room = api.createLocalBoardRoom(),
    host = room.connect(
      { sessionId: "h", userId: "h", name: "H", color: "red" },
      true,
    ),
    guest = room.connect({
      sessionId: "g",
      userId: "g",
      name: "G",
      color: "blue",
    });
  await guest.comments.dispatch({
    type: "create",
    elementId: "a",
    point: { x: 1, y: 0 },
    fallbackPoint: { x: 100, y: 0 },
    text: "Check this",
  });
  room.syncElements([shape("a", 300)]);
  let thread = host.comments.getThreads()[0];
  assert.equal(api.commentAnchor(thread, []).point.x, 400);
  await assert.rejects(
    guest.comments.dispatch({
      type: "resolve",
      threadId: thread.id,
      resolved: true,
    }),
  );
  await host.comments.dispatch({
    type: "resolve",
    threadId: thread.id,
    resolved: true,
  });
  assert.equal(host.comments.getThreads()[0].resolved, true);
});
test("text cancellation preserves disjoint peer edits and refuses overlapping edits", () => {
  assert.deepEqual(
    api.cancelTextIntent(
      { before: "Hello", after: "Hello local" },
      "Peer Hello local",
    ),
    { text: "Peer Hello", conflict: false },
  );
  assert.equal(
    api.cancelTextIntent(
      { before: "Hello", after: "Hello local" },
      "Hello changed",
    ).conflict,
    true,
  );
  assert.deepEqual(
    api.cancelTextIntent(
      { before: "Hello local", after: "Hello" },
      "Peer Hello",
    ),
    { text: "Peer Hello local", conflict: false },
  );
});

test('revoked document resolution clears saved excerpts before hydration/export',async()=>{
 const card=api.createDocumentCard({documentId:'doc',revision:'1',title:'Private',fallback:'Private excerpt'},{x:0,y:0});
 const result=await api.resolveDocumentCards([card],{resolveDocument:async()=>null},new AbortController().signal);assert.equal(result[0].text,'Document unavailable');assert.equal(result[0].documentCard.fallback,'');
});
test('rotated comment anchors follow geometry and forbidden imported port types detach',()=>{
 const target=shape('a',100,{angle:Math.PI/2,ports:[{id:'p',name:'Arrow only',point:{x:1,y:.5},accepts:['arrow']}]});const thread={id:'t',elementId:'a',point:{x:1,y:.5},resolved:false,messages:[]};const point=api.commentAnchor(thread,[target]).point;assert.ok(Math.abs(point.x-150)<.001);assert.ok(Math.abs(point.y-90)<.001);
 const edge=api.createElement('line',{id:'line',points:[{x:0,y:0},{x:10,y:10}],endBinding:{elementId:'a',portId:'p',fixedPoint:{x:1,y:.5}}});assert.equal(api.updateBoundElements([target,edge])[1].endBinding,null);
});
