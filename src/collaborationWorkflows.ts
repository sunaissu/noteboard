import { rotatePoint } from './elements/bounds';
import type { Point, NoteboardElement } from "./elements/types";
import type { NoteboardViewport } from "./session";

export interface BoardPeer {
  sessionId: string;
  userId: string;
  name: string;
  color: string;
  updatedAt: number;
  cursor?: Point;
  selection: string[];
  editingId?: string;
  viewport?: NoteboardViewport;
  presenting?: boolean;
  laser?: { point: Point; at: number }[];
}
export interface BoardAwarenessAdapter {
  self: { sessionId: string; userId: string; name: string; color: string };
  getPeers(): BoardPeer[];
  subscribe(listener: () => void): () => void;
  publish(peer: BoardPeer | null): void;
}
export interface BoardComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
}
export interface BoardCommentThread {
  id: string;
  elementId?: string;
  point: Point;
  fallbackPoint?: Point;
  resolved: boolean;
  messages: BoardComment[];
}
export type CommentAction =
  | {
      type: "create";
      elementId?: string;
      point: Point;
      fallbackPoint?: Point;
      text: string;
    }
  | { type: "reply"; threadId: string; text: string }
  | { type: "resolve"; threadId: string; resolved: boolean };
export interface BoardCommentsAdapter {
  getThreads(): BoardCommentThread[];
  subscribe(listener: () => void): () => void;
  canComment: boolean;
  canResolve: boolean;
  dispatch(action: CommentAction): Promise<void>;
}
export interface BoardRevision {
  id: string;
  name: string;
  createdAt: string;
}
export interface BoardVersionsAdapter {
  save?(
    name: string,
    elements: NoteboardElement[],
    signal: AbortSignal,
  ): Promise<void>;
  list(signal: AbortSignal): Promise<BoardRevision[]>;
  load(id: string, signal: AbortSignal): Promise<NoteboardElement[]>;
  currentRevision(): string;
  restore(
    id: string,
    expectedRevision: string,
    signal: AbortSignal,
  ): Promise<NoteboardElement[]>;
}
export interface WorkshopTimer {
  durationMs: number;
  startedAt: number | null;
  elapsedMs: number;
  prompt?: string;
}
export interface BoardWorkshopSnapshot {
  revision: number;
  serverNow: number;
  timer: WorkshopTimer;
  voting: {
    id: string;
    limit: number;
    open: boolean;
    revealed: boolean;
    myVotes: Record<string, number>;
    totals?: Record<string, number>;
  };
}
export type WorkshopAction =
  | { type: "vote"; objectId: string; delta: 1 | -1; requestId: string }
  | { type: "voting"; open: boolean; reveal: boolean }
  | {
      type: "timer";
      operation: "start" | "pause" | "reset";
      durationMs?: number;
      prompt?: string;
    };
export interface BoardWorkshopAdapter {
  canControl: boolean;
  getSnapshot(): BoardWorkshopSnapshot;
  subscribe(listener: () => void): () => void;
  dispatch(action: WorkshopAction, expectedRevision: number): Promise<void>;
}
export function timerRemaining(
  timer: WorkshopTimer,
  serverNow: number,
): number {
  return Math.max(
    0,
    timer.durationMs -
      timer.elapsedMs -
      (timer.startedAt === null ? 0 : Math.max(0, serverNow - timer.startedAt)),
  );
}
export function commentAnchor(
  thread: BoardCommentThread,
  elements: NoteboardElement[],
) {
  const target = thread.elementId
    ? elements.find((el) => el.id === thread.elementId && !el.isDeleted)
    : undefined;
  return {
    point: target
      ? rotatePoint(target.x+thread.point.x*target.width,target.y+thread.point.y*target.height,target.x+target.width/2,target.y+target.height/2,target.angle)
      : (thread.fallbackPoint ?? thread.point),
    orphan: !!thread.elementId && !target,
  };
}

/** Local host implementation for examples/tests. Authenticate users before exposing an adapter. */
export function createLocalBoardRoom(now: () => number = Date.now) {
  const peers = new Map<string, BoardPeer>(),
    threads: BoardCommentThread[] = [],
    listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn()),
    subscribe = (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    };
  let revision = 0,
    timer: WorkshopTimer = {
      durationMs: 300000,
      startedAt: null,
      elapsedMs: 0,
    },
    voting = { id: "vote-1", limit: 3, open: true, revealed: false };
  const votes = new Map<string, Map<string, number>>(),
    requests = new Set<string>();
  let targets = new Set<string>();
  const snapshot = (userId: string): BoardWorkshopSnapshot => {
    const mine = [...(votes.get(userId) ?? new Map<string, number>())]
        .filter(([id]) => targets.has(id))
        .reduce<Record<string, number>>((result, [id, count]) => {
          result[id] = count;
          return result;
        }, {}),
      totals: Record<string, number> = {};
    if (voting.revealed)
      for (const ballot of votes.values())
        for (const [id, count] of ballot)
          if (targets.has(id)) totals[id] = (totals[id] ?? 0) + count;
    return {
      revision,
      serverNow: now(),
      timer: { ...timer },
      voting: {
        ...voting,
        myVotes: mine,
        ...(voting.revealed ? { totals } : {}),
      },
    };
  };
  return {
    syncElements(elements: NoteboardElement[]) {
      targets = new Set(
        elements
          .filter((el) => el.type === "sticky-note" && !el.isDeleted)
          .map((el) => el.id),
      );
      for (const thread of threads) {
        const anchor = commentAnchor(thread, elements);
        if (!anchor.orphan) thread.fallbackPoint = anchor.point;
      }
      revision++;
      emit();
    },
    setVoteTargets(ids: string[]) {
      targets = new Set(ids);
      revision++;
      emit();
    },
    connect(identity: BoardAwarenessAdapter["self"], canControl = false) {
      let connected = true;
      const requireConnection = () => {
        if (!connected) throw new Error("Session disconnected");
      };
      const awareness: BoardAwarenessAdapter = {
        self: identity,
        getPeers: () =>
          [...peers.values()].filter(
            (p) =>
              p.sessionId !== identity.sessionId && now() - p.updatedAt < 15000,
          ),
        subscribe,
        publish: (peer) => {
          requireConnection();
          if (!peer) peers.delete(identity.sessionId);
          else
            peers.set(identity.sessionId, {
              ...peer,
              ...identity,
              updatedAt: now(),
              selection: peer.selection.slice(0, 1000),
              laser: peer.laser?.slice(-60),
            });
          emit();
        },
      };
      const comments: BoardCommentsAdapter = {
        canComment: true,
        canResolve: canControl,
        getThreads: () => structuredClone(threads),
        subscribe,
        dispatch: async (action) => {
          requireConnection();
          if (action.type === "resolve") {
            if (!canControl)
              throw new Error("Only the moderator can resolve comments");
            const thread = threads.find((t) => t.id === action.threadId);
            if (!thread) throw new Error("Comment thread was removed");
            thread.resolved = action.resolved;
          } else {
            if (!action.text.trim() || action.text.length > 4000)
              throw new Error("Comments must contain 1 to 4000 characters");
            const message = {
              id: crypto.randomUUID(),
              authorId: identity.userId,
              authorName: identity.name,
              text: action.text,
              createdAt: now(),
            };
            if (action.type === "create") {
              if (threads.length >= 1000)
                throw new Error("Comment limit reached");
              threads.push({
                id: crypto.randomUUID(),
                elementId: action.elementId,
                point: { ...action.point },
                fallbackPoint: action.fallbackPoint,
                resolved: false,
                messages: [message],
              });
            } else {
              const thread = threads.find((t) => t.id === action.threadId);
              if (!thread) throw new Error("Comment thread was removed");
              if (thread.messages.length >= 200)
                throw new Error("Thread limit reached");
              thread.messages.push(message);
            }
          }
          emit();
        },
      };
      const workshop: BoardWorkshopAdapter = {
        canControl,
        getSnapshot: () => snapshot(identity.userId),
        subscribe,
        dispatch: async (action, expected) => {
          requireConnection();
          if (
            action.type === "vote" &&
            requests.has(identity.userId + ":" + action.requestId)
          )
            return;
          if (expected !== revision)
            throw new Error(
              "Workshop changed. Review the latest state and retry.",
            );
          if (action.type === "vote") {
            if (
              !voting.open ||
              voting.revealed ||
              !targets.has(action.objectId)
            )
              throw new Error("Voting is closed or the note was removed");
            const ballot =
              votes.get(identity.userId) ?? new Map<string, number>();
            const count = ballot.get(action.objectId) ?? 0;
            const used = [...ballot]
              .filter(([id]) => targets.has(id))
              .reduce((sum, [, n]) => sum + n, 0);
            if (
              (action.delta !== 1 && action.delta !== -1) ||
              count + action.delta < 0 ||
              (action.delta > 0 && used >= voting.limit)
            )
              throw new Error("Vote limit reached");
            if (
              !action.requestId ||
              action.requestId.length > 256 ||
              requests.size >= 100000
            )
              throw new Error("Invalid vote request");
            ballot.set(action.objectId, count + action.delta);
            votes.set(identity.userId, ballot);
            requests.add(identity.userId + ":" + action.requestId);
          } else {
            if (!canControl)
              throw new Error("Only the moderator can control the workshop");
            if (action.type === "voting")
              voting = {
                ...voting,
                open: action.open,
                revealed: action.reveal,
              };
            else {
              const current = now();
              if (action.operation === "reset") {
                const duration = action.durationMs ?? timer.durationMs;
                if (
                  !Number.isFinite(duration) ||
                  duration < 1000 ||
                  duration > 86400000
                )
                  throw new Error(
                    "Timer must be between 1 second and 24 hours",
                  );
                timer = {
                  durationMs: duration,
                  elapsedMs: 0,
                  startedAt: null,
                  prompt: action.prompt?.slice(0, 256),
                };
              } else if (
                action.operation === "pause" &&
                timer.startedAt !== null
              )
                timer = {
                  ...timer,
                  elapsedMs: Math.min(
                    timer.durationMs,
                    timer.elapsedMs + Math.max(0, current - timer.startedAt),
                  ),
                  startedAt: null,
                };
              else if (action.operation === "start" && timer.startedAt === null)
                timer = { ...timer, startedAt: current };
            }
          }
          revision++;
          emit();
        },
      };
      return {
        awareness,
        comments,
        workshop,
        disconnect() {
          connected = false;
          peers.delete(identity.sessionId);
          emit();
        },
      };
    },
  };
}
