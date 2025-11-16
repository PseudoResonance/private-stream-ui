import { html, css, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";

import "./header";
import "./content";
import "./table";
import "./path-config";
import type { ManagementData, UserData } from "../../../types";
import type { PathObjectType } from "../../../api/endpoints/paths";

enum ManagementPanelPage {
	PATHS = "paths",
	PATH_CONF = "path_conf",
}

@customElement("management-panel")
export class ManagementPanel extends LitElement {
	private managementData: ManagementData;

	constructor() {
		super();
		this.managementData = (window as any).MANAGEMENT_DATA;
		if (this.managementData.id) {
			this.page = ManagementPanelPage.PATH_CONF;
		}
	}

	@state()
	private page: ManagementPanelPage = ManagementPanelPage.PATHS;

	static styles = css`
		:host {
			position: absolute;
			width: 100%;
			height: 100%;
			display: grid;
			grid-template:
				[header-start] "header header" var(--header-size) [header-end]
				[content-start] "content content" auto [content-end]
				/ 10cm auto;
		}
		#header {
			grid-area: header;
		}
		#content {
			grid-area: content;
		}
	`;

	// private refreshTable() {
	// 	this.shadowRoot?.querySelectorAll("data-table").forEach((elem) => {
	// 		if (
	// 			"refreshData" in elem &&
	// 			typeof elem.refreshData === "function"
	// 		) {
	// 			elem.refreshData();
	// 		}
	// 	});
	// }

	private pathsTemplate() {
		return html`<data-table
			style="display: block;"
			.columns=${[
				{
					name: "Name",
					key: "path",
					size: "1fr",
					style: `font-family:"Google Sans Code", "Lucida Console", "Courier New", monospace`,
				},
				{
					name: "Configure",
					style: `padding: 0`,
					generate: (row: Record<string, unknown>) => {
						return html`
							<table-button
								@click="${() => {
									window.location.href = `./${row.path}`;
								}}"
								style="--bg-color: var(--bg-ok-color); --bg-color-hover: var(--bg-ok-color-hover); --fg-color: var(--fg-ok-color);"
							>
								Configure
							</table-button>
						`;
					},
					size: "auto",
				},
			]}
			.dataFunction=${async () => {
				const data = await fetch("/api/v1/path", {
					method: "GET",
				});
				if (data.status !== 200) {
					throw new Error(
						`${data.status}: ${data.statusText} when fetching data!\n${data}`,
					);
				}
				return (await (data.json() as any)).data.data;
			}}
			tableTitle="Streams"
			showTitle
			showHeader
			showDepth="2"
		>
			<table-button
				style="--bg-color: var(--bg-ok-color); --bg-color-hover: var(--bg-ok-color-hover); --fg-color: var(--fg-ok-color);"
				@click="${async () => {
					const pathData = await fetch("/api/v1/privatepath", {
						method: "POST",
						headers: {
							"Content-Type": "application/json; charset=utf-8",
						},
					});
					if (pathData.status !== 200) {
						throw new Error(
							`${pathData.status}: ${pathData.statusText} when creating new stream path!\n${pathData}`,
						);
					}
					const pathJson = (await (pathData.json() as any)).data
						.data as PathObjectType[];
					if (pathJson.length === 0 || !pathJson[0]) {
						throw new Error(
							`${pathData.status}: ${pathData.statusText} when creating new stream path!\n${pathData}`,
						);
					}
					const pathName = pathJson[0].path;
					const tokenData = await fetch("/api/v1/privatetoken", {
						method: "POST",
						headers: {
							"Content-Type": "application/json; charset=utf-8",
						},
						body: JSON.stringify({
							path: pathName,
							action: "publish",
						}),
					});
					if (tokenData.status !== 200) {
						throw new Error(
							`${tokenData.status}: ${tokenData.statusText} when creating stream token!\n${tokenData}`,
						);
					}
					const readTokenData = await fetch("/api/v1/privatetoken", {
						method: "POST",
						headers: {
							"Content-Type": "application/json; charset=utf-8",
						},
						body: JSON.stringify({
							path: pathName,
							action: "read",
						}),
					});
					if (readTokenData.status !== 200) {
						throw new Error(
							`${readTokenData.status}: ${readTokenData.statusText} when creating read stream token!\n${readTokenData}`,
						);
					}
					window.location.href = `./${pathName}`;
				}}"
			>
				New
			</table-button>
		</data-table>`;
	}

	private pathConfTemplate() {
		return html`<path-config
			baseUrl="${this.managementData.baseUrl}"
			id="${this.managementData.id}"
			.publishProtocols="${this.managementData.publishProtocols}"
			providerBaseUrl="${this.managementData.providerBase}"
		></path-config>`;
	}

	private contentTemplates() {
		switch (this.page) {
			case ManagementPanelPage.PATH_CONF:
				return this.pathConfTemplate();
			case ManagementPanelPage.PATHS:
			default:
				return this.pathsTemplate();
		}
	}

	render() {
		const userData = (window as any).USER_DATA as UserData;
		return html`<management-panel-header id="header">
				<header-button href="/">Home</header-button>
				<header-button
					@click="${() => {
						if (this.page !== ManagementPanelPage.PATHS) {
							if (
								window.location.pathname.endsWith(
									"/management/",
								)
							) {
								// We are already here
							} else {
								// A strange hack to parse the pathname a bit more accurately...
								window.location.href = new URL(
									window.location.pathname + "/../",
									"http://localhost",
								).pathname;
							}
						}
					}}"
				>
					Streams
				</header-button>
				<header-separator></header-separator>
				<header-text>
					${userData.name ??
					userData.username ??
					(userData.admin ? "Admin" : "User")}
				</header-text>
			</management-panel-header>
			<management-panel-content id="content">
				${this.contentTemplates()}
			</management-panel-content>`;
	}
}

declare global {
	interface HTMLElementManagementPanel {
		"management-panel": ManagementPanel;
	}
}
