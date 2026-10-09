import test from 'node:test';
import assert from 'node:assert/strict';
import { readCodeCsv, mergeCodeCsv } from '../lib/csv-merger.mjs';

const read = value => readCodeCsv(Buffer.from(value));

test('merges all rows in file order without changing marking codes', () => {
  const codes = ['0104704890521800215(plhN,8rZ40D\x1d91EE12\x1d92D1Ah/JT=', '0000123;"a"+b,c=', '01002\t end '];
  const result = mergeCodeCsv([read(`${codes[0]}\r\n`), read(`${codes[1]}\n${codes[2]}`)]);
  assert.deepEqual(Buffer.from(result.bytes), Buffer.from(codes.join('\r\n') + '\r\n'));
  assert.equal(result.total, 3);
});

test('removes UTF-8 BOMs and empty lines, accepts CRLF, LF and CR', () => {
  const result = mergeCodeCsv([read('\ufeff\r\n001\n\n002\r003\r\n'), read('\ufeff004')]);
  assert.equal(Buffer.from(result.bytes).toString(), '001\r\n002\r\n003\r\n004\r\n');
  assert.equal(result.total, 4);
});

test('retains and counts duplicates across files and within a file', () => {
  const result = mergeCodeCsv([read('001\n001'), read('001\n002')]);
  assert.equal(result.duplicates, 2);
  assert.equal(result.total, 4);
  assert.equal(Buffer.from(result.bytes).toString(), '001\r\n001\r\n001\r\n002\r\n');
});

test('preserves non-UTF8 bytes instead of replacing them while decoding', () => {
  const source = Uint8Array.from([48, 48, 49, 0x80, 0xff, 0xc0, 29, 61]);
  const result = mergeCodeCsv([readCodeCsv(source)]);
  assert.deepEqual(result.bytes, Uint8Array.from([...source, 13, 10]));
});

test('rejects empty and UTF-16 inputs instead of generating damaged codes', () => {
  for (const source of ['', '\r\n\n']) assert.throws(() => read(source), /нет строк/);
  for (const bytes of [[255,254,48,0], [254,255,0,48], [48,0]]) assert.throws(() => readCodeCsv(Uint8Array.from(bytes)), /UTF-16/);
});

test('one file remains usable and an empty selection produces no rows', () => {
  assert.equal(Buffer.from(mergeCodeCsv([read('0001')]).bytes).toString(), '0001\r\n');
  assert.equal(mergeCodeCsv([]).total, 0);
});
