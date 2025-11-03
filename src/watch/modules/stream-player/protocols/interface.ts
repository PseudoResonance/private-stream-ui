import type { StreamProtocol } from ".";

export enum PlayerState {
	INITIALIZING = "Initializing",
	RUNNING = "Running",
	CLOSED = "Closed",
}

export interface ReaderConf {
	url: string;
	protocol?: StreamProtocol;
	username?: string;
	password?: string;
	token?: string;
	onError?: (err: unknown) => void;
}

export abstract class GenericReader {
	protected conf: ReaderConf;
	protected state: PlayerState = PlayerState.INITIALIZING;

	constructor(conf: ReaderConf) {
		this.conf = conf;
	}

	protected start() {
		this.state = PlayerState.RUNNING;
	}

	public close() {
		this.state = PlayerState.CLOSED;
	}

	protected handleError(err: unknown) {
		if (typeof this.conf.onError === "function") {
			this.conf.onError(err);
		}
		this.close();
	}

	protected authHeader(): { Authorization?: string } {
		if (this.conf.username) {
			const credentials = btoa(
				`${this.conf.username}:${this.conf.password}`,
			);
			return { Authorization: `Basic ${credentials}` };
		} else if (this.conf.token) {
			return { Authorization: `Bearer ${this.conf.token}` };
		}
		return {};
	}

	protected static unquoteCredential(v?: string): string {
		return JSON.parse(`"${v ?? ""}"`);
	}
}
