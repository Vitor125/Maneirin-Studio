// Verifica sintaxe e dependências locais sem compilar ou publicar o site.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../public');
const files = fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith('.js'));
for (const file of files) {
    const fullPath = path.join(root, file);
    execFileSync(process.execPath, ['--check', fullPath], { stdio: 'inherit' });
    const source = fs.readFileSync(fullPath, 'utf8');
    for (const match of source.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"](\.[^'"]+)['"]/g)) {
        const dependency = path.resolve(path.dirname(fullPath), match[2]);
        const dependencySource = fs.readFileSync(dependency, 'utf8');
        for (const entry of match[1].split(',')) {
            const name = entry.trim().split(/\s+as\s+/)[0];
            if (!new RegExp(`export (?:async )?(?:function|const|let|class) ${name}\\b`).test(dependencySource)) {
                throw new Error(`${file}: exportação ${name} não encontrada em ${match[2]}`);
            }
        }
    }
}
for (const file of ['firebase.json', 'firestore.indexes.json', '.firebaserc', 'public/manifest.webmanifest']) {
    JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'));
}
console.log(`${files.length} arquivos JavaScript e configurações verificados.`);
