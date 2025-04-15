/**
 * Script para criar um pacote de distribuição do projeto RIRA 21
 * Cria um arquivo .tar.gz com os arquivos essenciais do projeto
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Função para executar comandos
function execCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`Executando: ${command}`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Erro: ${error.message}`);
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

// Função para escapar caminhos com espaços
function escapePath(path) {
  return `"${path}"`;
}

// Função principal
async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const distDir = path.join(rootDir, 'dist');
  const packageDir = path.join(rootDir, 'package');
  const version = require('../package.json').version;
  const packageName = `rira-21-v${version}`;
  
  console.log("=== CRIANDO PACOTE DE DISTRIBUIÇÃO ===");
  
  try {
    // Criar diretório temporário para o pacote
    if (fs.existsSync(packageDir)) {
      await execCommand(`rm -rf ${escapePath(packageDir)}`);
    }
    
    fs.mkdirSync(packageDir, { recursive: true });
    
    // Verificar se o diretório dist existe e está pronto
    if (!fs.existsSync(distDir)) {
      console.log("Diretório dist/ não encontrado, executando build...");
      await execCommand('npm run prod:build');
    }
    
    // Copiar arquivos essenciais
    const filesToInclude = [
      { src: 'dist', dest: 'dist' },
      { src: 'package.json', dest: 'package.json' },
      { src: 'README.md', dest: 'README.md' },
      { src: 'docs', dest: 'docs' }
    ];
    
    for (const file of filesToInclude) {
      const src = path.join(rootDir, file.src);
      const dest = path.join(packageDir, file.dest);
      
      if (fs.existsSync(src)) {
        if (fs.lstatSync(src).isDirectory()) {
          await execCommand(`cp -r ${escapePath(src)} ${escapePath(dest)}`);
        } else {
          await execCommand(`cp ${escapePath(src)} ${escapePath(dest)}`);
        }
        console.log(`Copiado: ${file.src} -> ${file.dest}`);
      } else {
        console.warn(`Aviso: ${file.src} não encontrado, ignorando.`);
      }
    }
    
    // Criar arquivo de instruções
    const instructions = `
# RIRA 21 - Sistema Minimalista de Comunicação Interna
Versão: ${version}

## Instruções de Instalação

1. Descompacte este arquivo
2. Instale as dependências: npm install --production
3. Inicie o servidor: npm run start

## Acesso

- Painel de Controle: http://localhost:3001/painel
- Interface da TV: http://localhost:3001/tv
- Status do Sistema: http://localhost:3001/status

`;
    
    fs.writeFileSync(path.join(packageDir, 'INSTRUÇÕES.txt'), instructions, 'utf8');
    
    // Criar o arquivo tar.gz
    const tarFileName = `${packageName}.tar.gz`;
    await execCommand(`tar -czf ${escapePath(tarFileName)} -C ${escapePath(packageDir)} .`);
    
    // Medir tamanho do pacote
    const packageSize = await execCommand(`du -sh ${escapePath(tarFileName)}`);
    
    console.log(`\nPacote criado com sucesso: ${tarFileName}`);
    console.log(`Tamanho do pacote: ${packageSize}`);
    
    // Limpar diretório temporário
    await execCommand(`rm -rf ${escapePath(packageDir)}`);
    
    console.log("===============================");
  } catch (error) {
    console.error(`Erro durante a criação do pacote: ${error}`);
    process.exit(1);
  }
}

// Executar script
main().catch(error => {
  console.error(`Erro: ${error}`);
  process.exit(1);
}); 