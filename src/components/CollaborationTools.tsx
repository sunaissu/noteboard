import { useEffect, useRef, useState } from "react";
import type { NoteboardElement, Point } from "../elements/types";
import type { NoteboardViewport } from "../session";
import type {
  BoardAwarenessAdapter,
  BoardCommentsAdapter,
  BoardWorkshopAdapter,
  WorkshopAction,
} from "../collaborationWorkflows";
import { timerRemaining, commentAnchor } from "../collaborationWorkflows";
import { WorkspaceDialog } from "./WorkspaceDialog";
import { getElementBounds } from "../elements/bounds";
import { useNoteboardTheme } from "../ThemeContext";

interface Props {
  awareness?: BoardAwarenessAdapter;
  comments?: BoardCommentsAdapter;
  workshop?: BoardWorkshopAdapter;
  elements: NoteboardElement[];
  selected: Set<string>;
  editingId?: string | null;
  viewport: NoteboardViewport;
  /** Available board rectangle after reserving space for floating controls. */
  viewportInsets?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
  onTimerSizeChange?: (size: { width: number; height: number }) => void;
  onViewport: (v: NoteboardViewport) => void;
  container: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  onClose: () => void;
}
const button = { minHeight: 44, padding: 8, margin: 3 };
export function CollaborationTools(props: Props) {
  const theme = useNoteboardTheme();
  const timerRef = useRef<HTMLDivElement>(null);
  const { awareness, comments, workshop, viewport, elements, selected } = props;
  const [, refresh] = useState(0),
    [now, setNow] = useState(Date.now()),
    [laser, setLaser] = useState(false),
    [presenting, setPresenting] = useState(false),
    [following, setFollowing] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [text, setText] = useState(""),
    [threadId, setThreadId] = useState(""),
    [minutes, setMinutes] = useState(5),
    [prompt, setPrompt] = useState("Time to share");
  const latest = useRef(props);
  latest.current = props;
  const state = useRef({
    cursor: undefined as Point | undefined,
    laser: [] as { point: Point; at: number }[],
    dirty: true,
    last: 0,
  });
  const mode = useRef({ laser, presenting });
  mode.current = { laser, presenting };
  const lastApplied = useRef("");
  const received = useRef({
    at: performance.now(),
    server: workshop?.getSnapshot().serverNow ?? Date.now(),
  });
  useEffect(() => {
    const stops = [
      awareness?.subscribe(() => refresh((x) => x + 1)),
      comments?.subscribe(() => refresh((x) => x + 1)),
      workshop?.subscribe(() => {
        received.current = {
          at: performance.now(),
          server: workshop.getSnapshot().serverNow,
        };
        refresh((x) => x + 1);
      }),
    ];
    return () => stops.forEach((stop) => stop?.());
  }, [awareness, comments, workshop]);
  useEffect(() => {
    if (!awareness && !workshop && !laser && !props.open) return;
    const timer = setInterval(() => setNow(Date.now()), laser ? 100 : 1000);
    return () => clearInterval(timer);
  }, [awareness, workshop, laser, props.open]);
  useEffect(() => {
    const node = props.container.current;
    const move = (event: PointerEvent) => {
      if (
        (event.target as Element).closest(
          'button,input,textarea,select,[role="dialog"]',
        )
      )
        return;
      const box = node!.getBoundingClientRect(),
        v = latest.current.viewport;
      const point = {
        x: (event.clientX - box.left - v.panX) / v.zoom,
        y: (event.clientY - box.top - v.panY) / v.zoom,
      };
      state.current.cursor = point;
      state.current.dirty = true;
      if (mode.current.laser)
        state.current.laser = [
          ...state.current.laser.slice(-59),
          { point, at: Date.now() },
        ];
    };
    const leave = () => {
      state.current.cursor = undefined;
      state.current.dirty = true;
    };
    const pointerDown = (event: PointerEvent) => {
      if (
        mode.current.laser &&
        (event.target as Element).tagName === "CANVAS"
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    node?.addEventListener("pointerdown", pointerDown, true);
    node?.addEventListener("pointermove", move);
    node?.addEventListener("pointerleave", leave);
    const timer = setInterval(() => {
      const time = Date.now();
      if (!state.current.dirty && time - state.current.last < 4000) return;
      const p = latest.current;
      try {
        if (awareness)
          awareness.publish({
            ...awareness.self,
            updatedAt: time,
            cursor: state.current.cursor,
            selection: [...p.selected],
            editingId: p.editingId ?? undefined,
            presenting: mode.current.presenting,
            viewport: mode.current.presenting ? p.viewport : undefined,
            laser: state.current.laser.filter(
              (sample) => time - sample.at < 1500,
            ),
          });
        state.current.dirty = false;
        state.current.last = time;
      } catch (err) {
        setError(String(err));
      }
    }, 80);
    return () => {
      clearInterval(timer);
      node?.removeEventListener("pointerdown", pointerDown, true);
      node?.removeEventListener("pointermove", move);
      node?.removeEventListener("pointerleave", leave);
      try {
        awareness?.publish(null);
      } catch {
        /* Disconnected adapters may already have removed local presence. */
      }
    };
  }, [awareness, props.container]);
  useEffect(() => {
    state.current.dirty = true;
  }, [selected, props.editingId, viewport, presenting, laser]);
  const peers = (awareness?.getPeers() ?? [])
    .filter(
      (p) =>
        p.sessionId !== awareness?.self.sessionId && now - p.updatedAt < 15000,
    )
    .slice(0, 100);
  const peerSignature = JSON.stringify(
    peers.map((p) => [p.sessionId, p.presenting, p.viewport]),
  );
  useEffect(() => {
    if (!following) return;
    const peer = peers.find((p) => p.sessionId === following);
    if (!peer?.presenting || !peer.viewport) {
      setFollowing("");
      return;
    }
    lastApplied.current = JSON.stringify(peer.viewport);
    props.onViewport(peer.viewport);
  }, [following, peerSignature]);
  useEffect(() => {
    if (
      following &&
      lastApplied.current &&
      JSON.stringify(viewport) !== lastApplied.current
    )
      setFollowing("");
  }, [viewport]);
  const threads = comments?.getThreads() ?? [],
    work = workshop?.getSnapshot();
  const remaining = work
    ? timerRemaining(
        work.timer,
        received.current.server + performance.now() - received.current.at,
      )
    : 0;
  const timerVisible = !!work && work.timer.startedAt !== null;
  useEffect(() => {
    const timer = timerRef.current;
    if (!timerVisible || !timer) {
      latest.current.onTimerSizeChange?.({ width: 0, height: 0 });
      return;
    }
    let previous = { width: -1, height: -1 };
    const measure = () => {
      const next = { width: timer.offsetWidth, height: timer.offsetHeight };
      if (next.width === previous.width && next.height === previous.height) return;
      previous = next;
      latest.current.onTimerSizeChange?.(next);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(timer);
    return () => {
      observer?.disconnect();
      latest.current.onTimerSizeChange?.({ width: 0, height: 0 });
    };
  }, [timerVisible]);
  const collision = peers.filter(
    (p) => p.editingId && p.editingId === props.editingId,
  );
  const run = async (action: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const dispatch = (action: WorkshopAction) =>
    run(() => workshop!.dispatch(action, workshop!.getSnapshot().revision));
  const screen = (point: Point) => ({
    x: point.x * viewport.zoom + viewport.panX,
    y: point.y * viewport.zoom + viewport.panY,
  });
  const trails = [
    ...peers.map((p) => ({ color: p.color, trail: p.laser ?? [] })),
    { color: awareness?.self.color ?? "#e11d48", trail: state.current.laser },
  ];
  return (
    <>
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 20,
        }}
      >
        {peers.map((peer) =>
          peer.selection.slice(0, 100).map((id) => {
            const el = elements.find(
              (el) => el.id === id && !el.isDeleted && !el.hidden,
            );
            if (!el) return null;
            const [l, t, r, b] = getElementBounds(el),
              p = screen({ x: l, y: t });
            return (
              <rect
                key={peer.sessionId + id}
                x={p.x - 3}
                y={p.y - 3}
                width={(r - l) * viewport.zoom + 6}
                height={(b - t) * viewport.zoom + 6}
                fill="none"
                stroke={peer.color}
                strokeDasharray="5 3"
              />
            );
          }),
        )}
        {peers
          .filter((p) => p.cursor)
          .map((peer) => {
            const point = screen(peer.cursor!);
            return (
              <g
                key={peer.sessionId}
                transform={`translate(${point.x},${point.y})`}
              >
                <path d="M0 0 L0 18 L5 13 L12 13 Z" fill={peer.color} />
                <text x="14" y="16" fontSize="12" fill={peer.color}>
                  {peer.name}
                </text>
              </g>
            );
          })}
        {trails.map((trail, i) => (
          <polyline
            key={i}
            points={trail.trail
              .filter((s) => now - s.at < 1500)
              .slice(-60)
              .map((s) => {
                const p = screen(s.point);
                return `${p.x},${p.y}`;
              })
              .join(" ")}
            fill="none"
            stroke={trail.color}
            strokeWidth="4"
            strokeLinecap="round"
          />
        ))}
        {threads
          .filter((t) => !t.resolved)
          .slice(0, 500)
          .map((thread, i) => {
            const anchor = commentAnchor(thread, elements),
              point = screen(anchor.point);
            return (
              <g key={thread.id} transform={`translate(${point.x},${point.y})`}>
                <circle r="12" fill={anchor.orphan ? "#64748b" : "#7c3aed"} />
                <text y="4" textAnchor="middle" fill="white" fontSize="12">
                  {i + 1}
                </text>
              </g>
            );
          })}
      </svg>
      {collision.length > 0 && (
        <div
          role="status"
          style={{
            position: "absolute",
            top: 8,
            left: 12,
            right: 12,
            maxHeight: "40%",
            overflow: "auto",
            overflowWrap: "anywhere",
            zIndex: 25,
            background: theme.panelBg,
            color: theme.panelTextColor,
            border: theme.panelBorder,
            padding: 8,
          }}
        >
          {collision.map((p) => p.name).join(", ")} also editing this object.
          Your edits remain available.
        </div>
      )}
      {work && work.timer.startedAt !== null && (
        <div style={{
          position: 'absolute',
          top: Math.max(0, props.viewportInsets?.top ?? 12),
          right: Math.max(0, props.viewportInsets?.right ?? 12),
          bottom: Math.max(0, props.viewportInsets?.bottom ?? 12),
          left: Math.max(0, props.viewportInsets?.left ?? 12),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          minWidth: 0,
          minHeight: 0,
          pointerEvents: 'none',
          zIndex: 960,
        }}>
        <div
          ref={timerRef}
          role="timer"
          aria-label="Workshop time remaining"
          tabIndex={0}
          style={{
            width: 'max-content',
            minWidth: 44,
            minHeight: 44,
            flex: '0 1 auto',
            background: theme.panelBg,
            color: theme.panelTextColor,
            border: theme.panelBorder,
            maxWidth: 'min(160px, max(44px, 40%))',
            maxHeight: 'min(100%, 160px)',
            overflow: "auto",
            overscrollBehavior: 'contain',
            pointerEvents: 'auto',
            overflowWrap: "anywhere",
            boxSizing: "border-box",
            padding: 8,
          }}
        >
          {Math.ceil(remaining / 1000)}s
          {remaining === 0 && (
            <span role="status"> {work.timer.prompt || "Time is up"}</span>
          )}
        </div>
        </div>
      )}
      {props.open && (
        <WorkspaceDialog
          title="Collaboration and workshop"
          onClose={props.onClose}
        >
          {error && <p role="alert">{error}</p>}
          {!awareness && !comments && !workshop && (
            <p>
              Connect the host awareness, comments, or workshop adapters to use
              these tools.
            </p>
          )}
          <label>
            <input
              type="checkbox"
              checked={laser}
              onChange={(e) => setLaser(e.target.checked)}
            />
            Laser pointer trail
          </label>
          {awareness && (
            <>
              <p>{peers.length} other sessions connected.</p>
              <label>
                <input
                  type="checkbox"
                  checked={presenting}
                  onChange={(e) => setPresenting(e.target.checked)}
                />
                Share my camera
              </label>
              <button
                style={button}
                disabled={!following}
                onClick={() => setFollowing("")}
              >
                Stop following
              </button>
              {peers.map((peer) => (
                <div key={peer.sessionId}>
                  {peer.name}
                  <button
                    style={button}
                    disabled={!peer.presenting}
                    onClick={() => setFollowing(peer.sessionId)}
                  >
                    Follow {peer.name}
                  </button>
                </div>
              ))}
              <p>
                Moving your camera stops following. Reconnecting never starts
                following automatically.
              </p>
            </>
          )}
          {comments && (
            <section>
              <h3>Comments</h3>
              <label>
                Thread{" "}
                <select
                  aria-label="Comment thread"
                  value={threadId}
                  onChange={(e) => setThreadId(e.target.value)}
                >
                  <option value="">
                    New thread at selection or camera center
                  </option>
                  {threads.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.messages[0]?.text.slice(0, 50)}
                      {t.resolved ? " (resolved)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                aria-label="Comment message"
                maxLength={4000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              <button
                style={button}
                disabled={busy || !comments.canComment || !text.trim()}
                onClick={() =>
                  run(async () => {
                    const target = elements.find(
                      (el) => selected.has(el.id) && !el.isDeleted,
                    );
                    await comments.dispatch(
                      threadId
                        ? { type: "reply", threadId, text }
                        : {
                            type: "create",
                            elementId: target?.id,
                            fallbackPoint: target
                              ? { x: target.x + target.width, y: target.y }
                              : undefined,
                            point: target
                              ? { x: 1, y: 0 }
                              : {
                                  x: -viewport.panX / viewport.zoom + 100,
                                  y: -viewport.panY / viewport.zoom + 100,
                                },
                            text,
                          },
                    );
                    setText("");
                  })
                }
              >
                Post comment
              </button>
              {threads.map((thread) => (
                <article key={thread.id}>
                  <strong>
                    {thread.resolved ? "Resolved" : "Open"}
                    {commentAnchor(thread, elements).orphan
                      ? " · original object removed"
                      : ""}
                  </strong>
                  {thread.messages.map((m) => (
                    <p key={m.id}>
                      <b>{m.authorName}:</b> {m.text}
                    </p>
                  ))}
                  <button
                    style={button}
                    disabled={busy || !comments.canResolve}
                    onClick={() =>
                      run(() =>
                        comments.dispatch({
                          type: "resolve",
                          threadId: thread.id,
                          resolved: !thread.resolved,
                        }),
                      )
                    }
                  >
                    {thread.resolved ? "Reopen" : "Resolve"}
                  </button>
                </article>
              ))}
            </section>
          )}
          {workshop && work && (
            <section>
              <h3>Voting and timer</h3>
              <p>
                {Object.values(work.voting.myVotes).reduce((s, n) => s + n, 0)}{" "}
                / {work.voting.limit} votes used.{" "}
                {work.voting.revealed
                  ? "Results revealed"
                  : work.voting.open
                    ? "Voting open"
                    : "Voting closed"}
              </p>
              {elements
                .filter(
                  (el) =>
                    el.type === "sticky-note" && !el.isDeleted && !el.hidden,
                )
                .map((el) => (
                  <div key={el.id}>
                    {"text" in el ? el.text : el.id}
                    <button
                      style={button}
                      disabled={
                        busy || !work.voting.open || work.voting.revealed
                      }
                      onClick={() =>
                        dispatch({
                          type: "vote",
                          objectId: el.id,
                          delta: 1,
                          requestId: crypto.randomUUID(),
                        })
                      }
                    >
                      Vote
                    </button>
                    <button
                      style={button}
                      disabled={
                        busy ||
                        !work.voting.myVotes[el.id] ||
                        !work.voting.open ||
                        work.voting.revealed
                      }
                      onClick={() =>
                        dispatch({
                          type: "vote",
                          objectId: el.id,
                          delta: -1,
                          requestId: crypto.randomUUID(),
                        })
                      }
                    >
                      Remove vote
                    </button>
                    <span>
                      {work.voting.revealed
                        ? (work.voting.totals?.[el.id] ?? 0)
                        : (work.voting.myVotes[el.id] ?? 0)}
                    </span>
                  </div>
                ))}
              <fieldset disabled={!workshop.canControl || busy}>
                <legend>Moderator controls</legend>
                <button
                  style={button}
                  onClick={() =>
                    dispatch({
                      type: "voting",
                      open: !work.voting.open,
                      reveal: false,
                    })
                  }
                >
                  {work.voting.open ? "Close voting" : "Open voting"}
                </button>
                <button
                  style={button}
                  onClick={() =>
                    dispatch({ type: "voting", open: false, reveal: true })
                  }
                >
                  Reveal votes
                </button>
                <label>
                  Minutes{" "}
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                  />
                </label>
                <label>
                  End prompt{" "}
                  <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    maxLength={256}
                  />
                </label>
                <button
                  style={button}
                  onClick={() =>
                    dispatch({
                      type: "timer",
                      operation: "reset",
                      durationMs: minutes * 60000,
                      prompt,
                    })
                  }
                >
                  Set timer
                </button>
                <button
                  style={button}
                  onClick={() =>
                    dispatch({
                      type: "timer",
                      operation:
                        work.timer.startedAt === null ? "start" : "pause",
                    })
                  }
                >
                  {work.timer.startedAt === null
                    ? "Start timer"
                    : "Pause timer"}
                </button>
              </fieldset>
              <p role="status">
                Remaining: {Math.ceil(remaining / 1000)} seconds
              </p>
            </section>
          )}
        </WorkspaceDialog>
      )}
    </>
  );
}
