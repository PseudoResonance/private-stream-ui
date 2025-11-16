import { html, css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("management-panel-content")
export class ManagementPanelContent extends LitElement {
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
	interface HTMLElementManagementPanelContent {
		"management-panel-content": ManagementPanelContent;
	}
}
