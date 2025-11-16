import { html, css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";

import "../header";
import "../content";
import type { UserData } from "../../types";

@customElement("home-panel")
export class HomePanel extends LitElement {
	constructor() {
		super();
	}

	static styles = css`
		:host {
			position: absolute;
			width: 100%;
			height: 100%;
			display: grid;
			grid-template:
				[header-start] "header header" var(--header-size) [header-end]
				[content-start] "content content" auto [content-end]
				/ auto;
		}
		#header {
			grid-area: header;
		}
		#content {
			grid-area: content;
		}
	`;

	render() {
		const userData = (window as any).USER_DATA as UserData | undefined;
		return html`<page-panel-header id="header">
				<header-button href="/">Home</header-button>
				<header-button href="/management/"> Streams </header-button>
				<header-separator></header-separator>
				<header-text>
					${userData?.name ??
					userData?.username ??
					(userData?.admin ? "Admin" : "User")}
				</header-text>
			</page-panel-header>
			<page-panel-content id="content"></page-panel-content>`;
	}
}

declare global {
	interface HTMLElementHomePanel {
		"home-panel": HomePanel;
	}
}
