import type { ApiUrlData } from "../../../../types";

export async function fetchUrls(): Promise<ApiUrlData> {
	let urls = {};
	const apiUrl = new URL("api/urls", window.location.origin);
	const result = await fetch(apiUrl);
	if (result) {
		urls = await result.json();
		return urls as ApiUrlData;
	}
	throw new Error("Unable to fetch API URLs");
}
