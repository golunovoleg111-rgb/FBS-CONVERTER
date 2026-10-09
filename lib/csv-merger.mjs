// These exports contain one marking code per physical line. Never parse
// delimiters, trim codes, coerce numbers, or reserialize CSV fields.
export function readCodeCsv(buffer) {
  let bytes = new Uint8Array(buffer);
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff) || bytes.includes(0)) {
    throw new Error('Файл в UTF-16 или содержит нулевые байты. Сохраните его как CSV UTF-8 и загрузите снова.');
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.subarray(3);
  const rows = [];
  let start = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 10 && bytes[i] !== 13) continue;
    if (i > start) rows.push(bytes.slice(start, i));
    if (bytes[i] === 13 && bytes[i + 1] === 10) i++;
    start = i + 1;
  }
  if (start < bytes.length) rows.push(bytes.slice(start));
  if (!rows.length) throw new Error('В файле нет строк с кодами.');
  return { rows };
}

export function mergeCodeCsv(files) {
  const rows = files.flatMap(file => file.rows);
  const seen = new Set();
  let duplicates = 0;
  const size = rows.reduce((total, row) => total + row.length + 2, 0);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const row of rows) {
    const key = Array.from(row).join(',');
    if (seen.has(key)) duplicates++;
    seen.add(key);
    bytes.set(row, offset);
    offset += row.length;
    bytes[offset++] = 13;
    bytes[offset++] = 10;
  }
  return { bytes, total: rows.length, duplicates };
}
