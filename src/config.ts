import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "node:fs";
import path from "node:path";

export interface ConfigOptions {
	playerTitle?: string;
	playerDescription?: string;
	themeColor?: string;
	serverBaseUrl: string;
	httpPort: number;
	providerBase: string;
	thumbnailHttpsPort?: number;
	thumbnailFormat?: string;
	webRtcPort?: number;
	hlsPort?: number;
	auth?: Record<string, unknown>;
	maxTokens?: number;
	maxPaths?: number;
	publishProtocols?: Record<string, number>;
}

export default class Config {
	private static deepMerge(...objects: Record<string, any>[]) {
		const isObject = (obj: any) => obj && typeof obj === "object";

		return objects.reduce((prev, curr) => {
			Object.keys(curr).forEach((key) => {
				const valuePrev = prev[key];
				const valueCurr = curr[key];
				if (valueCurr === undefined) {
					return;
				}
				if (isObject(valuePrev) && isObject(valueCurr)) {
					prev[key] = Config.deepMerge(valuePrev, valueCurr);
				} else {
					prev[key] = valueCurr;
				}
			});
			return prev;
		}, {});
	}

	public options: ConfigOptions = {
		playerTitle: "Live Video Player",
		playerDescription: "Video player frontend for MediaMTX",
		themeColor: "red",
		serverBaseUrl: "http://localhost",
		httpPort: 8080,
		providerBase: "https://localhost",
		maxTokens: 1,
		maxPaths: 3,
	};

	constructor(configPath: string) {
		const argv = yargs(hideBin(process.argv))
			.option("config", {
				alias: "c",
				type: "string",
				description: "Path to config file",
			})
			.option("port", {
				alias: "p",
				type: "number",
				description: "Server host port",
			})
			.option("verbose", {
				alias: "v",
				type: "count",
				description: "Verbose logging",
			})
			.parseSync();

		if (
			"CONFIG_PATH" in process.env &&
			typeof process.env.CONFIG_PATH === "string"
		) {
			configPath = process.env.CONFIG_PATH;
		}
		if (argv.config) {
			configPath = argv.config;
		}
		let configDirPath = path.join(`${configPath}.d`);
		let configFileList: string[] = [];
		try {
			if (fs.existsSync(configDirPath)) {
				configFileList = fs
					.readdirSync(configDirPath)
					.filter(
						(f) => path.extname(f).toLocaleLowerCase() === ".json",
					);
			}
		} catch (e) {
			console.error(
				`Error while reading config directory file at: ${configDirPath}\n${e}`,
			);
		}
		let configFile: any = {};
		try {
			const configExists = fs.existsSync(configPath);
			if (!configExists && configFileList.length === 0) {
				console.error(`Config file does not exist at: ${configPath}`);
				process.exit(1);
			}
			if (configExists) {
				configFile = JSON.parse(
					fs.readFileSync(configPath, { encoding: "utf-8" }),
				);
			}
		} catch (e) {
			console.error(
				`Error while reading config file at: ${configPath}\n${e}`,
			);
		}
		configFileList.sort().forEach((f) => {
			try {
				const fullPath = path.join(configDirPath, f);
				const parsed = JSON.parse(
					fs.readFileSync(fullPath, { encoding: "utf-8" }),
				);
				configFile = Config.deepMerge(configFile, parsed);
			} catch (e) {
				console.error(
					`Error while reading nested config file at: ${configPath}\n${e}`,
				);
			}
		});
		if (Object.keys(configFile).length === 0) {
			console.error(`No config options loaded from ${configPath}`);
			process.exit(1);
		}
		if ("httpPort" in configFile) {
			if (typeof configFile.httpPort === "number") {
				this.options.httpPort = configFile.httpPort;
			} else {
				console.error(`Config option httpPort is of invalid type`);
				process.exit(1);
			}
		}
		if ("HTTP_PORT" in process.env) {
			const parsed = Number.parseInt(process.env.HTTP_PORT ?? "");
			if (!Number.isNaN(parsed)) {
				this.options.httpPort = parsed;
			} else {
				console.error(
					`Environment variable HTTP_PORT is of invalid type`,
				);
				process.exit(1);
			}
		}

		// Handle config options
		if ("playerTitle" in configFile) {
			this.options.playerTitle = configFile.playerTitle;
		}
		if ("playerDescription" in configFile) {
			this.options.playerDescription = configFile.playerDescription;
		}
		if ("themeColor" in configFile) {
			this.options.themeColor = configFile.themeColor;
		}
		if ("serverBaseUrl" in configFile) {
			this.options.serverBaseUrl = configFile.serverBaseUrl;
		}
		if ("providerBase" in configFile) {
			this.options.providerBase = configFile.providerBase;
		}
		if ("thumbnailHttpsPort" in configFile) {
			this.options.thumbnailHttpsPort = configFile.thumbnailHttpsPort;
		}
		if ("thumbnailFormat" in configFile) {
			this.options.thumbnailFormat = configFile.thumbnailFormat;
		}
		if ("webRtcPort" in configFile) {
			this.options.webRtcPort = configFile.webRtcPort;
		}
		if ("hlsPort" in configFile) {
			this.options.hlsPort = configFile.hlsPort;
		}
		if ("auth" in configFile) {
			this.options.auth = configFile.auth;
		}
		if (
			"OIDC_SECRET_STRING" in process.env &&
			typeof process.env.OIDC_SECRET_STRING === "string" &&
			this.options.auth
		) {
			this.options.auth.secret = process.env.OIDC_SECRET_STRING;
		}
		if ("maxTokens" in configFile) {
			this.options.maxTokens = configFile.maxTokens;
		}
		if ("maxPaths" in configFile) {
			this.options.maxPaths = configFile.maxPaths;
		}
		if ("publishProtocols" in configFile) {
			this.options.publishProtocols = configFile.publishProtocols;
		}
	}
}
