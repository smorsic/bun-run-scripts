export type OutputStreamName = "stdout" | "stderr";

export interface DecodeOptions {
  /** Whether to strip ANSI escape codes */
  stripAnsi?: boolean;
}

/** Output captured from a script subprocess */
export interface OutputChunk {
  /** The source of the output, `"stdout"` or `"stderr"` */
  streamName: OutputStreamName;
  /** Raw output text. Pass `true` to strip ANSI escape codes. */
  decode(options?: DecodeOptions): string;
  /** The raw output content */
  raw: Uint8Array<ArrayBuffer>;
}

class _OutputChunk implements OutputChunk {
  constructor(
    public readonly streamName: OutputStreamName,
    public readonly raw: Uint8Array<ArrayBuffer>,
  ) {}

  decode(options?: DecodeOptions): string {
    const { stripAnsi = false } = options ?? {};
    const text = new TextDecoder().decode(this.raw);
    return stripAnsi ? Bun.stripANSI(text) : text;
  }
}

export const createOutputChunk = (
  streamName: OutputStreamName,
  raw: Uint8Array<ArrayBuffer>,
): OutputChunk => new _OutputChunk(streamName, raw);
