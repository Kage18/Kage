// The signal that this is a live surface and not a report you refreshed.
//
// The daemon already streams `/kage/events`; nothing in the SPA had ever subscribed, so a claim
// made from the CLI or by another agent left every open board silently stale — which is exactly
// the moment two people claim the same item. This subscribes, shows the connection honestly
// (connected / reconnecting / unavailable, never a decorative green dot), and names the last
// decision that came through.
//
// It also broadcasts a DOM event so data-owning containers can refetch without this component
// knowing anything about them.

import React, { useEffect, useState } from "react";
import { desktop } from "../desktop";

export const WORK_CHANGED_EVENT = "kage:work-changed";

type Connection = "connecting" | "live" | "unavailable";

interface FeedEvent {
  type?: string;
  event?: { kind?: string; actor?: string; work_id?: string };
  ts?: string;
}

function describe(event: FeedEvent): string | null {
  const kind = event.event?.kind;
  const actor = event.event?.actor;
  if (!kind) return null;
  const verb = kind === "task.claimed" ? "claimed"
    : kind === "task.released" ? "released"
    : kind === "gate.approved" ? "approved a gate on"
    : kind === "gate.held" ? "held a gate on"
    : kind;
  return `${actor ?? "someone"} ${verb} work`;
}

export function LiveIndicator(): React.ReactElement {
  const [connection, setConnection] = useState<Connection>("connecting");
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    // EventSource is absent in the test environment (jsdom); the indicator degrades to
    // "unavailable" rather than throwing and taking the shell down with it.
    if (typeof EventSource === "undefined") {
      setConnection("unavailable");
      return;
    }
    // In the desktop app the signal arrives over IPC: main holds ONE connection to the daemon.
    // The renderer used to open this stream itself through the `kage://` scheme, and that leaked
    // one of Electron's ~6-per-host sockets on every reconnect until the pool was exhausted and
    // every request queued forever. A browser still gets real SSE — no custom scheme in the way.
    const bridge = desktop();
    if (bridge) {
      setConnection("live");
      return bridge.onChanged(() => {
        setLast("changed just now");
        window.dispatchEvent(new CustomEvent(WORK_CHANGED_EVENT));
      });
    }

    const source = new EventSource("/kage/events");
    source.onopen = () => setConnection("live");
    source.onerror = () => setConnection("unavailable");
    source.onmessage = (message: MessageEvent<string>) => {
      setConnection("live");
      let parsed: FeedEvent;
      try {
        parsed = JSON.parse(message.data) as FeedEvent;
      } catch {
        return;
      }
      if (parsed.type !== "work_changed") return;
      setLast(describe(parsed));
      window.dispatchEvent(new CustomEvent(WORK_CHANGED_EVENT));
    };
    return () => source.close();
  }, []);

  const label = connection === "live" ? "Live" : connection === "connecting" ? "Connecting…" : "Not live";
  return (
    <span className="live-indicator" data-state={connection} title={
      connection === "live"
        ? "Streaming changes from this repository"
        : "Not receiving changes — reload to see other people's decisions"
    }>
      <span className="live-dot" aria-hidden="true" />
      <span className="live-label">{label}</span>
      {last ? <span className="live-last">{last}</span> : null}
    </span>
  );
}
