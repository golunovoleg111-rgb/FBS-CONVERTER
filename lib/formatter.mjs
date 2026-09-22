import * as XLSX from 'xlsx';

const SPLIT_BRANDS = ['Beltanee', 'BeltaneMan'];

function normalizedBrand(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s_-]+/g, '')
    .toLowerCase();
}

function addItem(groups, values) {
  const key = JSON.stringify(values);
  if (!groups.has(key)) groups.set(key, {values, count: 0});
  groups.get(key).count++;
}

function groupedResult(groups, total, brand) {
  return {items: [...groups.values()], total, ...(brand ? {brand} : {})};
}

export function parseWorkbook(data) {
  const book = XLSX.read(data, {type:'array', cellText:true, nodim:true});
  const candidates=[];
  for(const name of book.SheetNames) {
    const rows=XLSX.utils.sheet_to_json(book.Sheets[name], {header:1,raw:false,defval:'',blankrows:false});
    const header=rows.findIndex(r=>String(r[3]).trim()==='Наименование' && String(r[4]).trim()==='Размер' && String(r[5]).trim()==='Цвет' && String(r[6]).trim()==='Артикул продавца');
    if(header>=0)candidates.push({rows,header});
  }
  if(candidates.length!==1)throw new Error(candidates.length ? 'В файле несколько сборочных заданий. Оставьте один лист и загрузите файл снова.' : 'Не найдена таблица WB: в D:G должны быть «Наименование», «Размер», «Цвет», «Артикул продавца».');
  const {rows,header}=candidates[0];
  const groups=new Map();
  const brandGroups=new Map(SPLIT_BRANDS.map(brand=>[
    normalizedBrand(brand), {brand, groups:new Map(), total:0}
  ]));
  let total=0;
  for(const row of rows.slice(header+1)) {
    const values=[3,4,5,6].map(i=>String(row[i]??''));
    if(values.every(v=>!v.trim()))continue;
    if(!values[0].trim()||!values[3].trim())throw new Error('В таблице есть строка без наименования или артикула. Проверьте исходный Excel.');
    addItem(groups, values);
    const brandGroup=brandGroups.get(normalizedBrand(row[2]));
    if(brandGroup) {
      addItem(brandGroup.groups, values);
      brandGroup.total++;
    }
    total++;
  }
  if(!total)throw new Error('В таблице нет товаров.');
  const declared=rows.slice(0,header).flat().map(String).join(' ').match(/Количество товаров:\s*(\d+)/i);
  if(declared && Number(declared[1])!==total)throw new Error(`Количество строк (${total}) не совпадает с итогом в Excel (${declared[1]}). Проверьте файл.`);
  const brands=[...brandGroups.values()]
    .filter(({total})=>total>0)
    .map(({brand,groups,total})=>groupedResult(groups,total,brand));
  const splitTotal=brands.reduce((sum,brand)=>sum+brand.total,0);
  return {
    ...groupedResult(groups,total),
    brands,
    hasSplitBrands:splitTotal===total && SPLIT_BRANDS.every(brand=>brands.some(result=>result.brand===brand))
  };
}
export function pdfDefinition(result,name) {
 return {
  pageSize:'A4', pageMargins:[30,32,30,32], defaultStyle:{font:'Roboto',fontSize:10},
  footer:(current,pages)=>({text:`${current} / ${pages}`,alignment:'right',margin:[0,8,30,0],fontSize:9}),
  content:[
   {text:`Сборочное задание FBS${result.brand ? ` — ${result.brand}` : ''}`,fontSize:18,bold:true,margin:[0,0,0,5]},
   {text:name,fontSize:10,margin:[0,0,0,4]},
   {text:`Всего: ${result.total} шт.  |  Позиций: ${result.items.length}`,margin:[0,0,0,14]},
   {table:{headerRows:1,dontBreakRows:true,widths:['*',37,62,130,38],body:[
    ['Наименование','Размер','Цвет','Артикул продавца','Кол-во'].map(text=>({text,bold:true,fillColor:'#e8e8e8',fontSize:9})),
    ...result.items.map(r=>r.values.map((text,i)=>({text,bold:i===1,fontSize:i===1?12:10})).concat([{text:String(r.count),bold:true,fontSize:13,alignment:'center',fillColor:r.count>1?'#eeeeee':null}]))
   ]},layout:{hLineColor:()=>'#aaaaaa',vLineColor:()=>'#aaaaaa',hLineWidth:()=>0.5,vLineWidth:()=>0.5,paddingTop:()=>6,paddingBottom:()=>6}},
   {text:`Итого: ${result.total} шт.`,bold:true,margin:[0,12,0,0]}
  ]
 };
}
export async function makePdf(result,name) {
 const [{default:pdfMake},{default:fonts}]=await Promise.all([import('pdfmake/build/pdfmake.js'),import('pdfmake/build/vfs_fonts.js')]);
 pdfMake.addVirtualFileSystem(fonts);
 return pdfMake.createPdf(pdfDefinition(result,name));
}
