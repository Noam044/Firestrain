/**
 * Minimal CSV parser for the BDIFF export: configurable separator, "quoted"
 * fields with "" as an escaped quote, CRLF or LF line ends, optional BOM.
 */
export function parseCsv(text: string, separator = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const start = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === separator) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
