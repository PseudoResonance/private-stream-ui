import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "node:fs";

export interface ConfigOptions {
	httpPort: number;
	providerBase: string;
	webRtcPort?: number;
	hlsPort?: number;
}

export default class Config {
	public options: ConfigOptions = {
		httpPort: 8080,
		providerBase: "https://localhost",
	};

	constructor(path: string) {
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
			path = process.env.CONFIG_PATH;
		}
		if (argv.config) {
			path = argv.config;
		}
		let configFile: any;
		try {
			if (!fs.existsSync(path)) {
				console.error(`Config file does not exist at: ${path}`);
				process.exit(1);
			}
			configFile = JSON.parse(
				fs.readFileSync(path, { encoding: "utf-8" }),
			);
		} catch (e) {
			console.error(`Error while reading config file at: ${path}\n${e}`);
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
		if ("providerBase" in configFile) {
			this.options.providerBase = configFile.providerBase;
		}
		if ("webRtcPort" in configFile) {
			this.options.webRtcPort = configFile.webRtcPort;
		}
		if ("hlsPort" in configFile) {
			this.options.hlsPort = configFile.hlsPort;
		}
	}
}
