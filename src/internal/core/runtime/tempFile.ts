import fs from "fs";
import os from "os";
import path from "path";
import { BUN_RUN_SCRIPTS_VERSION } from "../../version";
import { createShortId } from "../language/string/id";
import { runOnExit } from "./onExit";

const getTempBasePackageDir = () => path.join(os.tmpdir(), "bun-run-scripts");

const getTempParentDir = () =>
  path.join(getTempBasePackageDir(), BUN_RUN_SCRIPTS_VERSION);

export type CreateTempFileOptions = {
  name: string;
  content: string;
  mode?: fs.Mode;
};

class TempDir {
  public readonly id = createShortId(6);
  public readonly dir: string;

  constructor() {
    this.dir = path.join(getTempParentDir(), this.id);
  }

  initialize(clean = false) {
    if (fs.existsSync(this.dir)) return;

    fs.mkdirSync(this.dir, { recursive: true });
    fs.chmodSync(this.dir, 0o700);

    if (clean) {
      for (const dir of fs.readdirSync(path.resolve(getTempBasePackageDir()))) {
        if (dir !== BUN_RUN_SCRIPTS_VERSION) {
          fs.rmSync(path.join(getTempBasePackageDir(), dir), {
            force: true,
            recursive: true,
          });
        }
      }
    }

    runOnExit(() => this.cleanup());
  }

  createFilePath(fileName: string) {
    return path.join(this.dir, fileName);
  }

  createFile({ name, content, mode }: CreateTempFileOptions) {
    this.initialize();
    const filePath = this.createFilePath(name);
    fs.writeFileSync(filePath, content, {
      encoding: "utf8",
      mode,
    });
    return {
      filePath,
      cleanup: () => fs.rmSync(filePath, { force: true }),
    };
  }

  cleanup() {
    fs.rmSync(this.dir, { force: true, recursive: true });
  }
}

export const DEFAULT_TEMP_DIR = new TempDir();
