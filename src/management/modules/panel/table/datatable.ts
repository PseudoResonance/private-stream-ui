import { html, LitElement, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import "./gridtable";
import { GridTable, type Column } from "./gridtable";

@customElement("data-table")
export class DataTable extends LitElement {
	constructor() {
		super();
	}

	connectedCallback() {
		super.connectedCallback();
		this.refreshData();
	}

	public refreshData = () => {
		this.dataFunction()
			.then((data) => {
				this._data = data;
			})
			.catch((e) => {
				console.error(e);
				//TODO display error
			});
	};

	@property()
	public tableTitle: string = "Table";

	@property({ type: Boolean })
	public showHeader: boolean = false;

	@property({ type: Boolean })
	public showTitle: boolean = false;

	@property()
	public columns: Column[] = [];

	@property()
	public dataFunction: () => Promise<Record<string, never>[]> = () =>
		new Promise(() => []);

	@state()
	private _data: Record<string, never>[] = [];

	@property({ type: Number })
	public showDepth: number = -1;

	@property()
	public tableStyle: string = "";

	private static objectTableTemplate(
		val: Record<string, never>,
	): TemplateResult<1> {
		return html`<details>
			<table>
				${Object.entries(val).map(([key, value]) => {
					return html`<tr>
						<td>${key}</td>
						<td>${this.renderValue(value)}</td>
					</tr>`;
				})}
			</table>
		</details>`;
	}

	private static renderValue(val: unknown) {
		if (typeof val === "string") return val;
		else if (typeof val === "object" && val !== null) {
			return this.objectTableTemplate(val as any);
		} else {
			return String(val);
		}
	}

	render() {
		return html`<grid-table
			.columns="${this.columns}"
			.data="${this._data}"
			tableTitle="${this.tableTitle}"
			?showHeader="${this.showHeader}"
			?showTitle="${this.showTitle}"
			showDepth=${this.showDepth}
		>
			<slot
				slot="${GridTable.slotButtons}"
				name="${GridTable.slotButtons}"
			></slot>
		</grid-table>`;
	}
}

declare global {
	interface HTMLElementDataTable {
		"data-table": DataTable;
	}
}
