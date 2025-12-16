import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ _, mode }) => {
	return {
		build: {
			outDir: "../dist",
			rollupOptions: {
				input: {
					main: resolve(__dirname, "index.html"),
					management: resolve(__dirname, "management/index.html"),
					watch: resolve(__dirname, "watch/index.html"),
				},
			},
		},
		server: {
			allowedHosts: mode === "development" ? true : undefined,
		},
	};
});
