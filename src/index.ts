import index from "./index.html";
import watch from "./watch/index.html";
import Config from "./config";
import type { ApiUrlData } from "./types";

const config: Config = new Config("./config.json");

const server = Bun.serve({
	port: config.options.httpPort,
	routes: {
		"/": index,
		"/api/urls": () => {
			const ret: ApiUrlData = { base: config.options.providerBase };
			if (config.options.webRtcPort) {
				ret.webRtcPort = config.options.webRtcPort;
			}
			if (config.options.hlsPort) {
				ret.hlsPort = config.options.hlsPort;
			}
			return Response.json(ret);
		},
		"/healthz": () => new Response("ok"),
		"/watch/:id": watch,
	},
});

console.log(`Listening on ${server.url}`);
