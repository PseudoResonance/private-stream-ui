import dotenv from "dotenv";
import express from "express";
import ViteExpress from "vite-express";
import { auth, requiresAuth } from "express-openid-connect";

import Config from "./config";
import type { BackendConfig, ManagementData, UserData } from "./types";
import ApiHandler from "./api";

if (process.env.NODE_ENV !== "production") {
	dotenv.config({ path: "./config.env" });
}

const watchPrefix: string = "/watch/";
const managementPrefix: string = "/management/";

const config: Config = new Config("./config.json");

const app = express();

const apiManager: ApiHandler = new ApiHandler(app, config);

if (config.options.auth) {
	console.log("Setting up authentication");
	app.use(
		auth({
			authRequired: false,
			authorizationParams: {
				response_type: "code id_token",
				scope: "openid profile email is_admin",
			},
			...config.options.auth,
		}),
	);
}

const requiresAuthWrapper = () => {
	if (config.options.auth) {
		return requiresAuth();
	}
	return (
		_req: express.Request,
		_res: express.Response,
		next: express.NextFunction,
	) => {
		next();
	};
};

app.get("/healthz", (_, res) => res.send("ok"));

apiManager.setup(requiresAuthWrapper);

ViteExpress.config({
	inlineViteConfig: {
		root: "src",
		build: { outDir: "../dist" },
	},
	transformer: (html: string, req: express.Request) => {
		const userData: UserData = {
			id: req.oidc?.user?.sub,
			name: req.oidc?.user?.name,
			username: req.oidc?.user?.preferred_username,
			admin: req.oidc?.user?.is_admin ?? false,
		};
		if (req.path.startsWith(watchPrefix)) {
			// Stream page
			const streamId = req.path.slice(watchPrefix.length);
			const query = req.query;
			const streamToken = "t" in query ? `?token=${query["t"]}` : "";
			const configObj: BackendConfig = {};
			if (config.options.webRtcPort) {
				configObj.webRtcUrl = `${config.options.providerBase}:${config.options.webRtcPort}/${streamId}/whep${streamToken}`;
			}
			if (config.options.hlsPort) {
				configObj.hlsUrl = `${config.options.providerBase}:${config.options.hlsPort}/${streamId}/index.m3u8${streamToken}`;
			}
			if (config.options.thumbnailHttpsPort) {
				configObj.thumbnailUrl = `${config.options.providerBase}:${config.options.thumbnailHttpsPort}/thumbnails/${streamId}.${config.options.thumbnailFormat ?? "webp"}${streamToken}`;
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
		} else if (req.path.startsWith(managementPrefix)) {
			// Management page
			const streamId = req.path.slice(managementPrefix.length);
			const managementData: ManagementData = {
				id: streamId.length > 0 ? streamId : undefined,
				baseUrl: config.options.serverBaseUrl,
				publishProtocols: config.options.publishProtocols,
				providerBase: new URL(config.options.providerBase).hostname,
			};
			return html.replace(
				"<!-- HEAD-META-TEMPLATE -->",
				`
				<title>${config.options.playerTitle} Management</title>
				<meta name="description" content="${config.options.playerDescription}" />
				<meta property="og:description" content="${config.options.playerDescription}" />
				<meta property="og:title" content="${config.options.playerTitle} Management" />
                <meta name="theme-color" content="${config.options.themeColor}">
                ${
					config.options.auth
						? `
                <script>
                    window.USER_DATA = ${JSON.stringify(userData)};
                    window.MANAGEMENT_DATA = ${JSON.stringify(managementData)};
                </script>
                `
						: ""
				}
			`,
			);
		} else if (
			req.path.startsWith("/") &&
			req.path.split("/").length == 2
		) {
			// Main page
			return html.replace(
				"<!-- HEAD-META-TEMPLATE -->",
				`
				<title>${config.options.playerTitle}</title>
				<meta name="description" content="${config.options.playerDescription}" />
				<meta property="og:description" content="${config.options.playerDescription}" />
				<meta property="og:title" content="${config.options.playerTitle}" />
                <meta name="theme-color" content="${config.options.themeColor}">
                ${
					config.options.auth
						? `
                <script>
                    window.USER_DATA = ${JSON.stringify(userData)};
                </script>
                `
						: ""
				}
			`,
			);
		}
		return html;
	},
});

app.use("/management", requiresAuthWrapper());

app.use((err: any, _req: any, res: any, _next: any) => {
	console.error(err);
	res.status(500).send("Internal error");
});

ViteExpress.listen(app, config.options.httpPort, () =>
	console.log(`Listening on :${config.options.httpPort}`),
);
