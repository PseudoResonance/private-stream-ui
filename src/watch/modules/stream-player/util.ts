import { i18n } from "../../../lang";

const prefixes: {
	si: string;
	iec: string;
	si_bits_per_second: string;
	iec_bits_per_second: string;
}[] = [
	{
		si: "B",
		iec: "B",
		si_bits_per_second: "b/s",
		iec_bits_per_second: "b/s",
	},
	{
		si: "KB",
		iec: "KiB",
		si_bits_per_second: "Kb/s",
		iec_bits_per_second: "Kib/s",
	},
	{
		si: "MB",
		iec: "MiB",
		si_bits_per_second: "Mb/s",
		iec_bits_per_second: "Mib/s",
	},
	{
		si: "GB",
		iec: "GiB",
		si_bits_per_second: "Gb/s",
		iec_bits_per_second: "Gib/s",
	},
	{
		si: "TB",
		iec: "TiB",
		si_bits_per_second: "Tb/s",
		iec_bits_per_second: "Tib/s",
	},
	{
		si: "PB",
		iec: "PiB",
		si_bits_per_second: "Pb/s",
		iec_bits_per_second: "Pib/s",
	},
];

export function prettyBytes(
	val: number,
	prefix: "iec" | "si" | "iec_bits_per_second" | "si_bits_per_second" = "iec",
): string {
	if (typeof val !== "number" && !isNaN(val)) {
		return i18n("unknown");
	}
	const divisor = prefix === "si" || "si_bits_per_second" ? 1000 : 1024;
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
		pretty = `${(prefix === "iec" || prefix === "si") && i === 0 ? val : val.toFixed(2)}${prefixObj[prefix]}`;
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
