export const SCRIPT_SHELL_OPTIONS = ["bun", "system"] as const;

export type ScriptShellOption = (typeof SCRIPT_SHELL_OPTIONS)[number];

export const DEFAULT_SCRIPT_SHELL_OPTION = "bun";

export const validateScriptShellOption = (shell: string): ScriptShellOption => {
  if (!SCRIPT_SHELL_OPTIONS.includes(shell as ScriptShellOption)) {
    throw new Error(
      `Invalid shell option: ${shell} (accepted values: ${SCRIPT_SHELL_OPTIONS.join(
        ", ",
      )})`,
    );
  }
  return shell as ScriptShellOption;
};

export const resolveScriptShell = (shell?: string): ScriptShellOption => {
  if (!shell) {
    return DEFAULT_SCRIPT_SHELL_OPTION;
  }
  return validateScriptShellOption(shell);
};
