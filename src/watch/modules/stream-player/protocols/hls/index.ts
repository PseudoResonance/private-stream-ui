import Hls, { ErrorTypes, type ErrorData } from "hls.js";
import { GenericReader, type ReaderConf } from "../interface";
import { StreamProtocol } from "..";
import { i18n } from "../../../../../lang";
import type { PlayerStats } from "../../types";
import { prettyBytes, prettyMilliseconds, prettyNumber } from "../../util";

interface HLSReaderConf extends ReaderConf {
	videoElement: HTMLVideoElement;
}

export class HLSReader extends GenericReader {
	private static loadTimeout: number = 5000;

	private childConf: HLSReaderConf;
	private inst: Hls | undefined = undefined;

	private loadTimer: NodeJS.Timeout | undefined = undefined;
	private statsTimer: NodeJS.Timeout | undefined = undefined;

	private statsBuffer = {
		bytesReceived: 0,
		fragsReceived: 0,
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
			if (this.childConf.statsInterval)
				this.statsTimer = setTimeout(
					this.processStats,
					this.childConf.statsInterval,
				);
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
		if (typeof this.childConf.onStats === "function") {
			const statsObj: PlayerStats = [
				{
					type: "value",
					key: "statBytesReceived",
					value: [
						prettyBytes(this.statsBuffer.bytesReceived),
						this.statsBuffer.bytesReceived,
					],
				},
				{
					type: "value",
					key: "statLatency",
					value: prettyMilliseconds(this.inst?.latency ?? 0),
				},
				{
					type: "value",
					key: "statReceived",
					value: prettyNumber(this.statsBuffer.fragsReceived),
				},
			];
			this.childConf.onStats(statsObj);
		}
		if (this.childConf.statsInterval)
			this.statsTimer = setTimeout(
				this.processStats,
				this.childConf.statsInterval,
			);
	};
}
