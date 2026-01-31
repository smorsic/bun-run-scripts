import {
  createAsyncIterableQueue,
  type SimpleAsyncIterable,
} from "../internal/core";
import type { OutputChunk } from "./outputChunk";
import { determineParallelMax, type ParallelMaxValue } from "./parallel";
import {
  runScript,
  type RunScriptExit,
  type RunScriptOptions,
  type RunScriptResult,
} from "./runScript";
import {
  resolveScriptShell,
  type ScriptShellOption,
} from "./scriptShellOption";

export type RunScriptsScriptResult<ScriptMetadata extends object = object> = {
  /** The result of running the script */
  result: RunScriptResult<ScriptMetadata>;
};

export type RunScriptsSummary<ScriptMetadata extends object = object> = {
  totalCount: number;
  successCount: number;
  failureCount: number;
  allSuccess: boolean;
  startTimeISO: string;
  endTimeISO: string;
  durationMs: number;
  scriptResults: RunScriptExit<ScriptMetadata>[];
};

export type RunScriptsOutput<ScriptMetadata extends object = object> = {
  /** The output chunk from a script execution */
  outputChunk: OutputChunk;
  /** The metadata for the script that produced the output chunk */
  metadata: ScriptMetadata;
  /** The index of the script based on the array passed to runScripts */
  index: number;
};

export type KillOptions = {
  index?: number;
  exit?: number | NodeJS.Signals;
};

export type RunScriptsResult<ScriptMetadata extends object = object> = {
  /** Allows async iteration of output chunks from all script executions */
  output: SimpleAsyncIterable<RunScriptsOutput<ScriptMetadata>>;
  /** Resolves with a results summary after all scripts have exited */
  summary: Promise<RunScriptsSummary<ScriptMetadata>>;
  /** Kills all script processes if no index passed, or kills the script process with the given index */
  kill: (options?: KillOptions) => void;
};

export type RunScriptsParallelOptions = {
  max: ParallelMaxValue;
};

export type RunScriptsOptions<ScriptMetadata extends object = object> = {
  scripts: Omit<RunScriptOptions<ScriptMetadata>, "shell">[];
  parallel?: boolean | RunScriptsParallelOptions;
  shell?: ScriptShellOption;
};

/** Run a list of scripts */
export const runScripts = <ScriptMetadata extends object = object>({
  scripts,
  parallel = false,
  shell: _shell,
}: RunScriptsOptions<ScriptMetadata>): RunScriptsResult<ScriptMetadata> => {
  const startTime = new Date();

  const shell = resolveScriptShell(_shell);

  type ScriptTrigger = {
    promise: Promise<ScriptTrigger>;
    trigger: () => void;
    index: number;
  };

  const scriptTriggers: ScriptTrigger[] = scripts.map((_, index) => {
    let trigger: () => void = () => {
      void 0;
    };

    const promise = new Promise<ScriptTrigger>((res) => {
      trigger = () => res(result);
    });

    const result: ScriptTrigger = {
      promise,
      trigger,
      index,
    };

    return result;
  });

  const outputQueue =
    createAsyncIterableQueue<RunScriptsOutput<ScriptMetadata>>();

  const scriptResults: RunScriptsScriptResult<ScriptMetadata>[] = scripts.map(
    () => null as never as RunScriptsScriptResult<ScriptMetadata>,
  );

  const parallelMax =
    parallel === false
      ? 1
      : determineParallelMax(
          typeof parallel === "boolean" ? "auto" : parallel.max,
        );

  let runningScriptCount = 0;
  let nextScriptIndex = 0;
  const queueScript = (index: number) => {
    if (runningScriptCount >= parallelMax) {
      return;
    }

    const scriptResult = {
      ...scripts[index],
      result: runScript({
        ...scripts[index]!,
        env: {
          ...scripts[index]!.env,
          _BUN_RUN_SCRIPTS_PARALLEL_MAX: parallelMax.toString(),
        },
        shell,
      }),
    };

    scriptResults[index] = scriptResult;

    scriptTriggers[index]!.trigger();

    runningScriptCount++;
    nextScriptIndex++;

    scriptResults[index].result.exit.then(() => {
      runningScriptCount--;
      if (nextScriptIndex < scripts.length) {
        queueScript(nextScriptIndex);
      }
    });

    return scriptResult;
  };

  const handleScriptProcesses = async () => {
    const outputReaders: Promise<void>[] = [];
    const scriptExits: Promise<void>[] = [];

    let pendingScriptCount = scripts.length;
    while (pendingScriptCount > 0) {
      const { index } = await Promise.race(
        scriptTriggers.map((trigger) => trigger.promise),
      );

      pendingScriptCount--;

      scriptTriggers[index]!.promise = new Promise<never>(() => {
        void 0;
      });

      outputReaders.push(
        (async () => {
          for await (const chunk of scriptResults[index]!.result.output) {
            outputQueue.push({
              outputChunk: chunk,
              metadata: scripts[index]!.metadata || ({} as ScriptMetadata),
              index,
            });
          }
        })(),
      );
    }

    await Promise.all(outputReaders);
    await Promise.all(scriptExits);
    outputQueue.close();
  };

  const awaitSummary = async () => {
    scripts.forEach((_, index) => queueScript(index));

    await handleScriptProcesses();

    const scriptExitResults = await Promise.all(
      scripts.map((_, index) => scriptResults[index]!.result.exit),
    );

    const endTime = new Date();

    return {
      totalCount: scriptExitResults.length,
      successCount: scriptExitResults.filter((exit) => exit.success).length,
      failureCount: scriptExitResults.filter((exit) => !exit.success).length,
      allSuccess: scriptExitResults.every((exit) => exit.success),
      startTimeISO: startTime.toISOString(),
      endTimeISO: endTime.toISOString(),
      durationMs: endTime.getTime() - startTime.getTime(),
      scriptResults: scriptExitResults,
    };
  };

  return {
    output: outputQueue,
    summary: awaitSummary(),
    kill: (options?: KillOptions) => {
      const { index, exit } = options || {};

      if (typeof index === "number") {
        scriptResults[index]?.result.kill(exit);
      } else {
        scriptResults.forEach((scriptResult) =>
          scriptResult?.result?.kill(exit),
        );
      }
    },
  };
};
