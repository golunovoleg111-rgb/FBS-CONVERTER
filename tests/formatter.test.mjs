import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {parseWorkbook, makePdf} from '../lib/formatter.mjs';
function workbook(items,declared=items.length){
 const w=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([
 [`Количество товаров: ${declared}`],['','','Бренд','Наименование','Размер','Цвет','Артикул продавца'],
 ...items.map((r,i)=>[String(i),'',...r])]),'Лист подбора');
 return XLSX.write(w,{type:'buffer',bookType:'xlsx'});
}
test('nonadjacent duplicates merge, different sizes/colors/articles remain separate',()=>{
 const r=parseWorkbook(workbook([['Beltanee','Товар','42','серый','A'],['Beltanee','Товар','44','серый','A'],['Beltanee','Товар','46','серый','A'],['Beltanee','Товар','42','черный','A'],['Beltanee','Товар','46','серый','A'],['Beltanee','Товар','42','серый','B']]));
 assert.equal(r.total,6); assert.deepEqual(r.items.map(r=>r.count),[1,1,2,1,1]);
});
test('both target brands are split into complete independent results',()=>{
 const r=parseWorkbook(workbook([
  ['Beltane Man','Брюки','46','черный','M1'],
  ['Beltanee','Костюм','48','графит','W1'],
  ['BeltaneMan','Брюки','46','черный','M1'],
  ['Beltanee','Костюм','50','графит','W1']
 ]));
 assert.equal(r.hasSplitBrands,true);
 assert.deepEqual(r.brands.map(({brand,total})=>[brand,total]),[['Beltanee',2],['BeltaneMan',2]]);
 assert.deepEqual(r.brands[1].items.map(({count})=>count),[2]);
 assert.equal(r.brands.reduce((sum,brand)=>sum+brand.total,0),r.total);
});
test('single brand keeps the regular download flow',()=>{
 const r=parseWorkbook(workbook([['Beltanee','Товар','42','','A']]));
 assert.equal(r.hasSplitBrands,false);
 assert.equal(r.brands.length,1);
});
test('other brands are never omitted by a two-file split',()=>{
 const r=parseWorkbook(workbook([
  ['Beltanee','Товар','42','','A'],
  ['BeltaneMan','Товар','44','','B'],
  ['Другой бренд','Товар','46','','C']
 ]));
 assert.equal(r.hasSplitBrands,false);
 assert.equal(r.total,3);
});
test('mismatched declared count rejected',()=>assert.throws(()=>parseWorkbook(workbook([['Beltanee','Товар','42','','A']],2)),/не совпадает/));
test('invalid workbook rejected',()=>assert.throws(()=>parseWorkbook(new Uint8Array([1,2,3]))));
test('PDF with Cyrillic generated',async()=>{
 const pdf=await makePdf(parseWorkbook(workbook([['Beltanee','Товар','42','серый','A']])),'Тест.xlsx');
 const buf=await pdf.getBuffer();assert.equal(buf.subarray(0,5).toString(),'%PDF-');
});
