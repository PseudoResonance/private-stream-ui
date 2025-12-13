type Lang = Record<string, string>;

export function i18n(key: string, ...args: unknown[]): string {
	const data: Lang = (window as any).DEFAULT_I18N;
	if (key in data) {
		const str = data[key] as string;
		if (args.length === 0) {
			return str;
		} else {
			return str.replace(/{(\d+)}/g, (m, i) => {
				return args[i] ? String(args[i]) : m;
			});
		}
	}
	return `Missing Translation: ${key}`;
}
