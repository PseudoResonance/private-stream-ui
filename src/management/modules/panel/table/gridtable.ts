import { html, css, LitElement, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

interface ColumnBase {
	name: string;
	size?: string;
	style?: string;
}

interface ColumnGenerated extends ColumnBase {
	generate: (row: Record<string, unknown>) => string | TemplateResult<1>;
}

interface ColumnData extends ColumnBase {
	key: string;
	transform?: (value: string) => string | TemplateResult<1>;
}

export type Column = ColumnGenerated | ColumnData;

@customElement("grid-table")
export class GridTable extends LitElement {
	public static slotButtons = "buttons";

	constructor() {
		super();
	}
	@property()
	public tableTitle: string = "Table";

	@property({ type: Boolean })
	public showHeader: boolean = false;

	@property({ type: Boolean })
	public showTitle: boolean = false;

	@property()
	public columns: Column[] = [];

	@property()
	public data: Record<string, never>[] = [];

	@property({ type: Number })
	public depth: number = 0;

	@property({ type: Number })
	public showDepth: number = -1;

	static styles = css`
		h1,
		h2,
		h3,
		h4,
		h5,
		h6 {
			margin: 0;
		}
		.cell.header {
			font-weight: bold;
		}
		.tableWrapper {
			width: 100%;
			display: grid;
		}

		.above {
			display: flex;
			position: relative;
			flex-wrap: wrap;
		}
		.above > * {
			flex-grow: 0;
			flex-shrink: 0;
		}
		.separator:not(.NOTACLASS) {
			flex-grow: 5;
			flex-shrink: 5;
			height: 100%;
		}

		.table {
			overflow-x: auto;
			display: grid;
			border-left: thin solid var(--fg-primary-color);
			border-right: thin solid var(--fg-primary-color);
		}
		.description {
			padding: var(--padding);
		}
		.row {
			grid-column: header-start / header-end;
			display: grid;
			grid: subgrid / subgrid;
		}
		.row.group.first {
			border-top: thin solid var(--fg-primary-color);
		}
		.row.data,
		.row.header {
			border-bottom: thin solid var(--fg-primary-color);
		}
		.cell {
			padding: var(--padding);
		}
		.row.header {
			background-color: var(--bg-secondary-color);
		}
		.row.data:nth-child(even) {
			background-color: var(--bg-secondary-color);
		}
		.row.data:nth-child(odd) {
			background-color: var(--bg-primary-color);
		}
		.cell {
			border-left: thin solid var(--fg-primary-color);
		}
		.cell.first {
			border-left: none;
		}
		details:open > summary {
			padding-bottom: var(--padding);
		}
	`;

	private static objectTableTemplate(
		val: Record<string, never>,
		depth: number,
		showDepth: number,
	): TemplateResult<1> {
		return html`<grid-table
			.columns="${[
				{ name: "Key", key: "key", size: "auto" },
				{ name: "Value", key: "value", size: "1fr" },
			]}"
			.data="${Object.entries(val).map(([k, v]) => {
				return { key: k, value: v };
			})}"
			title="Data"
			depth=${depth + 1}
			showDepth=${showDepth}
		></grid-table>`;
	}

	private static renderValue(
		val: unknown,
		depth: number,
		showDepth: number,
		transform: ((value: string) => string | TemplateResult<1>) | undefined,
	): { elem: TemplateResult<1> | string; isTable: boolean } {
		if (typeof val === "string") {
			if (typeof transform === "function") {
				return { elem: transform(val), isTable: false };
			} else {
				return { elem: val, isTable: false };
			}
		} else if (typeof val === "object" && val !== null) {
			return {
				elem: this.objectTableTemplate(val as any, depth, showDepth),
				isTable: true,
			};
		} else {
			return { elem: String(val), isTable: false };
		}
	}

	render() {
		let collapsible = false;
		if (this.showDepth >= 0 && this.depth >= this.showDepth) {
			collapsible = true;
		}
		const tableElem = html`<div
			class="tableWrapper"
			role="table"
			aria-rowcount="${(this.data?.length ?? 0) +
			(this.showHeader ? 1 : 0)}"
			aria-columncount="${this.columns.length}"
			aria-describedby="table-description"
			style="grid-template-columns: 1fr; grid-template-rows: repeat(2, auto);"
		>
			<div class="above">
				${this.tableTitle
					? html`<div
							class="description"
							id="table-description"
							style="display: ${this.showTitle && !collapsible
								? "initial"
								: "none"};"
						>
							<h3>${this.tableTitle}</h3>
						</div>`
					: ""}
				<div class="separator"></div>
				<slot name="${GridTable.slotButtons}"></slot>
			</div>
			<div
				class="table"
				style="grid-template-columns: [header-start] ${this.columns.reduce(
					(prev, column) =>
						prev +
						(prev.length > 0 ? " " : "") +
						(column.size !== undefined ? column.size : "1fr"),
					"",
				)} [header-end]; grid-template-rows: ${this.showHeader
					? "[header-start] auto"
					: ""} [header-end]
                repeat(${this.data?.length ?? 0}, auto) [data-end];"
			>
				${this.showHeader
					? html` <div class="row group first" role="rowgroup">
							<div
								class="row header"
								role="row"
								aria-rowindex="1"
							>
								${this.columns.map((column, i) => {
									return html`<div
										class="${classMap({
											cell: true,
											header: true,
											first: i === 0,
										})}"
										role="columnheader"
									>
										${column.name}
									</div>`;
								})}
							</div>
						</div>`
					: ""}
				<div
					class="${classMap({
						row: true,
						group: true,
						first: !this.showHeader,
					})}"
					role="rowgroup"
					style="grid-row: header-end / data-end;"
				>
					${(this.data ?? []).map((row, i) => {
						return html`<div
							class="row data"
							role="row"
							aria-rowindex="${i + 2}"
						>
							${this.columns.map((column, i) => {
								let elem;
								let isNested = false;
								if ("key" in column) {
									if (column.key in row) {
										const elemWrapper =
											GridTable.renderValue(
												row[column.key],
												this.depth,
												this.showDepth,
												column.transform,
											);
										elem = elemWrapper.elem;
										isNested = elemWrapper.isTable;
									} else {
										elem = "";
									}
								} else {
									elem = column.generate(row);
								}
								return html`<div
									role="gridcell"
									style="${column.style}"
									class="${classMap({
										cell: true,
										data: true,
										"cell-value": !isNested,
										"cell-nested": isNested,
										first: i === 0,
									})}"
								>
									${elem}
								</div>`;
							})}
						</div>`;
					})}
				</div>
			</div>
		</div>`;
		return html`${collapsible
			? html`<details>
					<summary>${this.tableTitle}</summary>
					${tableElem}
				</details>`
			: tableElem}`;
	}
}

declare global {
	interface HTMLElementGridTable {
		"grid-table": GridTable;
	}
}
