import { SQL } from "bun";
import DBSchema from "./schema";
import type { PathObjectType } from "../endpoints/paths";
import type { TokenObjectType } from "../endpoints/tokens";

export default class ApiBackend {
	private static databaseReconnectInterval = 60000;

	private _conn: SQL;
	private _setupPromise: Promise<boolean>;
	private _setupResolve: (value: boolean | PromiseLike<boolean>) => void =
		() => null;

	public apiKey: string | null = null;

	constructor() {
		// Setup connection
		this._conn = new SQL({
			hostname: process.env.DB_HOSTNAME,
			port: process.env.DB_PORT ?? 5432,
			database: process.env.DB_DATABASE,
			username: process.env.DB_USERNAME,
			password: process.env.DB_PASSWORD,

			max: parseInt(process.env.DB_MAX_CONNECTIONS ?? "") || 5,
			idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT ?? "") || 60,
			maxLifetime: parseInt(process.env.DB_MAX_LIFETIME ?? "") || 0,
			connectionTimeout:
				parseInt(process.env.DB_CONNECTION_TIMEOUT ?? "") || 10,
		});
		this._setupPromise = new Promise((resolve) => {
			this._setupResolve = resolve;
		});
		this.setup();
	}

	/**
	 * Returns a promise that will be rejected after the given interval
	 *
	 * Note that when racing a promise and the timeout, the normal promise will continue executing and must be cancelled another way if it does not have its own internal timeout.
	 *
	 * @param duration interval in milliseconds
	 * @returns Promise to be rejected
	 */
	private static async timeout(duration = 5000) {
		return new Promise((reject) => {
			setTimeout(() => {
				reject(new Error("Timeout"));
			}, duration);
		});
	}

	public async setup() {
		try {
			await DBSchema.setup(this._conn);
			const apiKey = await DBSchema.getApiKey(this._conn);
			if (apiKey === null) {
				throw new Error("Unable to fetch valid API key from database!");
			}
			this.apiKey = apiKey;
			this._setupResolve(true);
		} catch (e) {
			console.error(
				`Database setup failed! Trying again in ${ApiBackend.databaseReconnectInterval / 1000} seconds...\n`,
				e,
			);
			setTimeout(() => {
				console.log("Retrying database connection");
				this.setup();
			}, ApiBackend.databaseReconnectInterval);
		}
	}

	private async _checkDB(): Promise<void> {
		try {
			const promise = Promise.race([
				this._setupPromise,
				ApiBackend.timeout(),
			]);
			if ((await promise) !== true) {
				throw new Error("Database not ready");
			}
		} catch (e) {
			throw new Error(`Database not ready\n${e}`);
		}
	}

	public async getVersion(): Promise<string> {
		await this._checkDB();
		return DBSchema.getVersion(this._conn);
	}

	public async getPaths(paths?: string[]): Promise<PathObjectType[]> {
		await this._checkDB();
		return DBSchema.getPaths(this._conn, paths);
	}

	public async getPathsByOwner(
		owner: string,
		paths?: string[],
	): Promise<PathObjectType[]> {
		await this._checkDB();
		return DBSchema.getPathsByOwner(this._conn, owner, paths);
	}

	public async deletePathsUnsafe(paths: string[]): Promise<PathObjectType[]> {
		await this._checkDB();
		return DBSchema.deletePathsUnsafe(this._conn, paths);
	}

	public async deletePaths(
		paths: string[],
		owner: string,
	): Promise<PathObjectType[]> {
		await this._checkDB();
		return DBSchema.deletePaths(this._conn, paths, owner);
	}

	public async createPaths(
		paths: PathObjectType[],
	): Promise<PathObjectType[]> {
		await this._checkDB();
		return DBSchema.createPaths(this._conn, paths);
	}

	public async getTokensUnsafe(path: string): Promise<TokenObjectType[]> {
		await this._checkDB();
		return DBSchema.getTokensUnsafe(this._conn, path);
	}

	public async getTokens(
		path: string,
		owner: string,
	): Promise<TokenObjectType[] | null> {
		await this._checkDB();
		return DBSchema.getTokens(this._conn, path, owner);
	}

	public async deleteTokensUnsafe(
		tokens: TokenObjectType[],
	): Promise<TokenObjectType[]> {
		await this._checkDB();
		return DBSchema.deleteTokensUnsafe(this._conn, tokens);
	}

	public async deleteTokens(
		tokens: TokenObjectType[],
		owner: string,
	): Promise<TokenObjectType[]> {
		await this._checkDB();
		return DBSchema.deleteTokens(this._conn, tokens, owner);
	}

	public async createTokens(
		tokens: TokenObjectType[],
	): Promise<TokenObjectType[] | null> {
		await this._checkDB();
		return DBSchema.createTokens(this._conn, tokens);
	}
}
