import { useRef, useState } from 'react';
import { readCodeCsv, mergeCodeCsv } from '../lib/csv-merger.mjs';

type CsvFile = { id: number; name: string; rows: Uint8Array[] };
const MAX_BYTES = 100 * 1024 * 1024;

export default function CsvMerger() {
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const locked = useRef(false);
  const [files, setFiles] = useState<CsvFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [filename, setFilename] = useState('Объединённые коды');
  const total = files.reduce((sum, file) => sum + file.rows.length, 0);

  async function load(selected: FileList | File[]) {
    if (locked.current || !selected.length) return;
    locked.current = true;
    setBusy(true);
    setErrors([]);
    const added: CsvFile[] = [];
    const failed: string[] = [];
    let size = files.reduce((sum, file) => sum + file.rows.reduce((n, row) => n + row.length + 2, 0), 0);
    for (const file of Array.from(selected)) {
      try {
        if (!/\.csv$/i.test(file.name)) throw new Error('Выберите файл .csv.');
        if (size + file.size > MAX_BYTES) throw new Error('Общий размер файлов не должен превышать 100 МБ.');
        const parsed = readCodeCsv(await file.arrayBuffer());
        added.push({ id: nextId.current++, name: file.name, rows: parsed.rows });
        size += file.size;
      } catch (e: any) {
        failed.push(`${file.name}: ${e.message || 'Не удалось прочитать файл.'}`);
      }
    }
    setFiles(previous => [...previous, ...added]);
    setErrors(failed);
    setBusy(false);
    locked.current = false;
    if (input.current) input.current.value = '';
  }

  function download() {
    try {
      const merged = mergeCodeCsv(files);
      const url = URL.createObjectURL(new Blob([merged.bytes], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(filename.trim().replace(/\.csv$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'Объединённые коды')}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setErrors(merged.duplicates ? [`В общем файле ${merged.duplicates} повторных строк. Они сохранены — проверьте, не выбран ли один файл дважды.`] : []);
    } catch { setErrors(['Не удалось объединить файлы. Попробуйте загрузить меньше файлов за один раз.']); }
  }

  return <>
    <section className="intro"><p className="eyebrow">CSV ДЛЯ ТЕКШЕРЫ</p><h1>Все коды.<br/>В одном файле.</h1><p>Загрузите CSV с кодами маркировки.<br/>Скачайте общий файл для регистрации трансграна.</p></section>
    <section className="upload" aria-busy={busy} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void load(e.dataTransfer.files); }}>
      <div className="fileIcon" aria-hidden="true">↓</div><h2>{busy ? 'Читаем файлы…' : 'Загрузите все CSV'}</h2>
      <p>Перетащите несколько файлов сюда<br/>или выберите их одновременно</p>
      <input ref={input} type="file" accept=".csv" multiple hidden onChange={e => { if (e.target.files) void load(e.target.files); }}/>
      <button disabled={busy} onClick={() => input.current?.click()}>{files.length ? 'Добавить CSV' : 'Выбрать CSV'}</button>
      <small>Без заголовков · Один код в строке · До 100 МБ</small>
    </section>
    {errors.length > 0 && <div className="error" role="alert">{errors.map((error, i) => <p key={i}>{error}</p>)}{files.length > 0 && <p>В общий файл входят только файлы из списка ниже.</p>}</div>}
    {files.length > 0 && <section className="result csvResult">
      <div className="resultTop"><div><p className="eyebrow">ГОТОВО К ОБЪЕДИНЕНИЮ</p><h2>CSV для загрузки в Текшеру</h2></div><button disabled={busy} onClick={download}>Скачать общий CSV ↓</button></div>
      <div className="stats" aria-live="polite"><div><strong>{files.length}</strong><span>файлов</span></div><div><strong>{total}</strong><span>строк с кодами</span></div><div><strong>1</strong><span>общий CSV</span></div></div>
      <div className="csvSettings"><label>Имя общего файла<input value={filename} onChange={e => setFilename(e.target.value)} maxLength={150}/></label><button className="secondary" disabled={busy} onClick={() => { setFiles([]); setErrors([]); }}>Очистить список</button></div>
      <div className="tableWrap"><table><thead><tr><th>Файл</th><th>Строк с кодами</th><th><span className="srOnly">Действия</span></th></tr></thead><tbody>{files.map(file => <tr key={file.id}><td>{file.name}</td><td>{file.rows.length}</td><td><button className="secondary" disabled={busy} aria-label={`Удалить ${file.name}`} onClick={() => { setFiles(previous => previous.filter(item => item.id !== file.id)); setErrors([]); }}>Удалить</button></td></tr>)}</tbody></table></div>
    </section>}
    <footer>Коды сохраняются целиком, включая ведущие нули и специальные символы.<br/>Порядок файлов и строк сохранён. Убираются только пустые строки; повторы остаются.<br/>Обработка в вашем браузере — файлы не отправляются на сервер.</footer>
  </>;
}
