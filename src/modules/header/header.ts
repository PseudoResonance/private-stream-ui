import { html, css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("page-panel-header")
export class PagePanelHeader extends LitElement {
	public static slotButtons = "buttons";

	constructor() {
		super();
	}

	static styles = css`
		:host {
			position: relative;
			font-size: var(--header-font-size);
			background-color: var(--bg-secondary-color);
			user-select: none;
			-webkit-touch-callout: none;
			-webkit-user-select: none;
			-ms-user-select: none;
			-moz-user-select: none;
		}
		.wrapper {
			align-items: stretch;
		}
		#buttons {
			position: absolute;
			width: 100%;
			height: 100%;
			display: flex;
		}
	`;

	render() {
		return html`<div class="wrapper">
			<slot id="buttons" name="${PagePanelHeader.slotButtons}"></slot>
		</div>`;
	}
}

declare global {
	interface HTMLElementPagePanelHeader {
		"page-panel-header": PagePanelHeader;
	}
}
