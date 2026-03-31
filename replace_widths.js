import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function processFile(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Replacements
  content = content.replace(/max-w-lg/g, 'max-w-7xl');
  content = content.replace(/max-w-md/g, 'max-w-7xl');
  content = content.replace(/max-w-4xl/g, 'max-w-7xl');
  content = content.replace(/sm:max-w-\[425px\]/g, 'sm:max-w-lg');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

const targetDir = path.join(__dirname, 'src');
walkDir(targetDir, processFile);
console.log('Done replacing constraints.');
