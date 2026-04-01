import pc from "picocolors";

export interface LoggerOptions {
	write?: (text: string, level: string) => void;
}

export class Logger {
	private quiet = false;
	private json = false;
	private write: (text: string, level: string) => void;

	constructor(options?: LoggerOptions) {
		this.write = options?.write ?? ((text: string, _level: string) => console.log(text));
	}

	setQuiet(value: boolean): void {
		this.quiet = value;
	}

	setJson(value: boolean): void {
		this.json = value;
	}

	info(message: string): void {
		this.log("info", message);
	}

	success(message: string): void {
		this.log("success", `${pc.green("✓")} ${message}`);
	}

	warn(message: string): void {
		this.log("warn", `${pc.yellow("⚠")} ${message}`);
	}

	error(message: string): void {
		this.log("error", `${pc.red("✗")} ${message}`);
	}

	step(current: number, total: number, message: string): void {
		this.log("info", `[${current}/${total}] ${message}`);
	}

	private log(level: string, message: string): void {
		if (this.quiet && level !== "error") return;

		if (this.json) {
			const jsonMessage = level === "info" ? message : message.replace(/^[^\s]+\s/, "");
			this.write(JSON.stringify({ level, message: jsonMessage }), level);
			return;
		}

		this.write(message, level);
	}
}
