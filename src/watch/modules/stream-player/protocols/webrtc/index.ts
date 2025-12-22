import { StreamProtocol } from "..";
import { i18n } from "../../../../../lang";
import type { PlayerStats } from "../../modules/debug/types";
import { prettyBytes, prettyMilliseconds, prettyNumber } from "../../util";
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

interface SDPOfferMedia {
	id: string;
	type: string;
	ssrc: string;
	codec: string;
}

interface SDPOfferData {
	[key: string]: SDPOfferMedia;
}

interface WebRTCReaderConf extends ReaderConf {
	onTrack: (evt: RTCTrackEvent) => void;
}

export class WebRTCReader extends GenericReader {
	private childConf: WebRTCReaderConf;
	private peerConnection: RTCPeerConnection | null = null;
	private offerData: SDPOffer | null = null;
	private sessionUrl: string | null = null;
	private queuedCandidates: RTCIceCandidate[] = [];
	/**
	 * Offer data for each media type, organized by ID
	 */
	private sdpOfferData: SDPOfferData | null = null;

	private statsTimer: NodeJS.Timeout | undefined = undefined;
	private bytesReceivedLast: number = 0;

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
		clearTimeout(this.statsTimer);
	}

	public static supported(): boolean {
		if ("RTCRtpReceiver" in window) {
			return true;
		}
		return false;
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
			throw new Error(i18n("invalidState", this.state));
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
			throw new Error(i18n("sdpMissing"));
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
			throw new Error(i18n("invalidState", this.state));
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
				throw new Error(i18n("playerStateOffline"));
			default:
				throw new Error(i18n("error", res.status));
		}

		const location = res.headers.get("location");
		if (location === null) {
			throw new Error(i18n("streamLocationInvalid"));
		}

		this.sessionUrl = new URL(location, this.conf.url).toString();

		return res.text();
	}

	private static async filterAnswer(
		answer: string,
		protocol?: StreamProtocol,
	): Promise<string> {
		if (protocol === StreamProtocol.WebRTC) {
			// Skip for general WebRTC
			return answer;
		}
		const protocolStr =
			protocol === StreamProtocol.WebRTC_TCP ? "tcp" : "udp";
		const ret = answer
			.split("\r\n")
			.map((line) => {
				if (line.startsWith("a=candidate")) {
					const lineSplit = line.split(" ");
					if (lineSplit[2]?.toLowerCase() !== protocolStr) {
						return undefined;
					}
				}
				return line;
			})
			.filter((line) => line !== undefined)
			.join("\r\n");
		return ret;
	}

	private async parseAnswer(answer: string) {
		const data: SDPOfferData = {};
		let media: SDPOfferMedia | null = null;
		for (const line of answer.split("\r\n")) {
			if (!media && !line.startsWith("m=")) {
				continue;
			} else if (line.startsWith("m=")) {
				const split = line.slice(2).split(" ");
				if (split.length < 4) {
					console.error(
						`Unable to parse media description "${line}"`,
					);
					continue;
				}
				media = {
					id: split[3] as string,
					type: split[0] as string,
					ssrc: "",
					codec: "",
				};
				data[media.id] = media;
			} else if (media && line.startsWith("a=")) {
				const attribute = line.slice(2);
				if (attribute.startsWith(`rtpmap:${media.id}`)) {
					const split = attribute.split(" ");
					if (split.length < 2) {
						console.error(`Unable to parse media codec "${line}"`);
						continue;
					}
					media.codec = split[1] as string;
				} else if (attribute.startsWith("ssrc:")) {
					const split = attribute.slice("ssrc:".length).split(" ");
					if (split.length < 1) {
						console.error(`Unable to parse media SSRC "${line}"`);
						continue;
					}
					media.ssrc = split[0] as string;
				}
			}
		}
		this.sdpOfferData = data;
	}

	private async setAnswer(answer: string) {
		if (this.state !== PlayerState.RUNNING) {
			throw new Error(i18n("invalidState", this.state));
		}

		if (this.peerConnection === null) {
			throw new Error(i18n("notConnected"));
		}

		await this.parseAnswer(answer);

		await this.peerConnection.setRemoteDescription(
			new RTCSessionDescription({
				sdp: await WebRTCReader.filterAnswer(
					answer,
					this.conf.protocol,
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
			this.handleError(new Error(i18n("sessionUrlMissing")));
			return;
		}
		if (this.offerData === null) {
			this.handleError(new Error(i18n("offerDataMissing")));
			return;
		}
		fetch(this.sessionUrl, {
			body: WebRTCReader.generateSdpFragment(
				this.offerData,
				candidates,
				this.conf.protocol,
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
						throw new Error(i18n("playerStateOffline"));
					default:
						throw new Error(i18n("error", res.status));
				}
			})
			.catch((err) => {
				this.handleError(err);
			});
	}

	private static generateSdpFragment(
		offerData: SDPOffer,
		candidates: RTCIceCandidate[],
		protocol?: StreamProtocol,
	) {
		const validProtocols = [];
		switch (protocol) {
			case StreamProtocol.WebRTC:
				validProtocols.push("tcp");
				validProtocols.push("udp");
				break;
			case StreamProtocol.WebRTC_TCP:
				validProtocols.push("tcp");
				break;
			case StreamProtocol.WebRTC_UDP:
				validProtocols.push("udp");
				break;
			default:
				throw new Error(`Invalid protocol ${protocol}`);
		}
		const candidatesByMedia: { [key: string]: RTCIceCandidate[] } = {};
		for (const candidate of candidates) {
			if (validProtocols.includes(candidate.protocol as string)) {
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
			this.handleError(new Error(i18n("peerConnectionClosed")));
		}
	}

	private onTrack(evt: RTCTrackEvent) {
		if (
			this.childConf.statsInterval &&
			this.state !== PlayerState.CLOSED &&
			!this.statsTimer
		) {
			this.statsTimer = setTimeout(
				this.processStats,
				this.childConf.statsInterval,
			);
		}
		try {
			if (typeof this.childConf?.onTrack === "function") {
				this.childConf.onTrack(evt);
			}
		} catch (e) {
			this.handleError(new Error(i18n("errorReceivingTrack")));
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

	private processStats = async () => {
		if (typeof this.childConf.onStats === "function" && this.debugState) {
			try {
				let stats;
				if (this.peerConnection) {
					try {
						stats = await this.peerConnection.getStats();
					} catch (_) {}
				}
				if (stats) {
					if (
						typeof stats === "object" &&
						stats.constructor.name === "RTCStatsReport"
					) {
						let jitterArr: number[] = [];
						let jitterBufferArr: number[] = [];
						let bytesReceived = 0;
						let packetsReceived = 0;
						let packetsDiscarded = 0;
						let packetsLost = 0;
						let localCandidateId = "";
						let videoCodec = "";
						let audioCodec = "";
						(stats as RTCStatsReport).forEach(async (entry) => {
							if (entry.type === "inbound-rtp") {
								bytesReceived += WebRTCReader.safeNumber(
									entry.bytesReceived,
								);
								if ("jitter" in entry && !isNaN(entry.jitter)) {
									jitterArr.push(entry.jitter);
								}
								if (
									"jitterBufferTargetDelay" in entry &&
									!isNaN(entry.jitterBufferTargetDelay) &&
									"jitterBufferEmittedCount" in entry &&
									!isNaN(entry.jitterBufferEmittedCount) &&
									entry.jitterBufferEmittedCount !== 0
								) {
									jitterBufferArr.push(
										Math.max(
											entry.jitterBufferTargetDelay,
											0,
										) / entry.jitterBufferEmittedCount,
									);
								}
								packetsReceived += Math.max(
									WebRTCReader.safeNumber(
										entry.packetsReceived,
									),
									0,
								);
								packetsDiscarded += Math.max(
									WebRTCReader.safeNumber(
										entry.packetsDiscarded,
									),
									0,
								);
								packetsLost += Math.max(
									WebRTCReader.safeNumber(entry.packetsLost),
									0,
								);
								if ("ssrc" in entry && this.sdpOfferData) {
									for (const media of Object.values(
										this.sdpOfferData,
									)) {
										if (media.ssrc === String(entry.ssrc)) {
											switch (media.type) {
												case "video":
													videoCodec = media.codec;
													break;
												case "audio":
													audioCodec = media.codec;
													break;
												default:
													console.error(
														`Unsupported SDP offer codec ${media.type}`,
													);
													break;
											}
										}
									}
								}
							} else if (entry.type === "candidate-pair") {
								if ("selected" in entry) {
									if (entry.selected) {
										localCandidateId =
											entry.localCandidateId;
									}
								} else if (
									"currentRoundTripTime" in entry &&
									"nominated" in entry
								) {
									if (
										entry.currentRoundTripTime > 0 &&
										entry.nominated
									) {
										localCandidateId =
											entry.localCandidateId;
									}
								} else if ("writable" in entry) {
									if (entry.writable) {
										localCandidateId =
											entry.localCandidateId;
									}
								}
							}
						});
						let protocol = stats.get(localCandidateId)?.protocol;
						if (protocol === "udp") {
							protocol = "UDP";
						} else if (protocol === "tcp") {
							protocol = "TCP";
						} else {
							protocol = i18n("unknown");
						}
						const latency =
							jitterBufferArr.reduce((a, b) => a + b, 0) /
							jitterBufferArr.length;
						const jitter =
							jitterArr.reduce((a, b) => a + b, 0) /
							jitterArr.length;
						const bandwidth = this.childConf.statsInterval
							? ((bytesReceived - this.bytesReceivedLast) * 8) /
								(this.childConf.statsInterval / 1000)
							: 0;
						this.bytesReceivedLast = bytesReceived;
						const statsObj: PlayerStats = [
							{
								type: "value",
								id: "statBytesReceived",
								key: "statBytesReceived",
								value: `${prettyBytes(bytesReceived, "iec")} (${bytesReceived ?? 0}B)`,
							},
							{
								type: "graph",
								id: "statBandwidth",
								key: "statBandwidth",
								history: [],
								graphColor: "red",
								backgroundColor: "black",
								value: bandwidth,
								valueString: prettyBytes(
									bandwidth,
									"iec_bits_per_second",
								),
							},
							{
								type: "graph",
								id: "statLatency",
								key: "statLatency",
								history: [],
								stdDevScale: true,
								graphColor: "red",
								backgroundColor: "black",
								value: latency,
								valueString: prettyMilliseconds(latency),
							},
							{
								type: "graph",
								id: "statJitter",
								key: "statJitter",
								history: [],
								stdDevScale: true,
								graphColor: "red",
								backgroundColor: "black",
								value: jitter,
								valueString: prettyMilliseconds(jitter),
							},
							{
								type: "value",
								id: "statProtocol",
								key: "statProtocol",
								value: `WebRTC ${protocol}`,
							},
							{
								type: "value",
								id: "statCodec",
								key: "statCodec",
								value: `${videoCodec ?? i18n("unknown")} ${audioCodec ?? i18n("unknown")}`,
							},
							{
								type: "value",
								id: "statPackets",
								key: "statPackets",
								value: i18n(
									"packetReceivedDiscardedLostCount",
									prettyNumber(packetsReceived),
									prettyNumber(packetsDiscarded),
									prettyNumber(packetsLost),
								),
							},
						];
						this.childConf.onStats(statsObj);
					}
				}
			} catch (e) {
				console.error("Error while fetching stats", e);
			}
		}
		if (this.childConf.statsInterval && this.state !== PlayerState.CLOSED)
			this.statsTimer = setTimeout(
				this.processStats,
				this.childConf.statsInterval,
			);
	};

	private static safeNumber(val: number | undefined | null) {
		if (typeof val === "number" && !isNaN(val)) return val;
		return 0;
	}

	private static codecMap: Record<string, string> = {
		h264: "video/h264",
		h265: "video/h265",
		vp8: "video/vp8",
		vp9: "video/vp9",
		av1: "video/av1",
		opus: "audio/opus",
		"mpeg-4 audio": "audio/mp4",
	};

	public static async listSupportedProtocols(
		codecs: string[],
	): Promise<StreamProtocol[]> {
		const ret = [
			StreamProtocol.WebRTC,
			StreamProtocol.WebRTC_TCP,
			StreamProtocol.WebRTC_UDP,
		];
		if (codecs.length === 0) {
			return ret;
		}
		let videoSupported = false;
		let audioSupported = false;
		codecs = codecs
			.map((v) => {
				v = v.toLocaleLowerCase();
				if (v in WebRTCReader.codecMap) {
					return WebRTCReader.codecMap[v];
				}
				console.error(`Unknown codec ${v}`);
				return undefined;
			})
			.filter((v) => v !== undefined);
		for (const codec of RTCRtpReceiver.getCapabilities("video")?.codecs ??
			[]) {
			if (codecs.includes(codec.mimeType.toLocaleLowerCase())) {
				videoSupported = true;
				break;
			}
		}
		for (const codec of RTCRtpReceiver.getCapabilities("audio")?.codecs ??
			[]) {
			if (codecs.includes(codec.mimeType.toLocaleLowerCase())) {
				audioSupported = true;
				break;
			}
		}
		if (audioSupported && videoSupported) {
			return ret;
		}
		return [];
	}
}
