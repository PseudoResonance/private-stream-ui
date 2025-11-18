import { StreamProtocol } from "..";
import { PlayerNotices } from "../../types";
import { GenericReader, PlayerState, type ReaderConf } from "../interface";

interface ICEServerList {
	urls: string[];
	username?: string;
	credential?: string;
	credentialType?: string;
}

interface SDPOffer {
	icePwd: string;
	iceUfrag: string;
	medias: string[];
}

interface WebRTCReaderConf extends ReaderConf {
	bufferLength: number | null;
	onTrack: (evt: RTCTrackEvent) => void;
}

export class WebRTCReader extends GenericReader {
	private childConf: WebRTCReaderConf;
	private peerConnection: RTCPeerConnection | null = null;
	private offerData: SDPOffer | null = null;
	private sessionUrl: string | null = null;
	private queuedCandidates: RTCIceCandidate[] = [];

	constructor(conf: WebRTCReaderConf) {
		super(conf);
		this.childConf = conf;
		this.start();
	}

	protected async start() {
		super.start();
		try {
			const servers = await this.requestICEServers();
			const sdpOffer = await this.setupPeerConnection(servers);
			const answer = await this.sendOffer(sdpOffer);
			await this.setAnswer(answer);
		} catch (err) {
			this.handleError(err);
		}
	}

	public close() {
		super.close();

		if (this.peerConnection !== null) {
			this.peerConnection.close();
		}
	}

	public static supported(): boolean {
		return true;
	}

	private async requestICEServers(): Promise<ICEServerList[]> {
		const result = await fetch(this.conf.url, {
			headers: {
				...this.authHeader(),
			},
			method: "OPTIONS",
		});
		return WebRTCReader.linkToIceServers(result.headers.get("Link"));
	}

	private static linkToIceServers(links: string | null): ICEServerList[] {
		if (links === null) {
			return [];
		}
		return links.split(", ").map((link) => {
			const m = link.match(
				/^<(.+?)>; rel="ice-server"(; username="(.*?)"; credential="(.*?)"; credential-type="password")?/i,
			);
			const ret: ICEServerList = {
				urls: [],
			};
			if (m === null) {
				return ret;
			}
			if (m[1] !== undefined) {
				ret.urls = [m[1]];
			}
			if (m[3] !== undefined) {
				ret.username = this.unquoteCredential(m[3]);
				ret.credential = this.unquoteCredential(m[4]);
				ret.credentialType = "password";
			}
			return ret;
		});
	}

	/**
	 * @param iceServers list of ICE servers
	 * @returns SDP offer string
	 */
	private async setupPeerConnection(
		iceServers: ICEServerList[],
	): Promise<string> {
		if (this.state !== PlayerState.RUNNING) {
			throw new Error(`Invalid state: ${this.state}`);
		}

		this.peerConnection = new RTCPeerConnection({
			iceServers,
			// https://webrtc.org/getting-started/unified-plan-transition-guide
			// @ts-ignore sdpSemantics not yet standard...
			sdpSemantics: "unified-plan",
		});

		const direction = "recvonly";
		this.peerConnection.addTransceiver("video", { direction });
		this.peerConnection.addTransceiver("audio", { direction });

		this.peerConnection.addEventListener("icecandidate", (evt) => {
			this.onLocalCandidate(evt);
		});
		this.peerConnection.addEventListener("connectionstatechange", () => {
			this.onConnectionState();
		});
		this.peerConnection.addEventListener("track", (evt) => {
			this.onTrack(evt);
		});

		const offer = await this.peerConnection.createOffer();

		if (offer.sdp === undefined) {
			throw new Error("SDP not present");
		}

		this.offerData = WebRTCReader.parseOffer(offer.sdp);

		await this.peerConnection.setLocalDescription(offer);
		return offer.sdp;
	}

	private static parseOffer(sdp: string): SDPOffer {
		const ret: SDPOffer = {
			icePwd: "",
			iceUfrag: "",
			medias: [],
		};

		for (const line of sdp.split("\r\n")) {
			if (line.startsWith("m=")) {
				ret.medias.push(line.slice("m=".length));
			} else if (ret.iceUfrag === "" && line.startsWith("a=ice-ufrag:")) {
				ret.iceUfrag = line.slice("a=ice-ufrag:".length);
			} else if (ret.icePwd === "" && line.startsWith("a=ice-pwd:")) {
				ret.icePwd = line.slice("a=ice-pwd:".length);
			}
		}

		return ret;
	}

	private async sendOffer(offer: string): Promise<string> {
		if (this.state !== PlayerState.RUNNING) {
			throw new Error(`Invalid state: ${this.state}`);
		}

		const res = await fetch(this.conf.url, {
			body: offer,
			headers: {
				...this.authHeader(),
				"Content-Type": "application/sdp",
			},
			method: "POST",
		});
		switch (res.status) {
			case 201:
				break;
			case 400:
			case 401:
			case 403:
			case 404:
				throw new Error(PlayerNotices.OFFLINE);
			default:
				throw new Error(`Error ${res.status}`);
		}

		const location = res.headers.get("location");
		if (location === null) {
			throw new Error("Invalid Stream Location");
		}

		this.sessionUrl = new URL(location, this.conf.url).toString();

		return res.text();
	}

	private static async filterAnswer(
		answer: string,
		protocol?: string,
	): Promise<string> {
		const ret = answer
			.split("\r\n")
			.map((line) => {
				if (line.startsWith("a=candidate")) {
					const lineSplit = line.split(" ");
					if (lineSplit[2]?.toLowerCase() !== protocol) {
						return undefined;
					}
				}
				return line;
			})
			.filter((line) => line !== undefined)
			.join("\r\n");
		return ret;
	}

	private async setAnswer(answer: string) {
		if (this.state !== PlayerState.RUNNING) {
			throw new Error(`Invalid state: ${this.state}`);
		}

		if (this.peerConnection === null) {
			throw new Error("Not Connected");
		}

		await this.peerConnection.setRemoteDescription(
			new RTCSessionDescription({
				sdp: await WebRTCReader.filterAnswer(
					answer,
					this.conf.protocol === StreamProtocol.WebRTC_TCP
						? "tcp"
						: "udp",
				),
				type: "answer",
			}),
		);

		if (this.state !== PlayerState.RUNNING) {
			return;
		}

		if (this.queuedCandidates.length !== 0) {
			this.sendLocalCandidates(this.queuedCandidates);
			this.queuedCandidates = [];
		}
	}

	private onLocalCandidate(evt: RTCPeerConnectionIceEvent) {
		if (this.state !== PlayerState.RUNNING) {
			return;
		}

		if (evt.candidate !== null) {
			if (this.sessionUrl === null) {
				this.queuedCandidates.push(evt.candidate);
			} else {
				this.sendLocalCandidates([evt.candidate]);
			}
		}
	}

	private sendLocalCandidates(candidates: RTCIceCandidate[]) {
		if (this.sessionUrl === null) {
			this.handleError(new Error("No Session URL"));
			return;
		}
		if (this.offerData === null) {
			this.handleError(new Error("No Offer Data"));
			return;
		}
		fetch(this.sessionUrl, {
			body: WebRTCReader.generateSdpFragment(
				this.offerData,
				candidates,
				this.conf.protocol === StreamProtocol.WebRTC_TCP
					? "tcp"
					: "udp",
			),
			headers: {
				"Content-Type": "application/trickle-ice-sdpfrag",
				"If-Match": "*",
			},
			method: "PATCH",
		})
			.then((res) => {
				switch (res.status) {
					case 204:
						break;
					case 404:
						throw new Error(PlayerNotices.OFFLINE);
					default:
						throw new Error(`Error ${res.status}`);
				}
			})
			.catch((err) => {
				this.handleError(err);
			});
	}

	private static generateSdpFragment(
		offerData: SDPOffer,
		candidates: RTCIceCandidate[],
		protocol?: string,
	) {
		const candidatesByMedia: { [key: string]: RTCIceCandidate[] } = {};
		for (const candidate of candidates) {
			if (protocol && candidate.protocol !== protocol) {
				continue;
			}
			const mid = candidate.sdpMLineIndex;
			if (mid === null) {
				continue;
			}
			if (candidatesByMedia[mid] === undefined) {
				candidatesByMedia[mid] = [];
			}
			candidatesByMedia[mid].push(candidate);
		}

		let frag =
			`a=ice-ufrag:${offerData.iceUfrag}\r\n` +
			`a=ice-pwd:${offerData.icePwd}\r\n`;

		let mid = 0;

		for (const media of offerData.medias) {
			if (candidatesByMedia[mid]) {
				frag += `m=${media}\r\n` + `a=mid:${mid}\r\n`;

				for (const candidate of candidatesByMedia[
					mid
				] as RTCIceCandidate[]) {
					frag += `a=${candidate.candidate}\r\n`;
				}
			}
			mid++;
		}

		return frag;
	}

	private onConnectionState() {
		if (this.state !== PlayerState.RUNNING) {
			return;
		}

		// "closed" can arrive before "failed" and without
		// The close() method being called at all.
		// It happens when the other peer sends a termination
		// Message like a DTLS CloseNotify.
		if (
			this.peerConnection?.connectionState === "failed" ||
			this.peerConnection?.connectionState === "closed"
		) {
			this.handleError(new Error("Peer Connection Closed"));
		}
	}

	private onTrack(evt: RTCTrackEvent) {
		try {
			if (
				this.childConf?.bufferLength === null ||
				this.childConf?.bufferLength >
					(evt.receiver.jitterBufferTarget ?? 0)
			) {
				evt.receiver.jitterBufferTarget =
					this.childConf?.bufferLength === null
						? null
						: Math.min(this.childConf?.bufferLength, 4000);
			}
		} catch (e) {
			console.error(e);
		}
		try {
			if (typeof this.childConf?.onTrack === "function") {
				this.childConf.onTrack(evt);
			}
		} catch (e) {
			this.handleError(new Error("Error while receiving track"));
		}
	}

	public async getStats(): Promise<unknown> {
		if (this.peerConnection) {
			return await this.peerConnection.getStats();
		}
	}

	public setBufferLength(length: number | null) {
		this.peerConnection?.getReceivers().forEach((rec) => {
			rec.jitterBufferTarget = length;
		});
	}

	public play() {
		// Not implemented
	}

	public pause() {
		// Not implemented
	}
}
