import fs from 'node:fs';
import path from 'node:path';

const projectRoot=process.cwd();
const assetsPath=path.resolve(projectRoot,'assets');
if (path.dirname(assetsPath)!==projectRoot) throw new Error('Invalid Pages assets path');
fs.rmSync(assetsPath,{recursive:true,force:true});
fs.cpSync('dist/assets',assetsPath,{recursive:true});
fs.copyFileSync('dist/index.html','index.html');
fs.copyFileSync('dist/favicon.svg','favicon.svg');
