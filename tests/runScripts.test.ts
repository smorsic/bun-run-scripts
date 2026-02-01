import { randomUUID } from "crypto";
import fs from "fs";
import { availableParallelism } from "os";
import path from "path";
import { test, expect, describe } from "bun:test";
import { IS_WINDOWS } from "../src/internal/core";
import { runScripts } from "../src/runScripts";

describe("Run Multiple Scripts", () => {
  test("Run Scripts - simple series", async () => {
    const result = await runScripts({
      scripts: [
        {
          metadata: {
            name: "test-script name 1",
          },
          command: "echo test-script 1",
          workingDirectory: "",
          env: {},
        },
        {
          metadata: {
            name: "test-script name 2",
          },
          command: "echo test-script 2",
          workingDirectory: "",
          env: {},
        },
      ],
      parallel: false,
    });

    let i = 0;
    for await (const {
      outputChunk,
      metadata,
      subprocess,
      index,
    } of result.output) {
      expect(metadata.name).toBe(`test-script name ${i + 1}`);
      expect(outputChunk.decode()).toMatch(`test-script ${i + 1}`);
      expect(outputChunk.decode({ stripAnsi: true })).toMatch(
        `test-script ${i + 1}`
      );
      expect(subprocess.kill).toBeInstanceOf(Function);
      expect(index).toBe(i);
      i++;
    }

    const summary = await result.summary;
    expect(summary).toEqual({
      totalCount: 2,
      allSuccess: true,
      failureCount: 0,
      successCount: 2,
      startTimeISO: expect.any(String),
      endTimeISO: expect.any(String),
      durationMs: expect.any(Number),
      scriptResults: [
        {
          exitCode: 0,
          success: true,
          startTimeISO: expect.any(String),
          endTimeISO: expect.any(String),
          durationMs: expect.any(Number),
          signal: null,
          metadata: {
            name: "test-script name 1",
          },
        },
        {
          exitCode: 0,
          success: true,
          startTimeISO: expect.any(String),
          endTimeISO: expect.any(String),
          durationMs: expect.any(Number),
          signal: null,
          metadata: {
            name: "test-script name 2",
          },
        },
      ],
    });
  });

  test("Run Scripts - simple series with failure", async () => {
    const result = await runScripts({
      scripts: [
        {
          metadata: {
            name: "test-script name 1",
          },
          command: IS_WINDOWS
            ? "echo test-script 1 && exit /b 1"
            : "echo 'test-script 1' && exit 1",
          workingDirectory: "",
        },
        {
          metadata: {
            name: "test-script name 2",
          },
          command: "echo test-script 2",
          workingDirectory: "",
        },
      ],
      parallel: false,
    });

    let i = 0;
    for await (const {
      outputChunk: output,
      metadata: metadata,
    } of result.output) {
      expect(metadata.name).toBe(`test-script name ${i + 1}`);
      expect(output.decode()).toMatch(`test-script ${i + 1}`);
      expect(output.decode({ stripAnsi: true })).toMatch(
        `test-script ${i + 1}`
      );
      i++;
    }

    const summary = await result.summary;
    expect(summary).toEqual({
      totalCount: 2,
      allSuccess: false,
      failureCount: 1,
      successCount: 1,
      startTimeISO: expect.any(String),
      endTimeISO: expect.any(String),
      durationMs: expect.any(Number),
      scriptResults: [
        {
          exitCode: 1,
          success: false,
          startTimeISO: expect.any(String),
          endTimeISO: expect.any(String),
          durationMs: expect.any(Number),
          signal: null,
          metadata: {
            name: "test-script name 1",
          },
        },
        {
          exitCode: 0,
          success: true,
          startTimeISO: expect.any(String),
          endTimeISO: expect.any(String),
          durationMs: expect.any(Number),
          signal: null,
          metadata: {
            name: "test-script name 2",
          },
        },
      ],
    });
  });

  test("Run Scripts - simple parallel", async () => {
    const scripts = [
      {
        metadata: {
          name: "test-script name 1",
        },
        command: IS_WINDOWS
          ? "ping 127.0.0.1 -n 3 >nul && echo test-script 1"
          : "sleep 0.5 && echo test-script 1",
        workingDirectory: "",
      },
      {
        metadata: {
          name: "test-script name 2",
        },
        command: IS_WINDOWS
          ? "echo test-script 2 && exit /b 2"
          : "echo 'test-script 2' && exit 2",
        workingDirectory: "",
      },
      {
        metadata: {
          name: "test-script name 3",
        },
        command: IS_WINDOWS
          ? "ping 127.0.0.1 -n 2 >nul && echo test-script 3"
          : "sleep 0.25 && echo test-script 3",
        workingDirectory: "",
      },
    ];

    const result = await runScripts({
      scripts,
      parallel: true,
    });

    let i = 0;
    for await (const {
      outputChunk,
      metadata: scriptMetadata,
    } of result.output) {
      expect(outputChunk.streamName).toBe("stdout");
      const scriptNum = i === 0 ? 2 : i === 1 ? 3 : 1;
      expect(scriptMetadata.name).toBe(`test-script name ${scriptNum}`);
      expect(outputChunk.decode()).toMatch(`test-script ${scriptNum}`);
      expect(outputChunk.decode({ stripAnsi: true })).toMatch(
        `test-script ${scriptNum}`
      );
      i++;
    }

    const summary = await result.summary;
    expect(summary).toEqual({
      totalCount: 3,
      allSuccess: false,
      failureCount: 1,
      successCount: 2,
      startTimeISO: expect.any(String),
      endTimeISO: expect.any(String),
      durationMs: expect.any(Number),
      scriptResults: [
        {
          exitCode: 0,
          success: true,
          startTimeISO: expect.any(String),
          endTimeISO: expect.any(String),
          durationMs: expect.any(Number),
          signal: null,
          metadata: {
            name: "test-script name 1",
          },
        },
        {
          exitCode: 2,
          success: false,
          startTimeISO: expect.any(String),
          endTimeISO: expect.any(String),
          durationMs: expect.any(Number),
          signal: null,
          metadata: {
            name: "test-script name 2",
          },
        },
        {
          exitCode: 0,
          success: true,
          startTimeISO: expect.any(String),
          endTimeISO: expect.any(String),
          durationMs: expect.any(Number),
          signal: null,
          metadata: {
            name: "test-script name 3",
          },
        },
      ],
    });
  });

  test.each([1, 2, 3, 4, 5])(
    `Run Scripts - parallel max count %d`,
    async (max) => {
      const runId = randomUUID();

      const outputDir = path.join(
        __dirname,
        "test-output",
        "run-script-internals-parallel-max",
        runId
      );
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
      }
      fs.mkdirSync(outputDir, { recursive: true });

      const getRunningFile = (scriptName: string) =>
        path.join(outputDir, `${scriptName}.txt`);

      const getRandomSleepTime = () => Math.max(0.075, Math.random() + 0.025);

      const createScript = (scriptName: string) => ({
        metadata: { name: scriptName },
        command: IS_WINDOWS
          ? `echo test-script ${scriptName} > ${getRunningFile(
              scriptName
            )}  && ` +
            `dir /b ${outputDir} | find /c /v "" && ` +
            `ping 127.0.0.1 -n 2 -w ${Math.floor(
              getRandomSleepTime() * 1000
            )} >nul && ` +
            `del ${getRunningFile(scriptName)}`
          : `echo 'test-script ${scriptName}' > ${getRunningFile(
              scriptName
            )} && ls ${outputDir} | wc -l && sleep ${getRandomSleepTime()} && rm ${getRunningFile(
              scriptName
            )}`,
        workingDirectory: "",
      });

      const result = await runScripts({
        parallel: {
          max,
        },
        scripts: [
          createScript("test-script-1"),
          createScript("test-script-2"),
          createScript("test-script-3"),
          createScript("test-script-4"),
          createScript("test-script-5"),
        ],
      });

      let didMaxRun = false;
      for await (const { outputChunk } of result.output) {
        const count = parseInt(outputChunk.decode().trim());
        if (count === max) {
          didMaxRun = true;
        }
        expect(count).toBeLessThanOrEqual(max);
      }

      expect(didMaxRun).toBe(true);

      const summary = await result.summary;
      expect(summary).toEqual({
        totalCount: 5,
        allSuccess: true,
        failureCount: 0,
        successCount: 5,
        startTimeISO: expect.any(String),
        endTimeISO: expect.any(String),
        durationMs: expect.any(Number),
        scriptResults: [
          {
            exitCode: 0,
            success: true,
            startTimeISO: expect.any(String),
            endTimeISO: expect.any(String),
            durationMs: expect.any(Number),
            signal: null,
            metadata: { name: "test-script-1" },
          },
          {
            exitCode: 0,
            success: true,
            startTimeISO: expect.any(String),
            endTimeISO: expect.any(String),
            durationMs: expect.any(Number),
            signal: null,
            metadata: { name: "test-script-2" },
          },
          {
            exitCode: 0,
            success: true,
            startTimeISO: expect.any(String),
            endTimeISO: expect.any(String),
            durationMs: expect.any(Number),
            signal: null,
            metadata: { name: "test-script-3" },
          },
          {
            exitCode: 0,
            success: true,
            startTimeISO: expect.any(String),
            endTimeISO: expect.any(String),
            durationMs: expect.any(Number),
            signal: null,
            metadata: { name: "test-script-4" },
          },
          {
            exitCode: 0,
            success: true,
            startTimeISO: expect.any(String),
            endTimeISO: expect.any(String),
            durationMs: expect.any(Number),
            signal: null,
            metadata: { name: "test-script-5" },
          },
        ],
      });
    }
  );

  test.each([3, "auto", "unbounded", "100%", "50%"])(
    "Run Scripts - confirm parallel max arg types (%p)",
    async (max) => {
      const result = await runScripts({
        parallel: {
          max,
        },
        scripts: [
          {
            command: IS_WINDOWS
              ? `echo %_BUN_RUN_SCRIPTS_PARALLEL_MAX%`
              : "echo $_BUN_RUN_SCRIPTS_PARALLEL_MAX",
            workingDirectory: "",
            env: {
              _BUN_RUN_SCRIPTS_PARALLEL_MAX: max.toString(),
            },
          },
        ],
      });

      for await (const { outputChunk } of result.output) {
        const envMax = outputChunk.decode().trim();
        if (typeof max === "number") {
          expect(envMax).toBe(max.toString());
        } else if (max === "auto") {
          expect(envMax).toBe(availableParallelism().toString());
        } else if (max === "unbounded") {
          expect(envMax).toBe("Infinity");
        } else if (max === "100%") {
          expect(envMax).toBe(availableParallelism().toString());
        } else if (max === "50%") {
          expect(envMax).toBe(
            Math.floor(availableParallelism() * 0.5).toString()
          );
        }
      }
    }
  );

  test("Run Scripts - cyclical default parallel max as 'default' handled as 'auto'", async () => {
    const result = await runScripts({
      parallel: true,
      scripts: [
        {
          command: IS_WINDOWS
            ? `echo %_BUN_RUN_SCRIPTS_PARALLEL_MAX%`
            : "echo $_BUN_RUN_SCRIPTS_PARALLEL_MAX",
          workingDirectory: "",
        },
      ],
    });

    for await (const { outputChunk } of result.output) {
      expect(outputChunk.decode().trim()).toBe(
        availableParallelism().toString()
      );
    }
  });

  test("Run Scripts - kill a script", async () => {
    const result = await runScripts({
      scripts: [
        {
          command: "sleep 1",
          metadata: { name: "test-script-1" },
        },
        { command: "sleep 1", metadata: { name: "test-script-2" } },
      ],
      parallel: true,
    });

    result.kill({ index: 0 });
    const summary = await result.summary;
    expect(summary).toEqual({
      totalCount: 2,
      allSuccess: false,
      failureCount: 1,
      successCount: 1,
      startTimeISO: expect.any(String),
      endTimeISO: expect.any(String),
      durationMs: expect.any(Number),
      scriptResults: [
        {
          exitCode: IS_WINDOWS ? 1 : 143,
          success: false,
          startTimeISO: expect.any(String),
          endTimeISO: expect.any(String),
          durationMs: expect.any(Number),
          signal: IS_WINDOWS ? null : "SIGTERM",
          metadata: { name: "test-script-1" },
        },
        {
          exitCode: 0,
          success: true,
          startTimeISO: expect.any(String),
          endTimeISO: expect.any(String),
          durationMs: expect.any(Number),
          signal: null,
          metadata: { name: "test-script-2" },
        },
      ],
    });
  });

  test("Run Scripts - kill all scripts", async () => {
    const result = await runScripts({
      scripts: [
        { command: "sleep 1", metadata: { name: "test-script-1" } },
        { command: "sleep 1", metadata: { name: "test-script-2" } },
      ],
      parallel: true,
    });
    result.kill({ exit: 1 });
    const summary = await result.summary;
    expect(summary).toEqual({
      totalCount: 2,
      allSuccess: false,
      failureCount: 2,
      successCount: 0,
      startTimeISO: expect.any(String),
      endTimeISO: expect.any(String),
      durationMs: expect.any(Number),
      scriptResults: [
        {
          exitCode: IS_WINDOWS ? 1 : 129,
          success: false,
          startTimeISO: expect.any(String),
          endTimeISO: expect.any(String),
          durationMs: expect.any(Number),
          signal: IS_WINDOWS ? null : "SIGHUP",
          metadata: { name: "test-script-1" },
        },
        {
          exitCode: IS_WINDOWS ? 1 : 129,
          success: false,
          startTimeISO: expect.any(String),
          endTimeISO: expect.any(String),
          durationMs: expect.any(Number),
          signal: IS_WINDOWS ? null : "SIGHUP",
          metadata: { name: "test-script-2" },
        },
      ],
    });
  });

  test.only("Run Scripts - onScriptStart callback", async () => {
    let startedCount = 0;
    const result = await runScripts({
      scripts: [
        { command: "sleep 1", metadata: { name: "test-script-1" } },
        { command: "sleep 1", metadata: { name: "test-script-2" } },
      ],
      parallel: true,
      onScriptStart: (details) => {
        expect(details.index).toBe(startedCount);
        expect(details.metadata.name).toBe(`test-script-${startedCount + 1}`);
        expect(details.exit).toBeInstanceOf(Promise);
        expect(details.kill).toBeInstanceOf(Function);
        expect(details.output[Symbol.asyncIterator]).toBeInstanceOf(Function);
        expect(details.subprocess.kill).toBeInstanceOf(Function);
        startedCount++;
      },
    });

    await result.summary;

    expect(startedCount).toBe(2);
  });
});
