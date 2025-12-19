import Hls, { ErrorTypes, type ErrorData } from "hls.js";
import { GenericReader, PlayerState, type ReaderConf } from "../interface";
import { StreamProtocol } from "..";
import { i18n } from "../../../../../lang";
import { prettyBytes, prettyMilliseconds, prettyNumber } from "../../util";
import type { PlayerStats } from "../../modules/debug/types";

interface HLSReaderConf extends ReaderConf {
	videoElement: HTMLVideoElement;
}

export class HLSReader extends GenericReader {
	private static loadTimeout: number = 5000;

	private childConf: HLSReaderConf;
	private inst: Hls | undefined = undefined;

	private loadTimer: NodeJS.Timeout | undefined = undefined;
	private statsTimer: NodeJS.Timeout | undefined = undefined;
	private bytesReceivedLast: number = 0;

	private statsBuffer = {
		bytesReceived: 0,
		fragsReceived: 0,
		lowLatency: false,
	};

	constructor(conf: HLSReaderConf) {
		super(conf);
		this.childConf = conf;
		this.start();
	}

	protected async start() {
		super.start();
		try {
			this.inst = new Hls({
				lowLatencyMode: this.conf.protocol === StreamProtocol.LL_HLS,
			});
			this.inst.on(Hls.Events.ERROR, this.onError);
			this.inst.on(Hls.Events.MEDIA_ATTACHED, () => {
				console.log("HLS bound to video element");
				this.inst?.loadSource(this.conf.url);
				this.loadTimer = setTimeout(() => {
					this.inst?.destroy();
					this.handleError(new Error(i18n("playerStateOffline")));
				}, HLSReader.loadTimeout);
			});
			this.inst.on(Hls.Events.MANIFEST_PARSED, () => {
				console.log("HLS manifest loaded");
				clearTimeout(this.loadTimer);
				this.childConf.videoElement.play();
				this.loadTimer = setTimeout(() => {
					this.inst?.destroy();
					this.handleError(new Error(i18n("playerStateOffline")));
				}, HLSReader.loadTimeout);
			});
			this.inst.on(Hls.Events.FRAG_LOADED, (_, data) => {
				if (typeof this.childConf.onStats === "function") {
					this.statsBuffer.bytesReceived += data.payload.byteLength;
					this.statsBuffer.fragsReceived += 1;
					this.statsBuffer.lowLatency = data.part !== null;
				}
			});
			this.childConf.videoElement.removeEventListener(
				"play",
				this.onPlayListener,
			);
			this.childConf.videoElement.addEventListener(
				"play",
				this.onPlayListener,
			);
			this.childConf.videoElement.pause();
			try {
				this.childConf.videoElement.src = "";
				this.childConf.videoElement.srcObject = null;
			} catch (_) {}
			this.inst.attachMedia(this.childConf.videoElement);
		} catch (err) {
			this.handleError(err);
		}
	}

	public close() {
		super.close();

		this.childConf.videoElement.removeEventListener(
			"play",
			this.onPlayListener,
		);
		clearTimeout(this.statsTimer);
		this.inst?.destroy();
	}

	public static supported(): boolean {
		return Hls.isSupported();
	}

	private onPlayListener = () => {
		if (
			this.childConf.statsInterval &&
			!this.statsTimer &&
			this.state !== PlayerState.CLOSED
		) {
			this.statsTimer = setTimeout(
				this.processStats,
				this.childConf.statsInterval,
			);
		}
		clearTimeout(this.loadTimer);
		if (typeof this.inst?.liveSyncPosition === "number")
			this.childConf.videoElement.currentTime =
				this.inst.liveSyncPosition;
	};

	private onError(e: typeof Hls.Events.ERROR, data: ErrorData) {
		if (data.fatal) {
			this.handleError(new Error(`${data.details}`));
		} else {
			switch (data.type) {
				case ErrorTypes.NETWORK_ERROR:
					if (data.networkDetails.status >= 400) {
						this.handleError(new Error(i18n("playerStateOffline")));
					}
					break;
				default:
					break;
			}
		}
		console.error(e, data);
	}

	public play() {
		if (this.inst) {
			this.inst.startLoad();
		}
	}

	public pause() {
		if (this.inst) {
			this.inst.stopLoad();
		}
	}

	private processStats = async () => {
		if (typeof this.childConf.onStats === "function" && this.debugState) {
			const bandwidth = this.childConf.statsInterval
				? ((this.statsBuffer.bytesReceived - this.bytesReceivedLast) *
						8) /
					(this.childConf.statsInterval / 1000)
				: 0;
			this.bytesReceivedLast = this.statsBuffer.bytesReceived;
			const level = this.inst?.levels[this.inst.currentLevel];
			const statsObj: PlayerStats = [
				{
					type: "value",
					id: "statBytesReceived",
					key: "statBytesReceived",
					value: `${prettyBytes(this.statsBuffer.bytesReceived, "iec")} (${this.statsBuffer.bytesReceived}B)`,
				},
				{
					type: "graph",
					id: "statBandwidth",
					key: "statBandwidth",
					history: [],
					graphColor: "red",
					backgroundColor: "black",
					value: bandwidth,
					valueString: prettyBytes(bandwidth, "iec_bits_per_second"),
				},
				{
					type: "graph",
					id: "statLatency",
					key: "statLatency",
					history: [],
					graphColor: "red",
					backgroundColor: "black",
					stdDevScale: true,
					value: this.inst?.latency ?? 0,
					valueString: prettyMilliseconds(this.inst?.latency ?? 0),
				},
				{
					type: "value",
					id: "statProtocol",
					key: "statProtocol",
					value: `HLS${this.statsBuffer.lowLatency ? " Low Latency" : ""}`,
				},
				{
					type: "value",
					id: "statCodec",
					key: "statCodec",
					value: `${level?.videoCodec ?? i18n("unknown")} ${level?.audioCodec ?? i18n("unknown")}`,
				},
				{
					type: "value",
					id: "statFragments",
					key: "statFragments",
					value: i18n(
						"receivedCount",
						prettyNumber(this.statsBuffer.fragsReceived),
					),
				},
			];
			this.childConf.onStats(statsObj);
		}
		if (this.childConf.statsInterval && this.state !== PlayerState.CLOSED)
			this.statsTimer = setTimeout(
				this.processStats,
				this.childConf.statsInterval,
			);
	};

	//TODO better codec validation
	//https://tools.axinom.com/capabilities/media
	private static codecMap: Record<string, MediaDecodingConfiguration> = {
		h264: {
			type: "media-source",
			video: {
				contentType: `video/mp4; codecs="avc1.4d002a"`,
				width: 640,
				height: 480,
				framerate: 30,
				bitrate: 2000,
			},
		},
		h265: {
			type: "media-source",
			video: {
				contentType: `video/mp4; codecs="hvc1.1.6.L30"`,
				width: 640,
				height: 480,
				framerate: 30,
				bitrate: 2000,
			},
		},
		vp8: {
			type: "media-source",
			video: {
				contentType: `video/webm; codecs="vp8"`,
				width: 640,
				height: 480,
				framerate: 30,
				bitrate: 2000,
			},
		},
		vp9: {
			type: "media-source",
			video: {
				contentType: `video/webm; codecs="vp9"`,
				width: 640,
				height: 480,
				framerate: 30,
				bitrate: 2000,
			},
		},
		av1: {
			type: "media-source",
			video: {
				contentType: `video/webm; codecs="av1"`,
				width: 640,
				height: 480,
				framerate: 30,
				bitrate: 2000,
			},
		},
		opus: {
			type: "media-source",
			audio: {
				contentType: `audio/mp4; codecs=opus`,
				bitrate: 100,
			},
		},
		"mpeg-4 audio": {
			type: "media-source",
			audio: {
				contentType: `audio/mp4; codecs="mp4a.40.2"`,
				bitrate: 100,
			},
		},
	};

	public static async listSupportedProtocols(
		codecs: string[],
	): Promise<StreamProtocol[]> {
		const ret = [StreamProtocol.HLS, StreamProtocol.LL_HLS];
		if (codecs.length === 0) {
			return ret;
		}
		let videoSupported = false;
		let audioSupported = false;
		const codecsOptions = codecs
			.map((v) => {
				v = v.toLocaleLowerCase();
				if (v in HLSReader.codecMap) {
					return HLSReader.codecMap[v];
				}
				console.error(`Unknown codec ${v}`);
				return undefined;
			})
			.filter((v) => v !== undefined);
		for (const codec of codecsOptions) {
			const res = await navigator.mediaCapabilities.decodingInfo(codec);
			if (res.supported) {
				if (codec.audio) {
					audioSupported = true;
				} else if (codec.video) {
					videoSupported = true;
				}
			}
		}
		if (audioSupported && videoSupported) {
			return ret;
		}
		return [];
	}
}
