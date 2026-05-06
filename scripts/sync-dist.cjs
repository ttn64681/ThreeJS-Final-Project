// Lightweight script to sync code/ to dist/
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..'); // -> ../
const src = path.join(root, 'code');  // -> ../code/
const dest = path.join(root, 'dist'); // -> ../dist/

// rmSync - remove dest/
// cpSync - copy src/ to dest/
fs.rmSync(dest, { recursive: true, force: true });
const skipReadme = path.join(src, 'README.txt');
fs.cpSync(src, dest, {
    recursive: true,
    // Exclude only code/README.txt (not other README.txt under subfolders)
    filter: (srcPath) => path.normalize(srcPath) !== path.normalize(skipReadme),
});
