import { WebRTCReader } from "./webrtc/index.ts";
import { fetchUrls } from "./backend.ts";
import type { ApiUrlData } from "../../../../types.ts";
import type { GenericReader } from "./interface.ts";

export enum StreamProtocol {
	WebRTCTCP = "webrtc-tcp",
	WebRTCUDP = "webrtc-udp",
}

const defaultProtocol = StreamProtocol.WebRTCUDP;

export function streamProtocolFromString(
	protocol: string | undefined | null,
): StreamProtocol {
	if (
		protocol &&
		(Object.values(StreamProtocol) as string[]).includes(protocol)
	) {
		return protocol as StreamProtocol;
	} else {
		return defaultProtocol;
	}
}

export class StreamReader {
	private streamProtocol: StreamProtocol = defaultProtocol;

	private streamUrl: string = "";

	private reader: GenericReader | undefined = undefined;

	constructor() {}

	public async setup(streamProtocol: StreamProtocol) {
		this.streamProtocol = streamProtocol;
		let urls: ApiUrlData | undefined = undefined;
		try {
			urls = await fetchUrls();
		} catch (e) {
			throw { message: "Unable to fetch URLs from API", error: e };
		}

		const videoId = window.location.pathname.split("/").slice(1).at(-1);
		if (videoId === undefined) {
			throw new Error("Unable to determine video ID from URL");
		}
		console.log(`Fetching stream {${videoId}}`);

		try {
			this.streamUrl = this.formUrl(urls, videoId, this.streamProtocol);
		} catch (e) {
			throw { message: "Unable to form backend URL", error: e };
		}
	}

	public async start(
		video: HTMLVideoElement,
		onError: (err: unknown) => void,
	) {
		this.reader = new WebRTCReader({
			url: this.streamUrl,
			protocol: this.streamProtocol,
			onError: onError,
			onTrack: (evt: unknown) => {
				video.srcObject = (evt as RTCTrackEvent)
					.streams[0] as MediaProvider;
			},
		});
	}

	private formUrl(
		urlData: ApiUrlData,
		videoId: string,
		protocol: StreamProtocol,
	) {
		switch (protocol) {
			case StreamProtocol.WebRTCTCP:
			case StreamProtocol.WebRTCUDP:
				return `${urlData.base}:${urlData.webRtcPort}/${videoId}/whep`;
			default:
				throw new Error(`Unknown protocol ${protocol}`);
		}
	}

	public close() {
		if (this.reader) {
			this.reader.close();
		}
	}
}
