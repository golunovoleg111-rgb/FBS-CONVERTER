"use client";
import { useEffect, useRef, useState } from 'react';
import { parseWorkbook, makePdf } from '../lib/formatter.mjs';

function outputBase(name: string) {
  return name.replace(/\.xlsx?$/i, '');
}

function savePdf(buffer: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([buffer], {type:'application/pdf'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),10_000);
}

async function downloadPicking(result: any, name: string, mode: 'unified' | 'separate') {
  if (mode === 'separate') {
    if (!result.hasSplitBrands) throw new Error('В задании нет двух брендов для разделения.');
    const files = await Promise.all(result.brands.map(async (brandResult: any) => ({
      filename:`${outputBase(name)}-${brandResult.brand}-сборка.pdf`,
      buffer:await (await makePdf(brandResult,name)).getBuffer()
    })));
    files.forEach(({buffer,filename})=>savePdf(buffer,filename));
    return {downloaded:true,mode,files:files.length,total:result.total};
  }
  const buffer = await (await makePdf(result,name)).getBuffer();
  savePdf(buffer,`${outputBase(name)}-сборка.pdf`);
  return {downloaded:true,mode,files:1,total:result.total};
}

export default function Home() {
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<any>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const current = useRef<any>(null);
  current.current = {result, name};
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(context.registerTool({
        name: 'download_picking_pdf', title: 'Скачать сборочное задание',
        description: 'Скачивает единый PDF или два отдельных PDF для Beltanee и BeltaneMan из уже загруженного Excel.',
        inputSchema: {type:'object',properties:{mode:{type:'string',enum:['unified','separate']}},additionalProperties:false},
        annotations: {readOnlyHint:false,untrustedContentHint:false},
        async execute(input: any) {
          if (!input || typeof input !== 'object') throw new Error('Ожидается объект параметров.');
          const mode=input.mode ?? 'unified';
          if (!['unified','separate'].includes(mode)) throw new Error('Режим должен быть unified или separate.');
          const value = current.current;
          if (!value.result) throw new Error('Сначала загрузите Excel.');
          return downloadPicking(value.result,value.name,mode);
        }
      }, {signal:lifecycle.signal})).catch(()=>{});
    } catch {}
    return ()=>lifecycle.abort();
  }, []);
  async function load(file?: File) {
    if (!file || busy) return;
    setResult(null); setError(''); setName(file.name); setBusy(true); setMenuOpen(false);
    try {
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Выберите файл Excel (.xlsx или .xls).');
      if (file.size > 30 * 1024 * 1024) throw new Error('Файл слишком большой. Максимум — 30 МБ.');
      setResult(parseWorkbook(await file.arrayBuffer()));
    } catch (e: any) { setError(e.message || 'Не удалось прочитать Excel. Проверьте файл.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  async function download(mode: 'unified' | 'separate' = 'unified') {
    setBusy(true); setError('');
    setMenuOpen(false);
    try { await downloadPicking(result,name,mode); }
    catch (e: any) { setError(e.message || 'Не удалось создать PDF. Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  }
  return <main>
    <header><span className="logo">FBS<span> / </span>СБОРКА</span><span className="badge">Excel → PDF</span></header>
    <section className="intro"><p className="eyebrow">СБОРОЧНОЕ ЗАДАНИЕ</p><h1>Меньше строк.<br/>Удобнее собирать.</h1><p>Одинаковые товары — в одной строке.<br/>Каждый размер — отдельно, количество — на виду.</p></section>
    <section className="upload" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); void load(e.dataTransfer.files[0]);}}>
      <div className="fileIcon" aria-hidden="true">↓</div><h2>{busy ? 'Обрабатываем…' : 'Загрузите сборочное задание'}</h2>
      <p>Перетащите Excel сюда или выберите файл</p>
      <input ref={input} type="file" accept=".xlsx,.xls" hidden onChange={e=>void load(e.target.files?.[0])}/>
      <button disabled={busy} onClick={()=>input.current?.click()}>{result ? 'Выбрать другой Excel' : 'Выбрать Excel'}</button>
      <small>Файл обрабатывается в вашем браузере</small>
    </section>
    {error && <p className="error" role="alert">{error}</p>}
    {result && <section className="result">
      <div className="resultTop"><div><p className="eyebrow">ГОТОВО К ПЕЧАТИ</p><h2>{name}</h2></div>
        {result.hasSplitBrands ? <div className="downloadMenu">
          <button className="downloadToggle" disabled={busy} aria-haspopup="menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(open=>!open)}>Скачать PDF <span aria-hidden="true">⌄</span></button>
          {menuOpen && <div className="downloadOptions" role="menu">
            <button role="menuitem" onClick={()=>void download('unified')}><strong>Скачать единый PDF</strong><span>Все товары в одном файле</span></button>
            <button role="menuitem" onClick={()=>void download('separate')}><strong>Скачать раздельные PDF</strong><span>Beltanee и BeltaneMan</span></button>
          </div>}
        </div> : <button disabled={busy} onClick={()=>void download('unified')}>Скачать PDF ↓</button>}
      </div>
      <div className="stats"><div><strong>{result.total}</strong><span>товаров</span></div><div><strong>{result.items.length}</strong><span>строк вместо {result.total}</span></div><div><strong>{result.total-result.items.length}</strong><span>повторов объединено</span></div></div>
      <div className="tableWrap"><table><thead><tr>{['Наименование','Размер','Цвет','Артикул продавца','Кол-во'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{result.items.map((r:any,i:number)=><tr key={i}>{r.values.map((v:string,j:number)=><td key={j} className={j===1?'size':''}>{v}</td>)}<td className="qty"><span>{r.count}</span></td></tr>)}</tbody></table></div>
    </section>}
    <footer>В PDF: наименование, размер, цвет, артикул и количество.<br/>Формат A4 · Чёрно-белая печать</footer>
  </main>;
}
