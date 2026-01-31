# bun-run-scripts

A utility that simplifies running shell commands via Bun in series or parallel, supporting the [Bun Shell](https://bun.com/docs/runtime/shell) and the system shell.

This uses no dependencies and is built on top of `Bun.spawn`.

## Installation

```bash
bun add bun-run-scripts
```

### Running Bun shell vs. system shell

The `shell` option passed to `runScript` or `runScripts` takes either `"bun"` or `"system"`, defaulting to `"bun"`.

When `"bun"` is used, the [Bun Shell](https://bun.com/docs/runtime/shell) executes the command, which provides a cross-platform bash-like shell.

For the `"system"` shell, on Unix (macOS and Linux) `sh -c` is used, and for Windows `cmd /d /s /c` is used.

### Parallel max

The `parallel` option passed to `runScripts` takes either `true` or an object with a `max` property, which can be a number, a percentage string (e.g. `"50%"`), or `"auto"` or `"unbounded"`.

The default is `false`, meaning scripts run in series.

When `true` is passed, the default parallel max is `"auto"`, meaning the number of scripts to run in parallel is the number of available CPU cores, based on the `os.availableParallelism()` function.

## Example

```ts
import { runScript, runScripts } from "bun-run-scripts";

const runSingleScript = async () => {
  const { output, exit, kill } = await runScript({
    command: "echo 'Hello, world!'",
    workingDirectory: ".", // optional, relative to process.cwd()
    metadata: { myMetadata: "example" }, // optional, metadata to attach to the script
    env: { MY_ENV_VAR: "example" }, // optional, environment variables to pass
    shell: "bun", // optional, the shell to use to run the script, defaults to "bun"
  });

  // Example to kill the script with SIGINT signal:
  // kill("SIGINT");

  for await (const outputChunk of output) {
    console.log(outputChunk.raw); // The raw Uint8Array of the output
    console.log(outputChunk.streamName); // The stream name, "stdout" or "stderr"
    console.log(outputChunk.decode()); // The decoded string of the output
    console.log(outputChunk.decode({ stripAnsi: true })); // The decoded string of the output without ANSI escape codes
  }

  const exitDetails = await exit;

  console.log(exitDetails.exitCode); // The exit code
  console.log(exitDetails.signal); // The signal
  console.log(exitDetails.success); // Is `true` is the script exits with code 0
  console.log(exitDetails.startTimeISO); // The start time
  console.log(exitDetails.endTimeISO); // The end time
  console.log(exitDetails.durationMs); // The duration
  console.log(exitDetails.metadata); // The metadata passed to the script
};

const runMultipleScripts = async () => {
  const { output, summary, kill } = await runScripts({
    scripts: [
      {
        command: "echo '1'",
        // same optional properties as for runScript
        workingDirectory: ".",
        metadata: {
          id: "script-1",
        },
        env: {
          EXAMPLE_ENV_VAR: "1",
        },
      },
      {
        command: "echo '2'",
        metadata: {
          id: "script-2",
        },
      },
      {
        command: "echo '3'",
        metadata: {
          id: "script-3",
        },
      },
    ],
    // A max of 2 scripts can run in parallel here.
    // The value can also be "auto" (default), "unbounded",
    // or a percentage of available CPU cores (e.g. "50%").
    parallel: { max: 2 },
    shell: "system",
  });

  // Examples to kill scripts:
  // kill(); // Kill all script processes
  // kill({ index: 0 }); // Kill the script at index 0
  // kill({ exit: "SIGINT" }); // Kill all script processes with signal SIGINT

  // Get one stream of output from all scripts
  for await (const { outputChunk, metadata, index } of output) {
    console.log(outputChunk.raw); // The raw Uint8Array of the output
    console.log(outputChunk.streamName); // The stream name, "stdout" or "stderr"
    console.log(outputChunk.decode()); // The decoded string of the output
    console.log(outputChunk.decode({ stripAnsi: true })); // Can strip ANSI escape codes
    console.log(metadata); // The metadata passed to the script (e.g. { id: "script-1" })
    console.log(index); // The index of the script as it was passed to runScripts
  }

  const exitSummary = await summary; // The summary of the script executions

  console.log(exitSummary.totalCount); // The total number of script executions
  console.log(exitSummary.successCount); // The number of successful script executions
  console.log(exitSummary.failureCount); // The number of failed script executions
  console.log(exitSummary.allSuccess); // Whether all script executions were successful
  console.log(exitSummary.startTimeISO); // The start time of the script executions
  console.log(exitSummary.endTimeISO); // The end time of the script executions
  console.log(exitSummary.durationMs); // The duration of the script executions
  console.log(exitSummary.scriptResults); // The exit details for each script
};
```

## More

Check out related project [`bun-workspaces`](https://github.com/bun-workspaces/bun-workspaces), a Bun monorepo management tool that can run package.json scripts across workspaces.
