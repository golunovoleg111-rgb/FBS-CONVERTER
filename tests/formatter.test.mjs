import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {parseWorkbook, makePdf, pdfDefinition} from '../lib/formatter.mjs';
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

test('picking route sorts all nine groups while preserving other articles and variants',()=>{
 const route=['211_Кбрюки_жилет','24_К_Велюр','216_К_Замша','29_К_Вельвет№2','215_КардиганШТ','210_Комбез','26_П_Вельвет№1','26_П_Вельвет№4','26_П_№12'];
 const item=(article,size='42')=>['Beltanee','Товар',size,'серый',article];
 const r=parseWorkbook(workbook([
  item('Другой_Z'),item('26_П_№120'),item('24_К_Велюр_графит','48'),
  ...route.toReversed().map(article=>item(article)),
  item('Другой_A'),item('24_К_Велюр_графит','44'),item('24_К_Велюр_графит','48'),
  item('26_П_Вельвет№10'),item('211_Кбрюки_жилетДругой')
 ]));
 const expected=[route[0],'24_К_Велюр_графит',route[1],'24_К_Велюр_графит',...route.slice(2),'Другой_Z','26_П_№120','Другой_A','26_П_Вельвет№10','211_Кбрюки_жилетДругой'];
 assert.deepEqual(r.items.map(({values})=>values[3]),expected);
 assert.deepEqual(r.items.filter(({values})=>values[3]==='24_К_Велюр_графит').map(({values,count})=>[values[1],count]),[['48',2],['44',1]]);
 assert.equal(r.total,17);
 assert.equal(r.items.reduce((sum,{count})=>sum+count,0),r.total);
 const body=pdfDefinition(r,'Маршрут.xlsx').content.find(block=>block.table).table.body;
 assert.deepEqual(body.slice(1).map(row=>row[3].text),expected);
});

test('each brand PDF follows the picking route without losing quantities',()=>{
 const r=parseWorkbook(workbook([
  ['Beltanee','Товар','42','','Другой_Z'],
  ['BeltaneMan','Товар','48','','26_П_№12'],
  ['Beltanee','Товар','44','','210_Комбез'],
  ['BeltaneMan','Товар','50','','24_К_Велюр'],
  ['Beltanee','Товар','46','','211_Кбрюки_жилет'],
  ['BeltaneMan','Товар','52','','Другой_A'],
  ['Beltanee','Товар','42','','Другой_A'],
  ['Beltanee','Товар','44','','210_Комбез']
 ]));
 assert.equal(r.hasSplitBrands,true);
 assert.deepEqual(r.brands.map(({items})=>items.map(({values})=>values[3])),[
  ['211_Кбрюки_жилет','210_Комбез','Другой_Z','Другой_A'],
  ['24_К_Велюр','26_П_№12','Другой_A']
 ]);
 assert.deepEqual(r.brands.map(({total})=>total),[5,3]);
 for(const brand of r.brands) {
  const body=pdfDefinition(brand,'Маршрут.xlsx').content.find(block=>block.table).table.body;
  assert.deepEqual(body.slice(1).map(row=>[row[3].text,Number(row[4].text)]),brand.items.map(({values,count})=>[values[3],count]));
 }
});
test('invalid workbook rejected',()=>assert.throws(()=>parseWorkbook(new Uint8Array([1,2,3]))));
test('PDF with Cyrillic generated',async()=>{
 const pdf=await makePdf(parseWorkbook(workbook([['Beltanee','Товар','42','серый','A']])),'Тест.xlsx');
 const buf=await pdf.getBuffer();assert.equal(buf.subarray(0,5).toString(),'%PDF-');
});
