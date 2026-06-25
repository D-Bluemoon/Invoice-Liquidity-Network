import Table from "cli-table3";
import YAML from "yaml";

export type OutputFormat =
  | "table"
  | "json"
  | "yaml";

export function renderJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function renderYaml(data: unknown): string {
  return YAML.stringify(data);
}

export function renderTable(
  headers: string[],
  rows: (string | number)[][]
): string {
  const table = new Table({
    head: headers,
    wordWrap: true,
  });

  rows.forEach(row => table.push(row));

  return table.toString();
}
