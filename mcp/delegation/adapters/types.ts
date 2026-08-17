// Adapter contract: brief in, transcript + final message out. Adapters are thin —
// they spawn a hired agent (or a stub) in a working directory and stream what happened
// to transcript.jsonl. The kernel owns everything else: state, claims, verification.
import type { ProgressSink } from "../progress.js";

export interface AdapterInput {
  runId: string;
  workDir: string;
  briefBody: string;
  transcriptPath: string;
  /** Live activity, so a long run is never a silent one. */
  onProgress?: ProgressSink;
  /**
   * Pre-assigned session id. Knowing the handle BEFORE the process starts is what makes
   * resume-in-place possible — otherwise a blocked agent's context dies with its process
   * and answering it means starting over.
   */
  sessionId?: string;
  /** Continue an existing session instead of starting one (answering a blocked agent). */
  resumeSessionId?: string;
  /** Report the child's pid so a dead process can never masquerade as a running one. */
  onStart?: (pid: number | undefined) => void;
}

export interface AdapterUsage {
  /** Cost as the agent CLI itself reported it (claude: total_cost_usd). */
  usd: number;
  /** input + output tokens, as reported. */
  tokens: number;
}

export interface AdapterOutcome {
  /** Present only when the agent's own stream reported it — never estimated here. */
  usage?: AdapterUsage;
  exit_code: number;
  final_message: string;
  /** The agent's own report that it is waiting on a human, straight from its stream. */
  waiting?: { detail: string; needs: string };
  session_id?: string;
}

export interface Adapter {
  name: string;
  run(input: AdapterInput): Promise<AdapterOutcome>;
}
