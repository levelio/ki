export class KiError extends Error {
	code: string;
	exitCode: number;

	constructor(message: string, options?: { code?: string; exitCode?: number }) {
		super(message);
		this.name = "KiError";
		this.code = options?.code ?? "KI_ERROR";
		this.exitCode = options?.exitCode ?? 1;
	}
}

export class ConfigError extends KiError {
	constructor(message: string, options?: { code?: string }) {
		super(message, { code: options?.code ?? "CONFIG_ERROR", exitCode: 1 });
		this.name = "ConfigError";
	}
}

export class ResolveError extends KiError {
	constructor(message: string, options?: { code?: string }) {
		super(message, { code: options?.code ?? "RESOLVE_ERROR", exitCode: 1 });
		this.name = "ResolveError";
	}
}

export class FetchError extends KiError {
	constructor(message: string, options?: { code?: string }) {
		super(message, { code: options?.code ?? "FETCH_ERROR", exitCode: 1 });
		this.name = "FetchError";
	}
}

export class InstallError extends KiError {
	constructor(message: string, options?: { code?: string }) {
		super(message, { code: options?.code ?? "INSTALL_ERROR", exitCode: 1 });
		this.name = "InstallError";
	}
}

export class AgentError extends KiError {
	constructor(message: string, options?: { code?: string }) {
		super(message, { code: options?.code ?? "AGENT_ERROR", exitCode: 1 });
		this.name = "AgentError";
	}
}

export class CLIError extends KiError {
	constructor(message: string, options?: { code?: string }) {
		super(message, { code: options?.code ?? "CLI_ERROR", exitCode: 2 });
		this.name = "CLIError";
	}
}
