import express from "express";
import ViteExpress from "vite-express";

import Config from "./config";
import type { BackendConfig } from "./types";

const config: Config = new Config("./config.json");

const watchPrefix: string = "/watch/";

const app = express();

app.get("/healthz", (_, res) => res.send("ok"));

ViteExpress.config({
	inlineViteConfig: {
		root: "src",
		build: { outDir: "../dist" },
	},
	transformer: (html: string, req: express.Request) => {
		if (req.path.startsWith(watchPrefix)) {
			const streamId = req.path.slice(watchPrefix.length);
			const configObj: BackendConfig = {};
			if (config.options.webRtcPort) {
				configObj.webRtcUrl = `${config.options.providerBase}:${config.options.webRtcPort}/${streamId}/whep`;
			}
			if (config.options.hlsPort) {
				configObj.hlsUrl = `${config.options.providerBase}:${config.options.hlsPort}/${streamId}/index.m3u8`;
			}
			if (config.options.thumbnailHttpsPort) {
				configObj.thumbnailUrl = `${config.options.providerBase}:${config.options.thumbnailHttpsPort}/thumbnails/${streamId}.${config.options.thumbnailFormat ?? "webp"}`;
			}
			return html.replace(
				"<!-- HEAD-META-TEMPLATE -->",
				`
				<title>${config.options.playerTitle}</title>
				<meta name="description" content="${config.options.playerDescription}" />
				<meta property="og:description" content="${config.options.playerDescription}" />
				<meta property="og:title" content="${config.options.playerTitle}" />
				<meta property="og:type" content="video.other" />
                <meta name="theme-color" content="${config.options.themeColor}">
                ${configObj.thumbnailUrl ? `<meta property="og:image" content="${configObj.thumbnailUrl}" />` : ""}
                <script>
                    window.REMOTE_CONFIG = ${JSON.stringify(configObj)};
                </script>
			`,
			);
		}
		return html;
	},
});

ViteExpress.listen(app, config.options.httpPort, () =>
	console.log(`Listening on :${config.options.httpPort}`),
);
