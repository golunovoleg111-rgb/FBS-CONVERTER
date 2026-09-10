"use client";
import { useEffect, useRef, useState } from 'react';
import { parseWorkbook, makePdf } from '../lib/formatter.mjs';

export default function Home() {
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<any>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = useRef<any>(null);
  current.current = {result, name};
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(context.registerTool({
        name: 'download_picking_pdf', title: 'Скачать сборочное задание',
        description: 'Скачивает PDF для уже загруженного в интерфейсе Excel.',
        inputSchema: {type:'object',properties:{},additionalProperties:false},
        annotations: {readOnlyHint:false,untrustedContentHint:false},
        async execute(input: any) {
          if (!input || typeof input !== 'object' || Object.keys(input).length) throw new Error('Ожидается пустой объект.');
          const value = current.current;
          if (!value.result) throw new Error('Сначала загрузите Excel.');
          const pdf = await makePdf(value.result,value.name);
          await pdf.download(value.name.replace(/\.xlsx?$/i,'')+'-сборка.pdf');
          return {downloaded:true,total:value.result.total,positions:value.result.items.length};
        }
      }, {signal:lifecycle.signal})).catch(()=>{});
    } catch {}
    return ()=>lifecycle.abort();
  }, []);
  async function load(file?: File) {
    if (!file || busy) return;
    setResult(null); setError(''); setName(file.name); setBusy(true);
    try {
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Выберите файл Excel (.xlsx или .xls).');
      if (file.size > 30 * 1024 * 1024) throw new Error('Файл слишком большой. Максимум — 30 МБ.');
      setResult(parseWorkbook(await file.arrayBuffer()));
    } catch (e: any) { setError(e.message || 'Не удалось прочитать Excel. Проверьте файл.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  async function download() {
    setBusy(true); setError('');
    try { const pdf = await makePdf(result, name); await pdf.download(name.replace(/\.xlsx?$/i, '') + '-сборка.pdf'); }
    catch { setError('Не удалось создать PDF. Попробуйте ещё раз.'); }
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
      <div className="resultTop"><div><p className="eyebrow">ГОТОВО К ПЕЧАТИ</p><h2>{name}</h2></div><button disabled={busy} onClick={download}>Скачать PDF ↓</button></div>
      <div className="stats"><div><strong>{result.total}</strong><span>товаров</span></div><div><strong>{result.items.length}</strong><span>строк вместо {result.total}</span></div><div><strong>{result.total-result.items.length}</strong><span>повторов объединено</span></div></div>
      <div className="tableWrap"><table><thead><tr>{['Наименование','Размер','Цвет','Артикул продавца','Кол-во'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{result.items.map((r:any,i:number)=><tr key={i}>{r.values.map((v:string,j:number)=><td key={j} className={j===1?'size':''}>{v}</td>)}<td className="qty"><span>{r.count}</span></td></tr>)}</tbody></table></div>
    </section>}
    <footer>В PDF: наименование, размер, цвет, артикул и количество.<br/>Формат A4 · Чёрно-белая печать</footer>
  </main>;
}
