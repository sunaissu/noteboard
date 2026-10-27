import { useEffect, useRef, useState } from "react";
import type { NoteboardElement, Point } from "../elements/types";
import type { NoteboardViewport } from "../session";
import { deserializeBoard } from "../session";
import { generateId } from "../elements/createElement";
import { NoteboardPreview } from "./NoteboardPreview";
import { WorkspaceDialog } from "./WorkspaceDialog";
import {
  emptyWorkspace,
  normalizeWorkspace,
  createLibraryEntry,
  insertLibraryEntry,
  createStylePreset,
  applyStylePreset,
  restoreSelectionBookmark,
  parseDiagram,
  layoutDiagram,
  relationshipOutline,
  recognizeStroke,
  compareBoardVersions,
} from "../boardWorkflows";
import type {
  BoardWorkspaceState,
  BoardWorkspaceStorage,
} from "../boardWorkflows";
import {
  validateObjectLink,
  setImageCrop,
  bindConnectionPort,
  createDocumentCard,
  createCalculationCard,
  validateElementMetadata,
} from "../boardMetadata";
import type { BoardContentAdapter } from "../boardMetadata";
import type { BoardVersionsAdapter } from "../collaborationWorkflows";

export interface BoardWorkspaceProps {
  onDocumentAccess?:(id:string,allowed:boolean)=>void;
  boardId: string;
  elements: NoteboardElement[];
  selected: Set<string>;
  readOnly: boolean;
  viewport: NoteboardViewport;
  onViewport: (viewport: NoteboardViewport) => void;
  onSelect: (ids: string[]) => void;
  onFocus: (ids: string[]) => void;
  mutate: (
    change: (elements: NoteboardElement[]) => NoteboardElement[],
  ) => boolean;
  storage?: BoardWorkspaceStorage;
  state?: BoardWorkspaceState;
  onStateChange?: (state: BoardWorkspaceState) => void;
  content?: BoardContentAdapter;
  versions?: BoardVersionsAdapter;
  onClose: () => void;
  onPresent?: (views: import("../boardWorkflows").BoardViewpoint[]) => void;
}
const tabs = [
  "Views",
  "Library",
  "Diagram",
  "Objects",
  "Styles",
  "Versions",
] as const;
const button = { minHeight: 44, padding: "8px 12px", margin: 3 };
const field = {
  minHeight: 38,
  maxWidth: "100%",
  boxSizing: "border-box" as const,
};
export function BoardWorkspace(props: BoardWorkspaceProps) {
  return <BoardWorkspaceSession key={props.boardId} {...props} />;
}

function BoardWorkspaceSession(props: BoardWorkspaceProps) {
  const { elements, selected, readOnly, boardId, storage, content, versions } =
    props;
  const [tab, setTab] = useState<(typeof tabs)[number]>("Views"),
    [local, setLocal] = useState(() => emptyWorkspace(boardId));
  const candidateState = props.state ?? local;
  const state = candidateState.boardId === boardId ? candidateState : emptyWorkspace(boardId);
  const [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(!storage || !!props.state);
  const latest = useRef(props);
  latest.current = props;
  const abort = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!storage || props.state) return;
    let active = true;
    setLoaded(false);
    Promise.resolve()
      .then(() => storage.load(boardId))
      .then(
        (value) => {
          if (active) {
            setLocal(
              value
                ? normalizeWorkspace(value, boardId)
                : emptyWorkspace(boardId),
            );
            setLoaded(true);
          }
        },
      )
      .catch((err) => {
        if (active) setError("Could not load workspace: " + String(err));
      });
    return () => {
      active = false;
    };
  }, [boardId, storage, props.state]);
  const run = async (action: (signal: AbortSignal) => void | Promise<void>) => {
    const signal = abort.current.signal;
    if (signal.aborted) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action(signal);
    } catch (err) {
      if (!signal.aborted)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  };
  const save = async (next: BoardWorkspaceState) => {
    const signal = abort.current.signal;
    if (signal.aborted) return;
    const normalized = normalizeWorkspace(next, boardId);
    if (storage) await storage.save(boardId, normalized);
    if (signal.aborted) return;
    setLocal(normalized);
    props.onStateChange?.(normalized);
    setTitle("");
    setMessage(
      storage
        ? "Saved workspace."
        : "Saved for this board session. Connect workspace storage to keep it after reload.",
    );
  };
  const change = (
    key: "viewpoints" | "bookmarks" | "library" | "presets",
    items: unknown[],
  ) => run(() => save({ ...state, [key]: items }));
  const [preview, setPreview] = useState<NoteboardElement[] | null>(null),
    [previewMode, setPreviewMode] = useState<"insert" | "replace">("insert"),
    [base, setBase] = useState("");
  const [csv, setCsv] = useState("id,label,target\na,Start,b\nb,Finish,"),
    [kind, setKind] = useState<"symbol" | "template">("symbol");
  const [outlineQuery,setOutlineQuery]=useState("");
  const [link, setLink] = useState(""),
    [linkKind, setLinkKind] = useState<"url" | "object" | "reference">("url");
  const [portName, setPortName] = useState(""),
    [portSide, setPortSide] = useState("right"),
    [portType, setPortType] = useState<"line" | "arrow" | "both">("both"),
    [endpoint, setEndpoint] = useState<"start" | "end">("end");
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 1, height: 1 }),
    [mask, setMask] = useState<"rectangle" | "ellipse">("rectangle");
  const [revisions, setRevisions] = useState<
      { id: string; name: string; createdAt: string }[]
    >([]),
    [revision, setRevision] = useState(""),
    [expected, setExpected] = useState("");
  const [documentId, setDocumentId] = useState(""),
    [formula, setFormula] = useState("");
  const [presenting, setPresenting] = useState(-1);
  const single = elements.filter((el) => selected.has(el.id) && !el.isDeleted);
  const object = single.length === 1 ? single[0] : undefined;
  const editable = !!object && !object.locked && !readOnly;
  const origin: Point = {
    x: -props.viewport.panX / props.viewport.zoom + 80,
    y: -props.viewport.panY / props.viewport.zoom + 80,
  };
  const commit = (next: NoteboardElement[]) => {
    if (latest.current.readOnly) throw new Error("Board is read-only");
    if (!props.mutate(() => next))
      throw new Error("The host rejected this change");
  };
  const patch = (updates: Partial<NoteboardElement>) => {
    if (!object || object.locked) throw new Error("Select an editable object");
    commit(
      elements.map((el) =>
        el.id === object.id ? ({ ...el, ...updates } as NoteboardElement) : el,
      ),
    );
  };
  const showPreview = (
    next: NoteboardElement[],
    mode: "insert" | "replace",
  ) => {
    setPreview(next);
    setPreviewMode(mode);
    setBase(JSON.stringify(elements));
    setRevision("");
  };
  const applyPreview = () =>
    run(async (signal) => {
      if (!preview) return;
      if (JSON.stringify(latest.current.elements) !== base)
        throw new Error(
          "Board changed. Generate a fresh preview before applying.",
        );
      if (latest.current.readOnly) throw new Error("Board is read-only");
      if (revision && versions) {
        if (versions.currentRevision() !== expected)
          throw new Error("Revision changed. Refresh this comparison.");
        const result = await versions.restore(
          revision,
          expected,
          signal,
        );
        if (signal.aborted || latest.current.readOnly) return;
        commit(deserializeBoard({ elements: result }).elements);
      } else
        commit(previewMode === "insert" ? [...elements, ...preview] : preview);
      setPreview(null);
      setMessage("Applied in one undo step.");
    });
  return (
    <WorkspaceDialog title="Board workspace" onClose={props.onClose} actions={preview&&<>          <button
            style={button}
            disabled={readOnly || busy}
            onClick={applyPreview}
          >
            Apply preview
          </button>
          <button style={button} onClick={() => setPreview(null)}>
            Cancel preview
          </button>
</>} navigation={<>
      <select className="noteboard-workspace-select" aria-label="Workspace section" value={tab} onChange={event=>{setTab(event.target.value as typeof tab);setPreview(null);}}>{tabs.map(t=><option key={t}>{t}</option>)}</select>
      <div
        className="noteboard-workspace-tabs"
        role="tablist"
        aria-label="Workspace tools"
        onKeyDown={event=>{const index=tabs.indexOf(tab);const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;if(next<0)return;event.preventDefault();setTab(tabs[next]);setPreview(null);(event.currentTarget.querySelectorAll('button')[next] as HTMLButtonElement)?.focus();}}
        style={{ display: "flex", flexWrap: "wrap" }}
      >
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            tabIndex={tab===t?0:-1}
            style={button}
            onClick={() => {
              setTab(t);
              setPreview(null);
            }}
          >
            {t}
          </button>
        ))}
      </div></>}>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!loaded && (
        <p>
          Workspace is not loaded. Close and reopen to retry a storage failure.
        </p>
      )}
      <fieldset
        disabled={busy || !loaded}
        style={{ border: 0, padding: 0, minWidth: 0 }}
      >
        {(tab === "Views" || tab === "Library" || tab === "Styles") && (
          <label>
            Name{" "}
            <input
              aria-label="Workspace item name"
              maxLength={256}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={field}
            />
          </label>
        )}
        {tab === "Views" && (
          <>
            <p>
              Save camera positions or object selections independently of
              grouping.
            </p>
            <button
              style={button}
              disabled={!title.trim()}
              onClick={() =>
                change("viewpoints", [
                  ...state.viewpoints,
                  { id: generateId(), name: title, viewport: props.viewport },
                ])
              }
            >
              Save viewpoint
            </button>
            <button
              style={button}
              disabled={!title.trim() || !selected.size}
              onClick={() =>
                change("bookmarks", [
                  ...state.bookmarks,
                  { id: generateId(), name: title, ids: [...selected] },
                ])
              }
            >
              Save selection
            </button>
            <ol>
              {state.viewpoints.map((v, i) => (
                <li key={v.id}>
                  <button
                    style={button}
                    onClick={() => props.onViewport(v.viewport)}
                  >
                    {v.name}
                  </button>
                  <button
                    style={button}
                    disabled={i === 0}
                    aria-label={"Move viewpoint " + v.name + " earlier"}
                    onClick={() => {
                      const items = state.viewpoints.slice();
                      [items[i - 1], items[i]] = [items[i], items[i - 1]];
                      change("viewpoints", items);
                    }}
                  >
                    Earlier
                  </button>
                  <button
                    style={button}
                    onClick={() =>
                      change(
                        "viewpoints",
                        state.viewpoints.filter((x) => x.id !== v.id),
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
            <button
              style={button}
              disabled={!state.viewpoints.length}
              onClick={() => {
                if (props.onPresent) {
                  props.onPresent(state.viewpoints);
                  props.onClose();
                } else {
                  setPresenting(0);
                  props.onViewport(state.viewpoints[0].viewport);
                }
              }}
            >
              Start presentation
            </button>
            {presenting >= 0 && (
              <div role="group" aria-label="Presentation">
                <button
                  style={button}
                  disabled={presenting === 0}
                  onClick={() => {
                    const i = presenting - 1;
                    setPresenting(i);
                    props.onViewport(state.viewpoints[i].viewport);
                  }}
                >
                  Previous view
                </button>
                <span>
                  {presenting + 1} / {state.viewpoints.length}
                </span>
                <button
                  style={button}
                  disabled={presenting >= state.viewpoints.length - 1}
                  onClick={() => {
                    const i = presenting + 1;
                    setPresenting(i);
                    props.onViewport(state.viewpoints[i].viewport);
                  }}
                >
                  Next view
                </button>
                <button style={button} onClick={() => setPresenting(-1)}>
                  End presentation
                </button>
              </div>
            )}
            <ul>
              {state.bookmarks.map((b) => (
                <li key={b.id}>
                  <button
                    style={button}
                    onClick={() => {
                      const result = restoreSelectionBookmark(b, elements);
                      props.onSelect(result.ids);
                      props.onFocus(result.ids);
                      setMessage(
                        `${result.ids.length} members selected; ${result.missing.length} missing; ${result.hidden.length} hidden.`,
                      );
                    }}
                  >
                    {b.name}
                  </button>
                  <button
                    style={button}
                    onClick={() =>
                      change(
                        "bookmarks",
                        state.bookmarks.filter((x) => x.id !== b.id),
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {tab === "Library" && (
          <>
            <label>
              Save as{" "}
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                style={field}
              >
                <option value="symbol">Symbol</option>
                <option value="template">Template</option>
              </select>
            </label>
            <button
              style={button}
              disabled={!selected.size || !title.trim() || readOnly}
              onClick={() =>
                run(() =>
                  save({
                    ...state,
                    library: [
                      ...state.library,
                      createLibraryEntry(elements, selected, title, kind),
                    ],
                  }),
                )
              }
            >
              Save selection to library
            </button>
            {state.library.map((entry) => (
              <div
                key={entry.id}
                style={{ border: "1px solid #8885", padding: 8, marginTop: 8 }}
              >
                <strong>
                  {entry.name} · {entry.kind}
                </strong>
                <div style={{ height: 120 }}>
                  <NoteboardPreview elements={entry.elements} height="100%" />
                </div>
                <button
                  style={button}
                  disabled={readOnly}
                  onClick={() =>
                    run(() => {
                      showPreview(insertLibraryEntry(entry, origin), "insert");
                    })
                  }
                >
                  Preview insertion
                </button>
                <button
                  style={button}
                  onClick={() =>
                    change(
                      "library",
                      state.library.filter((x) => x.id !== entry.id),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </>
        )}
        {tab === "Diagram" && (
          <>
            <p>
              Import CSV columns id,label,target. Quote labels containing
              commas. Targets refer to another row ID.
            </p>
            <textarea
              aria-label="Diagram CSV"
              rows={6}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              style={{ ...field, width: "100%" }}
            />
            <button
              style={button}
              disabled={readOnly}
              onClick={() =>
                run(() => {
                  showPreview(
                    parseDiagram(csv).map((el) => ({
                      ...el,
                      x: el.x + origin.x,
                      y: el.y + origin.y,
                    })),
                    "insert",
                  );
                })
              }
            >
              Preview diagram import
            </button>
            <button
              style={button}
              disabled={readOnly || !selected.size}
              onClick={() =>
                run(() => {
                  showPreview(
                    layoutDiagram(elements, selected, "flow"),
                    "replace",
                  );
                })
              }
            >
              Preview flow layout
            </button>
            <button
              style={button}
              disabled={readOnly || !selected.size}
              onClick={() =>
                run(() => {
                  showPreview(
                    layoutDiagram(elements, selected, "mind-map"),
                    "replace",
                  );
                })
              }
            >
              Preview mind-map layout
            </button>
            <button
              style={button}
              disabled={!editable}
              onClick={() =>
                run(() => {
                  const suggestion = object && recognizeStroke(object);
                  if (!suggestion)
                    throw new Error(
                      "No confident line, rectangle or ellipse match. The stroke was kept.",
                    );
                  showPreview(
                    elements.map((el) =>
                      el.id === object!.id ? suggestion.element : el,
                    ),
                    "replace",
                  );
                  setMessage(
                    `${suggestion.element.type}, ${Math.round(suggestion.confidence * 100)}% confidence. Apply or cancel below.`,
                  );
                })
              }
            >
              Recognize selected stroke
            </button>
            <details>
              <summary>Relationships</summary><input aria-label="Search relationships" value={outlineQuery} onChange={e=>setOutlineQuery(e.target.value)} style={field}/><p>Showing up to 200 matching objects.</p>
              <ul aria-label="Object relationships">
                {relationshipOutline(elements).filter(item=>String(item.name).toLowerCase().includes(outlineQuery.toLowerCase())).slice(0,200).map((item) => (
                  <li key={item.id}>
                    <button
                      style={button}
                      onClick={() => {
                        props.onSelect([item.id]);
                        props.onFocus([item.id]);
                      }}
                    >
                      {item.name}
                    </button>
                    <ul>
                      {item.connections.map((edge) => (
                        <li key={edge.id}>
                          <button
                            style={button}
                            onClick={() => {
                              props.onSelect([edge.id]);
                              props.onFocus([edge.id]);
                            }}
                          >
                            Connection to {edge.targetName}
                          </button>
                          {edge.targetId && (
                            <button
                              style={button}
                              onClick={() => props.onFocus([edge.targetId!])}
                            >
                              Go to target
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
        {tab === "Objects" && (
          <>
            <p>
              {object
                ? `Selected: ${object.displayName || object.type}`
                : "Select one object to edit its details."}
            </p>
            <label>
              Link type{" "}
              <select
                value={linkKind}
                onChange={(e) => setLinkKind(e.target.value as typeof linkKind)}
                style={field}
              >
                <option value="url">URL</option>
                <option value="object">Object ID</option>
                <option value="reference">Host reference</option>
              </select>
            </label>
            <input
              aria-label="Object link target"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              style={field}
            />
            <button
              style={button}
              disabled={!editable}
              onClick={() =>
                run(() =>
                  patch({
                    link: validateObjectLink({ kind: linkKind, target: link }),
                  }),
                )
              }
            >
              Set link
            </button>
            <button
              style={button}
              disabled={!object?.link}
              onClick={() =>
                run(async () => {
                  const l = validateObjectLink(object!.link);
                  if (l.kind === "object") {
                    if (
                      !elements.some(
                        (el) =>
                          el.id === l.target && !el.isDeleted && !el.hidden,
                      )
                    )
                      throw new Error("Linked object is missing or hidden");
                    props.onFocus([l.target]);
                  } else if (content?.navigate) await content.navigate(l);
                  else if (l.kind === "url")
                    window.open(l.target, "_blank", "noopener,noreferrer");
                  else throw new Error("Host navigation is not connected");
                })
              }
            >
              Open link
            </button>
            <button
              style={button}
              disabled={!editable || !object?.link}
              onClick={() => run(() => patch({ link: undefined }))}
            >
              Remove link
            </button>
            {object?.type === "image" && (
              <fieldset disabled={!editable}>
                <legend>Crop and mask</legend>
                {(["x", "y", "width", "height"] as const).map((key) => (
                  <label key={key}>
                    {key}{" "}
                    <input
                      aria-label={"Crop " + key}
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={crop[key]}
                      onChange={(e) =>
                        setCrop({ ...crop, [key]: Number(e.target.value) })
                      }
                      style={{ ...field, width: 90 }}
                    />
                  </label>
                ))}
                <select
                  aria-label="Image mask"
                  value={mask}
                  onChange={(e) => setMask(e.target.value as typeof mask)}
                  style={field}
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="ellipse">Ellipse</option>
                </select>
                <button
                  style={button}
                  onClick={() =>
                    run(() => patch(setImageCrop(object, crop, mask)))
                  }
                >
                  Apply crop
                </button>
                <button
                  style={button}
                  onClick={() =>
                    run(() => patch({ crop: undefined, mask: "rectangle" }))
                  }
                >
                  Reset crop
                </button>
              </fieldset>
            )}
            <details>
              <summary>Connection ports</summary>
              <input
                aria-label="Port name"
                value={portName}
                onChange={(e) => setPortName(e.target.value)}
                style={field}
              />
              <select
                aria-label="Port side"
                value={portSide}
                onChange={(e) => setPortSide(e.target.value)}
                style={field}
              >
                {["left", "right", "top", "bottom"].map((side) => (
                  <option key={side}>{side}</option>
                ))}
              </select>
              <select
                aria-label="Accepted connector types"
                value={portType}
                onChange={(e) => setPortType(e.target.value as typeof portType)}
                style={field}
              >
                <option value="both">Line and arrow</option>
                <option value="line">Line</option>
                <option value="arrow">Arrow</option>
              </select>
              <button
                style={button}
                disabled={
                  !editable ||
                  !portName.trim() ||
                  !object ||
                  ![
                    "rectangle",
                    "ellipse",
                    "diamond",
                    "triangle",
                    "star",
                    "callout",
                    "sticky-note",
                  ].includes(object.type)
                }
                onClick={() =>
                  run(() => {
                    const ports = [
                      ...(object!.ports ?? []),
                      {
                        id: generateId(),
                        name: portName,
                        point:
                          portSide === "left"
                            ? { x: 0, y: 0.5 }
                            : portSide === "right"
                              ? { x: 1, y: 0.5 }
                              : portSide === "top"
                                ? { x: 0.5, y: 0 }
                                : { x: 0.5, y: 1 },
                        accepts:
                          portType === "both"
                            ? (["line", "arrow"] as ("line" | "arrow")[])
                            : [portType],
                      },
                    ];
                    validateElementMetadata({ ports });
                    patch({ ports });
                    setPortName("");
                  })
                }
              >
                Add port
              </button>
              {object?.ports?.map((p) => (
                <div key={p.id}>
                  <input
                    aria-label={"Rename port " + p.name}
                    defaultValue={p.name}
                    disabled={!editable}
                    onBlur={(e) => {
                      const ports = object.ports!.map((port) =>
                        port.id === p.id
                          ? { ...port, name: e.target.value }
                          : port,
                      );
                      run(() => {
                        validateElementMetadata({ ports });
                        patch({ ports });
                      });
                    }}
                  />
                  <button
                    style={button}
                    disabled={!editable}
                    onClick={() =>
                      run(() =>
                        patch({
                          ports: object.ports!.filter(
                            (port) => port.id !== p.id,
                          ),
                        }),
                      )
                    }
                  >
                    Delete port
                  </button>
                </div>
              ))}
              {(object?.type === "line" || object?.type === "arrow") && (
                <>
                  <select
                    aria-label="Connector endpoint"
                    value={endpoint}
                    onChange={(e) =>
                      setEndpoint(e.target.value as typeof endpoint)
                    }
                  >
                    <option value="start">Start</option>
                    <option value="end">End</option>
                  </select>
                  {elements
                    .filter((el) => !el.isDeleted && !el.hidden)
                    .map((el) =>
                      (el.ports ?? []).map((port) => (
                        <button
                          key={el.id + port.id}
                          style={button}
                          disabled={
                            !editable || !port.accepts.includes(object.type)
                          }
                          onClick={() =>
                            run(() =>
                              commit(
                                bindConnectionPort(
                                  elements,
                                  object.id,
                                  endpoint,
                                  el.id,
                                  port.id,
                                ),
                              ),
                            )
                          }
                        >
                          Connect to {el.displayName || el.type}: {port.name}
                        </button>
                      )),
                    )}
                </>
              )}
            </details>
            <details>
              <summary>Linked content and media</summary>
              <input
                aria-label="Document reference"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                style={field}
              />
              <button
                style={button}
                disabled={readOnly || !content?.resolveDocument || !documentId}
                onClick={() =>
                  run(async (signal) => {
                    const result = await content!.resolveDocument!(
                      {
                        documentId,
                        revision: "",
                        title: "Document",
                        fallback: "",
                      },
                      signal,
                    );
                    if (!result)
                      throw new Error(
                        "Document is unavailable or permission was denied",
                      );
                    if (signal.aborted) return;
                    commit([
                      ...latest.current.elements,
                      createDocumentCard(result, origin),
                    ]);
                  })
                }
              >
                Insert document card
              </button>
              {object?.documentCard && (
                <>
                  <p>
                    {object.documentCard.stale
                      ? "Excerpt is stale."
                      : "Saved excerpt revision: " +
                        object.documentCard.revision}
                  </p>
                  <button
                    style={button}
                    disabled={!editable || !content?.resolveDocument}
                    onClick={() =>
                      run(async (signal) => {
                        const result = await content!.resolveDocument!(
                          object.documentCard!,
                          signal,
                        );
                        if (
                          signal.aborted ||
                          latest.current.readOnly
                        )
                          return;
                        props.onDocumentAccess?.(object.documentCard!.documentId,!!result);
                        if(result)validateElementMetadata({documentCard:result});
                        const current = latest.current.elements.find(
                          (el) => el.id === object.id,
                        );
                        if (!current || current.isDeleted || current.locked)
                          return;
                        commit(
                          latest.current.elements.map((el) =>
                            el.id === object.id
                              ? {
                                  ...el,
                                  documentCard: result ?? {
                                    ...object.documentCard!,
                                    fallback: "",
                                    title: "Document unavailable",
                                    stale: true,
                                  },
                                  ...("text" in el
                                    ? {
                                        text: result
                                          ? result.title +
                                            "\n" +
                                            result.fallback
                                          : "Document unavailable",
                                      }
                                    : {}),
                                }
                              : el,
                          ),
                        );
                      })
                    }
                  >
                    Refresh document
                  </button>
                </>
              )}
              <input
                aria-label="Calculation expression"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                style={field}
              />
              <button
                style={button}
                disabled={readOnly || !content?.openCalculation || !formula}
                onClick={() =>
                  run(async (signal) => {
                    const result = await content!.openCalculation!(
                      {
                        version: 1,
                        expression: formula,
                        variables: {},
                        result: "Not calculated",
                      },
                      signal,
                    );
                    if (result && !signal.aborted)
                      commit([
                        ...latest.current.elements,
                        createCalculationCard(result, origin),
                      ]);
                  })
                }
              >
                Insert calculation
              </button>
              {object?.calculation && (
                <button
                  style={button}
                  disabled={
                    !editable ||
                    !content?.openCalculation ||
                    object.calculation.version !== 1
                  }
                  onClick={() =>
                    run(async (signal) => {
                      const result = await content!.openCalculation!(
                        object.calculation!,
                        signal,
                      );
                      if (!result || signal.aborted) return;
                      validateElementMetadata({ calculation: result });
                      const current = latest.current.elements.find(
                        (el) => el.id === object.id,
                      );
                      if (!current || current.isDeleted || current.locked)
                        return;
                      commit(
                        latest.current.elements.map((el) =>
                          el.id === object.id
                            ? {
                                ...el,
                                calculation: result,
                                ...("text" in el
                                  ? {
                                      text:
                                        result.expression +
                                        "\n= " +
                                        result.result,
                                    }
                                  : {}),
                              }
                            : el,
                        ),
                      );
                    })
                  }
                >
                  Reopen calculation
                </button>
              )}
              <button
                style={button}
                disabled={readOnly || !content?.pickMedia}
                onClick={() =>
                  run(async (signal) => {
                    const asset = await content!.pickMedia!(
                      signal,
                    );
                    if (!asset || signal.aborted) return;
                    const image = deserializeBoard({
                      elements: [
                        {
                          ...createCalculationCard(
                            {
                              version: 1,
                              expression: "",
                              variables: {},
                              result: "",
                            },
                            origin,
                          ),
                          type: "image",
                          calculation: undefined,
                          assetId: asset.id,
                          dataUrl: asset.dataUrl,
                          width: Math.min(600, asset.width),
                          height:
                            (Math.min(600, asset.width) * asset.height) /
                            asset.width,
                        },
                      ],
                    }).elements[0];
                    commit([...latest.current.elements, image]);
                  })
                }
              >
                Choose existing media
              </button>
              <p>
                Document access, calculations, and media are supplied by your
                host application.
              </p>
            </details>
          </>
        )}
        {tab === "Styles" && (
          <>
            <button
              style={button}
              disabled={!object || !title.trim() || readOnly}
              onClick={() =>
                run(() =>
                  save({
                    ...state,
                    presets: [
                      ...state.presets,
                      createStylePreset(object!, title),
                    ],
                  }),
                )
              }
            >
              Save selected style
            </button>
            {state.presets.map((p) => (
              <div key={p.id}>
                <button
                  style={button}
                  disabled={readOnly || !selected.size}
                  onClick={() =>
                    run(() => {
                      const result = applyStylePreset(elements, selected, p);
                      commit(result.elements);
                      setMessage(
                        result.skipped.length
                          ? "Skipped incompatible fields: " +
                              result.skipped.join(", ")
                          : "Style applied.",
                      );
                    })
                  }
                >
                  {p.name}
                </button>
                <button
                  style={button}
                  onClick={() =>
                    change(
                      "presets",
                      state.presets.filter((x) => x.id !== p.id),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </>
        )}
        {tab === "Versions" && (
          <>
            <label>
              Revision name{" "}
              <input
                aria-label="Revision name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <button
              style={button}
              disabled={readOnly || !versions?.save || !title.trim() || busy}
              onClick={() =>
                run(async (signal) => {
                  await versions!.save!(title, elements, signal);
                  if (signal.aborted) return;
                  const revisions = await versions!.list(signal);
                  if (signal.aborted) return;
                  setRevisions(revisions);
                  setTitle("");
                })
              }
            >
              Save revision
            </button>
            {!versions ? (
              <p>
                Connect a version storage adapter to browse and restore
                revisions.
              </p>
            ) : (
              <>
                <button
                  style={button}
                  onClick={() =>
                    run(async (signal) => {
                      const revisions = await versions.list(signal);
                      if (!signal.aborted) setRevisions(revisions);
                    })
                  }
                >
                  Load revisions
                </button>
                {revisions.map((r) => (
                  <div key={r.id}>
                    <button
                      style={button}
                      onClick={() =>
                        run(async (signal) => {
                          const token = versions.currentRevision(),
                            result = deserializeBoard({
                              elements: await versions.load(
                                r.id,
                                signal,
                              ),
                            }).elements;
                          if (signal.aborted) return;
                          showPreview(result, "replace");
                          setRevision(r.id);
                          setExpected(token);
                          const diff = compareBoardVersions(elements, result);
                          setMessage(
                            `${diff.added.length} added, ${diff.changed.length} changed, ${diff.removed.length} removed.`,
                          );
                        })
                      }
                    >
                      {r.name} · {r.createdAt}
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </fieldset>
      {preview && (
        <div role="region" aria-label="Workspace preview">
          <p>
            {preview.filter((el) => !el.isDeleted).length} objects. Review
            before applying.
          </p>
          <div style={{ height: 220 }}>
            <NoteboardPreview elements={preview} height="100%" />
          </div>
        </div>
      )}
    </WorkspaceDialog>
  );
}
