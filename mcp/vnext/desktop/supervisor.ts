// One Kage daemon per watched repository, supervised by the desktop app.
//
// The app owns these processes so a person never types `kage viewer` again — that is most of what
// makes it an app rather than a command. The rules that matter are all about not making a mess:
// never two daemons over one `.agent_memory`, never a second daemon on a port already taken, and
// never a child left running after the window closes.
//
// The daemon runs on the SYSTEM Node, not Electron's. Measured, not assumed: Electron 33 bundles
// Node 20, which has no `node:sqlite`, and the portal's compiled-model routes (Knowledge, System
// map) need it. Running the existing daemon as a child on the system Node reuses the entire server
// unchanged and keeps this file to supervision.
//
// Everything impure is injected, so the lifecycle rules are testable without spawning anything.

export type DaemonState = "starting" | "running" | "stopped" | "failed";

export interface DaemonStatus {
  repo: string;
  port: number;
  state: DaemonState;
  pid: number | null;
  /** Present when state is "failed": why, in words an operator can act on. */
  detail?: string;
}

export interface SpawnedProcess {
  pid: number | null;
  kill(signal?: string): void;
}

export interface SupervisorDeps {
  /** Spawns the daemon. Detached from the app's own stdio; the app is not a terminal. */
  spawn(command: string, args: string[], cwd: string): SpawnedProcess;
  /** True once the port accepts a connection. */
  probe(port: number): Promise<boolean>;
  /** Bounded wait between probes. */
  wait(ms: number): Promise<void>;
}

/**
 * The command that starts one repository's daemon.
 *
 * `--project` is passed explicitly rather than relying on cwd, because the daemon resolves its
 * portal directory from its own `__dirname` and its memory from `--project`; conflating the two is
 * how a daemon ends up serving one repository's portal over another's memory.
 */
export function daemonCommand(
  nodeBinary: string,
  cliPath: string,
  repoPath: string,
  port: number,
): { command: string; args: string[] } {
  return {
    command: nodeBinary,
    args: [cliPath, "viewer", "--project", repoPath, "--port", String(port)],
  };
}

/** How long to wait for a freshly spawned daemon to accept connections before calling it failed. */
const STARTUP_TIMEOUT_MS = 15_000;
const PROBE_INTERVAL_MS = 200;

export class DaemonSupervisor {
  private readonly running = new Map<string, { port: number; process: SpawnedProcess }>();
  private readonly status = new Map<string, DaemonStatus>();

  constructor(
    private readonly deps: SupervisorDeps,
    private readonly nodeBinary: string,
    private readonly cliPath: string,
  ) {}

  statusFor(repo: string): DaemonStatus | null {
    return this.status.get(repo) ?? null;
  }

  all(): DaemonStatus[] {
    return [...this.status.values()];
  }

  /** Ports currently in use by this supervisor. */
  private taken(): Set<number> {
    return new Set([...this.running.values()].map((entry) => entry.port));
  }

  /**
   * Start a repository's daemon, or do nothing if it is already up.
   *
   * Idempotent on purpose: the app calls this on launch, on add, and on repo switch, and a second
   * daemon over the same `.agent_memory` is not a duplicate — it is two writers.
   */
  async start(repo: string, port: number): Promise<DaemonStatus> {
    const existing = this.running.get(repo);
    if (existing) return this.status.get(repo)!;

    // A port already serving another repository would silently hand that repository's data to this
    // one. Refuse rather than guess.
    if (this.taken().has(port)) {
      const status: DaemonStatus = {
        repo,
        port,
        state: "failed",
        pid: null,
        detail: `port ${port} is already serving another repository`,
      };
      this.status.set(repo, status);
      return status;
    }

    const { command, args } = daemonCommand(this.nodeBinary, this.cliPath, repo, port);
    let child: SpawnedProcess;
    try {
      child = this.deps.spawn(command, args, repo);
    } catch (error) {
      const status: DaemonStatus = {
        repo,
        port,
        state: "failed",
        pid: null,
        detail: error instanceof Error ? error.message : String(error),
      };
      this.status.set(repo, status);
      return status;
    }

    this.running.set(repo, { port, process: child });
    this.status.set(repo, { repo, port, state: "starting", pid: child.pid });

    // Spawning is not serving. Wait for the port to actually accept before reporting running —
    // otherwise the window loads against a socket that is not there yet and shows a blank shell.
    const deadline = STARTUP_TIMEOUT_MS;
    let waited = 0;
    while (waited < deadline) {
      if (await this.deps.probe(port)) {
        const status: DaemonStatus = { repo, port, state: "running", pid: child.pid };
        this.status.set(repo, status);
        return status;
      }
      await this.deps.wait(PROBE_INTERVAL_MS);
      waited += PROBE_INTERVAL_MS;
    }

    // Never leave an unresponsive child behind — that is how ports leak across relaunches.
    child.kill("SIGTERM");
    this.running.delete(repo);
    const status: DaemonStatus = {
      repo,
      port,
      state: "failed",
      pid: null,
      detail: `the daemon did not accept connections on ${port} within ${STARTUP_TIMEOUT_MS / 1000}s`,
    };
    this.status.set(repo, status);
    return status;
  }

  stop(repo: string): void {
    const entry = this.running.get(repo);
    if (!entry) return;
    entry.process.kill("SIGTERM");
    this.running.delete(repo);
    this.status.set(repo, { repo, port: entry.port, state: "stopped", pid: null });
  }

  /** Called on app quit. A daemon outliving the window is a process nobody can find to kill. */
  stopAll(): void {
    for (const repo of [...this.running.keys()]) this.stop(repo);
  }
}
