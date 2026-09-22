import fs from 'node:fs';

fs.copyFileSync('dist/app/index.html', 'dist/index.html');
fs.rmSync('dist/app', {recursive:true});
