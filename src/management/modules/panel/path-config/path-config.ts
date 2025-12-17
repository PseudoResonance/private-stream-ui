import { html, css, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { TokenObjectType } from "../../../../api/endpoints/tokens";
import { Byte, Encoder } from "@nuintun/qrcode";

@customElement("path-config")
export class PathConfig extends LitElement {
	constructor() {
		super();
	}

	connectedCallback() {
		super.connectedCallback();
		this.fetchTokens();
	}

	@property()
	public baseUrl: string = "";

	@property()
	public id: string = "";

	@property()
	public publishProtocols: Record<string, number> = {};

	@property()
	public providerBaseUrl: string = "";

	@property()
	public thumbnailUrlNoToken: string = "";

	@state()
	private tokens: TokenObjectType[] = [];

	@state()
	private publishUrls: { type: string; url: string }[] = [];

	@state()
	private previewUrl: string = "";

	@state()
	private qrCodeUrl: string = "";

	@state()
	private thumbnailUrl: string = "";

	@state()
	private previewActive: boolean = false;

	@state()
	private qrActive: boolean = false;

	private async fetchTokens() {
		if (this.id.length === 0) {
			return;
		}
		const data = await fetch(`/api/v1/token?path=${this.id}`, {
			method: "GET",
		});
		if (data.status !== 200) {
			throw new Error(
				`${data.status}: ${data.statusText} when fetching data!\n${data}`,
			);
		}
		this.tokens = (
			(await (data.json() as any)).data.data as TokenObjectType[]
		).sort((a, b) => {
			if (a.action !== b.action) {
				if (a.action === "publish") {
					return -1;
				} else if (b.action === "publish") {
					return 1;
				}
			}
			return 0;
		});
		let gotPublish = false;
		let gotRead = false;
		this.tokens.find((token) => {
			if (token.action === "publish" && !gotPublish) {
				this.constructPublishUrls(this.id, token.querytoken as string);
				gotPublish = true;
			} else if (token.action === "read" && !gotRead) {
				this.previewUrl = this.constructWatchUrl(
					this.id,
					token.querytoken as string,
				);
				const qrEncoder = new Encoder({
					level: "M",
				});
				const qr = qrEncoder.encode(new Byte(this.previewUrl));
				this.qrCodeUrl = qr.toDataURL();
				this.thumbnailUrl = this.constructThumbnailUrl(
					token.querytoken as string,
				);
				gotRead = true;
			}
			if (gotPublish && gotRead) {
				return true;
			}
		});
	}

	private constructThumbnailUrl(token: string) {
		return new URL(`${this.thumbnailUrlNoToken}?token=${token}`).toString();
	}

	private constructWatchUrl(id: string, token: string) {
		return new URL(`${this.baseUrl}/watch/${id}?t=${token}`).toString();
	}

	private constructPublishUrls(id: string, token: string) {
		const urls: { type: string; url: string }[] = [];
		Object.entries(this.publishProtocols).forEach(([k, v]) => {
			let url = "";
			switch (k) {
				case "srt":
					url = `${k}://${this.providerBaseUrl}:${v}/?streamid=publish:${id}:::token=${token}`;
					break;
				case "webrtc":
				case "webrtcSecure":
					url = `${k === "webrtc" ? "http" : "https"}://${this.providerBaseUrl}:${v}/${id}/whip?token=${token}`;
					break;
				case "rtsp":
				case "rtsps":
				case "rtmp":
				case "rtmps":
					url = `${k}://${this.providerBaseUrl}:${v}/${id}?token=${token}`;
					break;
			}
			urls.push({ type: k.toLocaleUpperCase(), url });
		});
		this.publishUrls = urls.sort((a, b) => a.type.localeCompare(b.type));
	}

	static styles = css`
		h1,
		h2,
		h3,
		h4,
		h5,
		h6 {
			margin: 0;
		}
		:host {
			display: flex;
			flex-direction: column;
			gap: 1cm;
		}
		.wrapper {
			display: flex;
			flex-direction: row;
			flex-wrap: wrap;
			justify-content: center;
			gap: 1cm;
		}
		.primary,
		.sidebar {
			display: flex;
			flex-direction: column;
		}
		.streamPreview {
			background-color: black;
		}
		.streamPreviewThumbnail {
			background-color: black;
			background-repeat: no-repeat;
			background-position: center;
			background-size: contain;
		}
		.streamPreviewPlaceholder,
		.qrCodePlaceholder {
			display: flex;
			justify-content: center;
			align-items: center;
			background-color: rgba(0, 0, 0, 0.5);
			color: white;
			pointer-events: initial;
			touch-action: initial;
			border: none;
			font-family: inherit;
			font-size: x-large;
			padding: 0;
			margin: 0;
			text-transform: none;
			cursor: pointer;
			border: solid thin var(--fg-primary-color);
		}
		.streamPreviewPlaceholder,
		.qrCodePlaceholder,
		[type="button"],
		[type="reset"],
		[type="submit"] {
			-webkit-appearance: button;
		}
		.streamPreview {
			border: solid thin var(--fg-primary-color);
		}
		.qrCodePlaceholder {
			width: 100%;
			height: 100%;
			background-color: black;
		}
		.qrCode {
			width: 100%;
			height: 100%;
			image-rendering: pixelated;
			image-rendering: -moz-crisp-edges;
			image-rendering: crisp-edges;
		}
	`;

	private getPreviewTemplate() {
		if (this.previewUrl.length > 0) {
			if (this.previewActive) {
				return html`<div class="sidebar">
					<iframe
						class="streamPreview"
						title="Stream Preview"
						width="300"
						height="200"
						allowtransparency="true"
						src="${this.previewUrl}&mute&embed"
					>
					</iframe>
				</div>`;
			} else {
				let thumbnail =
					this.thumbnailUrl.length > 0
						? `background-image:url('${this.thumbnailUrl}');`
						: "";
				return html`<div class="sidebar">
					<div
						class="streamPreviewThumbnail"
						style="width:300px;height:200px;${thumbnail}"
					>
						<button
							class="streamPreviewPlaceholder"
							style="width:300px;height:200px;"
							@click="${() => {
								this.previewActive = true;
							}}"
						>
							Click for Preview
						</button>
					</div>
				</div>`;
			}
		}
		return html``;
	}

	private getWatchQRCode() {
		if (this.qrCodeUrl.length > 0) {
			let inner;
			if (this.qrActive) {
				inner = html`<img
					src="${this.qrCodeUrl}"
					alt="QR code to watch page"
					class="qrCode"
				/>`;
			} else {
				inner = html`<button
					class="qrCodePlaceholder"
					@click="${() => {
						this.qrActive = true;
					}}"
				>
					Click to Generate
				</button>`;
			}
			return html`<div class="sidebar">
				<h3>QR Code</h3>
				<div style="width:200px;height:200px;">${inner}</div>
			</div>`;
		}
		return html``;
	}

	render() {
		return html`<h3>
				Stream
				<span
					style='font-family:"Google Sans Code", "Lucida Console", "Courier New", monospace'
				>
					${this.id}
				</span>
				<table-button
					@click="${async () => {
						const deleteRes = await fetch(
							`/api/v1/path?paths=${this.id}`,
							{
								method: "DELETE",
							},
						);
						if (deleteRes.status !== 200) {
							throw new Error(
								`${deleteRes.status}: ${deleteRes.statusText} when deleting stream path!\n${deleteRes}`,
							);
						} else {
							// A strange hack to parse the pathname a bit more accurately...
							window.location.href = new URL(
								window.location.pathname + "/../",
								"http://localhost",
							).pathname;
						}
					}}"
					style="--bg-color: var(--bg-danger-color); --bg-color-hover: var(--bg-danger-color-hover); --fg-color: var(--fg-danger-color); height: 1.75lh; display: inline-block;"
				>
					Delete
				</table-button>
			</h3>
			<div class="wrapper">
				<div class="primary">
					<grid-table
						.columns="${[
							{
								name: "Type",
								key: "action",
								size: "auto",
								transform: (val: string) => {
									if (val === "read") return "Read";
									else if (val === "publish")
										return "Publish";
									else return val;
								},
							},
							{
								name: "Token",
								key: "querytoken",
								size: "auto",
								style: `font-family:"Google Sans Code", "Lucida Console", "Courier New", monospace`,
								transform: (val: string) => {
									return (
										val.slice(0, 5) + "..." + val.slice(-5)
									);
								},
							},
							{
								name: "Copy",
								style: `padding: 0`,
								generate: (row: Record<string, unknown>) => {
									if (row.action === "read") {
										return html`
											<table-button
												@click="${() => {
													navigator.clipboard.writeText(
														this.constructWatchUrl(
															this.id,
															row.querytoken as string,
														),
													);
												}}"
												style="--bg-color: var(--bg-ok-color); --bg-color-hover: var(--bg-ok-color-hover); --fg-color: var(--fg-ok-color);"
											>
												Copy Watch URL
											</table-button>
										`;
									}
									return html``;
								},
								size: "auto",
							},
							{
								name: "Regenerate",
								style: `padding: 0`,
								generate: (row: Record<string, unknown>) => {
									return html`
										<table-button
											@click="${async () => {
												const deleteRes = await fetch(
													`/api/v1/token/delete`,
													{
														method: "POST",
														headers: {
															"Content-Type":
																"application/json; charset=utf-8",
														},
														body: JSON.stringify({
															path: this.id,
															tokens: [row],
														}),
													},
												);
												if (deleteRes.status !== 200) {
													throw new Error(
														`${deleteRes.status}: ${deleteRes.statusText} when deleting stream token!\n${deleteRes}`,
													);
												}
												const tokenData = await fetch(
													"/api/v1/privatetoken",
													{
														method: "POST",
														headers: {
															"Content-Type":
																"application/json; charset=utf-8",
														},
														body: JSON.stringify({
															path: this.id,
															action: row.action,
														}),
													},
												);
												if (tokenData.status !== 200) {
													throw new Error(
														`${tokenData.status}: ${tokenData.statusText} when creating stream token!\n${tokenData}`,
													);
												}
												this.fetchTokens();
											}}"
											style="--bg-color: var(--bg-danger-color); --bg-color-hover: var(--bg-danger-color-hover); --fg-color: var(--fg-danger-color);"
										>
											Regenerate Key
										</table-button>
									`;
								},
								size: "auto",
							},
						]}"
						.data="${this.tokens}"
						tableTitle="Access Tokens"
						showHeader
						showTitle
					>
					</grid-table>
				</div>
				<div class="sidebar">
					<grid-table
						.columns="${[
							{
								name: "Type",
								key: "type",
								size: "auto",
							},
							{
								name: "Copy",
								key: "url",
								style: `padding: 0`,
								transform: (url: string) => {
									return html`
										<table-button
											@click="${() => {
												navigator.clipboard.writeText(
													url,
												);
											}}"
											style="--bg-color: var(--bg-ok-color); --bg-color-hover: var(--bg-ok-color-hover); --fg-color: var(--fg-ok-color);"
										>
											Copy URL
										</table-button>
									`;
								},
								size: "auto",
							},
						]}"
						.data="${this.publishUrls}"
						tableTitle="Publish URLs"
						showTitle
					>
					</grid-table>
				</div>
				${this.getPreviewTemplate()}${this.getWatchQRCode()}
			</div>`;
	}
}

declare global {
	interface HTMLElementPathConfig {
		"path-config": PathConfig;
	}
}
