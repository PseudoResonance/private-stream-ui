import Hls from "hls.js";
import { GenericReader, type ReaderConf } from "../interface";

interface HLSReaderConf extends ReaderConf {
	bufferLength: number | null;
	videoElement: HTMLVideoElement;
	onTrack: (evt: RTCTrackEvent) => void;
}

export class HLSReader extends GenericReader {
	private childConf: HLSReaderConf;
	private inst: Hls | undefined = undefined;

	constructor(conf: HLSReaderConf) {
		super(conf);
		this.childConf = conf;
		this.start();
	}

	protected async start() {
		super.start();
		try {
			this.inst = new Hls();
			this.inst.on(Hls.Events.MEDIA_ATTACHED, () => {
				console.log("HLS bound to video element");
			});
			this.inst.on(Hls.Events.MANIFEST_PARSED, () => {
				console.log("HLS manifest loaded");
			});
			this.inst.loadSource(this.conf.url);
			this.childConf.videoElement.src = "";
			this.childConf.videoElement.srcObject = null;
			this.inst.attachMedia(this.childConf.videoElement);
		} catch (err) {
			this.handleError(err);
		}
	}

	public close() {
		super.close();

		this.inst?.destroy();
	}

	public static supported(): boolean {
		return Hls.isSupported();
	}

	public getStats(): Promise<unknown> {
		throw new Error("Method not implemented.");
	}

	public setBufferLength(length: number | null): void {
		throw new Error("Method not implemented.");
	}
}
