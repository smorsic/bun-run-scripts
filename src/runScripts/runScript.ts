import {
  type SimpleAsyncIterable,
  mergeAsyncIterables,
} from "../internal/core";
import {
  createOutputChunk,
  type OutputChunk,
  type OutputStreamName,
} from "./outputChunk";
import { createScriptExecutor } from "./scriptExecution";
import {
  DEFAULT_SCRIPT_SHELL_OPTION,
  type ScriptShellOption,
} from "./scriptShellOption";

export type RunScriptExit<ScriptMetadata extends object = object> = {
  exitCode: number;
  signal: NodeJS.Signals | null;
  success: boolean;
  startTimeISO: string;
  endTimeISO: string;
  durationMs: number;
  metadata: ScriptMetadata;
};

export type RunScriptResult<ScriptMetadata extends object = object> = {
  /** An async iterator of output of the script (use for-await syntax to read) */
  output: SimpleAsyncIterable<OutputChunk>;
  /** The exit details of the script */
  exit: Promise<RunScriptExit<ScriptMetadata>>;
  /** The metadata passed to the script, will be in the exit details */
  metadata: Partial<ScriptMetadata>;
  /** Kill the subprocess */
  kill: (exit?: number | NodeJS.Signals) => void;
  /** The underlying subprocess */
  subprocess: Bun.Subprocess;
};

export type RunScriptOptions<ScriptMetadata extends object = object> = {
  command: string;
  workingDirectory?: string;
  metadata?: ScriptMetadata;
  env?: Record<string, string>;
  /** The shell to use to run the script. Defaults to "system". */
  shell?: ScriptShellOption;
};

/**
 * Run some script and get an async output stream of
 * stdout and stderr chunks and a result object
 * containing exit details.
 */
export const runScript = <ScriptMetadata extends object = object>({
  command,
  workingDirectory,
  metadata = {} as ScriptMetadata,
  env = {},
  shell = DEFAULT_SCRIPT_SHELL_OPTION,
}: RunScriptOptions<ScriptMetadata>): RunScriptResult<ScriptMetadata> => {
  const startTime = new Date();

  const { argv, cleanup } = createScriptExecutor(command, shell);

  const subprocess = Bun.spawn(argv, {
    cwd: workingDirectory || process.cwd(),
    env: {
      ...process.env,
      ...env,
      _BUN_RUN_SCRIPTS_SHELL_OPTION: shell,
      FORCE_COLOR: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  subprocess.exited.finally(cleanup);
  async function* pipeOutput(
    streamName: OutputStreamName
  ): SimpleAsyncIterable<OutputChunk> {
    const stream = subprocess[streamName];
    if (stream) {
      for await (const chunk of stream) {
        yield createOutputChunk(streamName, chunk);
      }
    }
  }

  const output = mergeAsyncIterables([
    pipeOutput("stdout"),
    pipeOutput("stderr"),
  ]);

  const exit = subprocess.exited.then<RunScriptExit<ScriptMetadata>>(
    (exitCode) => {
      const endTime = new Date();
      return {
        exitCode,
        signal: subprocess.signalCode,
        success: exitCode === 0,
        startTimeISO: startTime.toISOString(),
        endTimeISO: endTime.toISOString(),
        durationMs: endTime.getTime() - startTime.getTime(),
        metadata,
      };
    }
  );

  return {
    output,
    exit,
    metadata,
    kill: (exit) => subprocess.kill(exit),
    subprocess,
  };
};
