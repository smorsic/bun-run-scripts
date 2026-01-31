import os from "os";

export const PARALLEL_MAX_VALUES = ["auto", "unbounded"] as const;

export type PercentageValue = `${number}%`;

export type ParallelMaxValue =
  | number
  | (typeof PARALLEL_MAX_VALUES)[number]
  | PercentageValue;

/** Should always return at least 1 */
export const determineParallelMax = (
  value: ParallelMaxValue,
  errorMessageSuffix = "",
): number => {
  if (!isNaN(Number(value))) {
    value = Math.floor(Number(value));
  }

  if (typeof value === "number") {
    if (value < 1 || isNaN(value)) {
      throw new Error(
        `Parallel max value must be at least 1${errorMessageSuffix}`,
      );
    }
    return Math.floor(value);
  }

  if (value === "unbounded") {
    return Infinity;
  }

  const cpuCount = Math.max(1, os.availableParallelism());

  if (value === "auto") {
    return cpuCount;
  }

  if (value.endsWith("%")) {
    const percentage = parseFloat(value.slice(0, -1));
    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      throw new Error(
        `Parallel max value must be a number greater than 0 and less than or equal to 100${errorMessageSuffix}`,
      );
    }

    return Math.max(1, Math.floor((cpuCount * percentage) / 100));
  }

  throw new Error(
    `Invalid parallel max value: ${JSON.stringify(value)}${errorMessageSuffix}`,
  );
};
