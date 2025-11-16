import { html, css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("page-panel-content")
export class PagePanelContent extends LitElement {
	constructor() {
		super();
	}

	static styles = css`
		:host {
			position: relative;
			overflow-y: scroll;
			overflow-x: hidden;
			padding: var(--padding);
			display: flex;
			flex-direction: column;
			align-items: center;
		}
	`;

	render() {
		return html`<div>
			<slot></slot>
		</div>`;
	}
}

declare global {
	interface HTMLElementPagePanelContent {
		"page-panel-content": PagePanelContent;
	}
}
