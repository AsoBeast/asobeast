import { renderToStaticMarkup } from "react-dom/server";
import {
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
  useTable,
  type ColumnVisibilityState,
} from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { Table } from "@/components/ui/table";
import { DataTableFooter } from "./DataTableFooter";

interface Fruit {
  name: string;
  count: number;
}

const features = tableFeatures({ columnVisibilityFeature });
const helper = createColumnHelper<typeof features, Fruit>();
const DATA: Fruit[] = [
  { name: "apple", count: 2 },
  { name: "pear", count: 3 },
];

function Fixture({
  withFooter = true,
  visibility = {},
}: {
  withFooter?: boolean;
  visibility?: ColumnVisibilityState;
}) {
  const table = useTable({
    features,
    data: DATA,
    columns: helper.columns([
      helper.accessor("name", { id: "name", header: "Name" }),
      helper.accessor("count", {
        id: "count",
        header: "Count",
        ...(withFooter
          ? {
              footer: ({ table: instance }) => (
                <span>{`total ${instance
                  .getRowModel()
                  .rows.reduce(
                    (sum, row) => sum + row.original.count,
                    0,
                  )}`}</span>
              ),
            }
          : {}),
      }),
    ]),
    state: { columnVisibility: visibility },
  });
  return (
    <Table>
      <DataTableFooter table={table} rowIndex={4} />
    </Table>
  );
}

describe("DataTableFooter", () => {
  it("renders one footer row with a cell per visible column", () => {
    const html = renderToStaticMarkup(<Fixture />);

    expect(html.match(/<tfoot/g)).toHaveLength(1);
    expect(html.match(/<tr/g)).toHaveLength(1);
    expect(html.match(/<td/g)).toHaveLength(2);
    expect(html).toMatch(/<td[^>]*><\/td><td[^>]*><span>total 5<\/span><\/td>/);
  });

  it("names the row index it is given", () => {
    expect(renderToStaticMarkup(<Fixture />)).toContain('aria-rowindex="4"');
  });

  it("leaves out the cell of a hidden column", () => {
    const html = renderToStaticMarkup(<Fixture visibility={{ name: false }} />);

    expect(html.match(/<td/g)).toHaveLength(1);
  });

  it("renders nothing when no visible column has a footer", () => {
    expect(renderToStaticMarkup(<Fixture withFooter={false} />)).not.toContain(
      "<tfoot",
    );
    expect(
      renderToStaticMarkup(<Fixture visibility={{ count: false }} />),
    ).not.toContain("<tfoot");
  });
});
