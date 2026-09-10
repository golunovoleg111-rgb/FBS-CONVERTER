import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {parseWorkbook, makePdf} from '../lib/formatter.mjs';
function workbook(items,declared=items.length){
 const w=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([
 [`Количество товаров: ${declared}`],['','','','Наименование','Размер','Цвет','Артикул продавца'],
 ...items.map((r,i)=>[String(i),'','',...r])]),'Лист подбора');
 return XLSX.write(w,{type:'buffer',bookType:'xlsx'});
}
test('nonadjacent duplicates merge, different sizes/colors/articles remain separate',()=>{
 const r=parseWorkbook(workbook([['Товар','42','серый','A'],['Товар','44','серый','A'],['Товар','46','серый','A'],['Товар','42','черный','A'],['Товар','46','серый','A'],['Товар','42','серый','B']]));
 assert.equal(r.total,6); assert.deepEqual(r.items.map(r=>r.count),[1,1,2,1,1]);
});
test('mismatched declared count rejected',()=>assert.throws(()=>parseWorkbook(workbook([['Товар','42','','A']],2)),/не совпадает/));
test('invalid workbook rejected',()=>assert.throws(()=>parseWorkbook(new Uint8Array([1,2,3]))));
test('PDF with Cyrillic generated',async()=>{
 const pdf=await makePdf(parseWorkbook(workbook([['Товар','42','серый','A']])),'Тест.xlsx');
 const buf=await pdf.getBuffer();assert.equal(buf.subarray(0,5).toString(),'%PDF-');
});
