import { html, css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("management-panel-header")
export class ManagementPanelHeader extends LitElement {
	public static slotButtons = "buttons";

	constructor() {
		super();
	}

	static styles = css`
		:host {
			position: relative;
			font-size: var(--header-font-size);
			align-items: stretch;
			background-color: var(--bg-secondary-color);
			user-select: none;
			-webkit-touch-callout: none;
			-webkit-user-select: none;
			-ms-user-select: none;
			-moz-user-select: none;
		}
		#buttons {
			position: absolute;
			width: 100%;
			height: 100%;
			display: flex;
		}
	`;

	render() {
		return html`<div>
			<slot
				id="buttons"
				name="${ManagementPanelHeader.slotButtons}"
			></slot>
		</div>`;
	}
}

declare global {
	interface HTMLElementManagementPanelHeader {
		"management-panel-header": ManagementPanelHeader;
	}
}
