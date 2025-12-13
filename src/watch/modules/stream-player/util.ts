import { i18n } from "../../../lang";

const prefixes: { si: string; iec: string }[] = [
	{ si: "B", iec: "B" },
	{ si: "KB", iec: "KiB" },
	{ si: "MB", iec: "MiB" },
	{ si: "GB", iec: "GiB" },
	{ si: "TB", iec: "TiB" },
	{ si: "PB", iec: "PiB" },
];

export function prettyBytes(val: number, prefix: "iec" | "si" = "iec"): string {
	if (typeof val !== "number" && !isNaN(val)) {
		return i18n("unknown");
	}
	const divisor = prefix === "si" ? 1000 : 1024;
	let i = 0;
	while (val >= divisor) {
		val /= divisor;
		++i;
	}
	let pretty: string;
	const prefixObj = prefixes[i];
	if (!prefixObj) {
		pretty = i18n("invalid");
	} else {
		pretty = `${i === 0 ? val : val.toFixed(2)}${prefixObj[prefix]}`;
	}
	return `${pretty}`;
}

/**
 * Input seconds
 */
export function prettyMilliseconds(val: number): string {
	if (typeof val !== "number" || isNaN(val)) {
		return i18n("unknown");
	}
	return `${(val * 1000).toFixed(2)}ms`;
}

export function prettyNumber(val: number): string {
	if (typeof val !== "number" && !isNaN(val)) {
		return i18n("unknown");
	}
	return String(val);
}
