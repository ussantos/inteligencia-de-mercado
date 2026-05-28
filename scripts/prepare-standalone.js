// Este script roda depois do "next build".
// O Next cria o servidor pequeno em ".next/standalone", mas os arquivos estaticos ficam em outras pastas.
// Copiamos esses arquivos para dentro do pacote standalone para o Azure publicar tudo junto.
// Tambem copiamos o Prisma gerado, porque ele carrega binarios nativos diferentes conforme o Linux do Azure.
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
copyIfExists(path.join(root, 'node_modules', '.prisma'), path.join(standaloneDir, 'node_modules', '.prisma'));
copyIfExists(path.join(root, 'node_modules', '@prisma', 'client'), path.join(standaloneDir, 'node_modules', '@prisma', 'client'));
