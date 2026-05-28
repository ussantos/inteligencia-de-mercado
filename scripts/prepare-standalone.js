// Este script roda depois do "next build".
// O Next cria o servidor pequeno em ".next/standalone", mas os arquivos estaticos ficam em outras pastas.
// Copiamos esses arquivos para dentro do pacote standalone para o Azure publicar tudo junto.
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const standaloneDir = path.join(root, '.next', 'standalone');

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

copyIfExists(path.join(root, '.next', 'static'), path.join(standaloneDir, '.next', 'static'));
copyIfExists(path.join(root, 'public'), path.join(standaloneDir, 'public'));
