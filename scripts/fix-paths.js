import fs from 'fs';
import path from 'path';

const distDir = 'dist/chrome-mv3';

// Fix popup.html
const popupPath = path.join(distDir, 'popup.html');
if (fs.existsSync(popupPath)) {
  let content = fs.readFileSync(popupPath, 'utf8');
  content = content.replace(/src="\/chunks\//g, 'src="chunks/');
  content = content.replace(/href="\/assets\//g, 'href="assets/');
  fs.writeFileSync(popupPath, content);
  console.log('Fixed paths in popup.html');
}
