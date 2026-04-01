import { writeKiConfig } from "../core/config.js";

export function runInit(projectDir: string): void {
	writeKiConfig(projectDir, { skills: {} }, { overwrite: false });
}
