import fs from 'fs';
import path from 'path';

console.log('cwd', process.cwd());
console.log('contents', fs.readdirSync(process.cwd()));

const pkgrollBinPath = path.resolve('./dist/cli.js');

console.log('bin', pkgrollBinPath);
console.log('contents', fs.readdirSync(path.dirname(pkgrollBinPath)));

