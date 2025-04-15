/**
 * Script de Otimização do Projeto RIRA 21
 * Executa uma série de tarefas para reduzir o tamanho do projeto
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Cores para console
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

/**
 * Executa um comando no terminal
 * @param {string} command - Comando a ser executado
 * @returns {Promise<string>} - Saída do comando
 */
function execCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`${COLORS.blue}Executando: ${command}${COLORS.reset}`);
    exec(command, { cwd: ROOT_DIR }, (error, stdout, stderr) => {
      if (error) {
        console.error(`${COLORS.red}Erro: ${error.message}${COLORS.reset}`);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.warn(`${COLORS.yellow}Aviso: ${stderr}${COLORS.reset}`);
      }
      
      resolve(stdout.trim());
    });
  });
}

/**
 * Cria um diretório se ele não existir
 * @param {string} dir - Caminho do diretório
 */
function createDirIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`${COLORS.green}Diretório criado: ${dir}${COLORS.reset}`);
  }
}

/**
 * Limpa o projeto para otimização
 */
async function cleanProject() {
  console.log(`\n${COLORS.blue}=== LIMPANDO PROJETO ===${COLORS.reset}`);
  
  // Remover node_modules e arquivos temporários
  await execCommand('npm run clean');
  
  // Limpar diretório de build, se existir
  if (fs.existsSync(DIST_DIR)) {
    await execCommand(`rm -rf ${DIST_DIR}`);
    console.log(`${COLORS.green}Diretório dist/ removido${COLORS.reset}`);
  }
  
  console.log(`${COLORS.green}Limpeza concluída${COLORS.reset}`);
}

/**
 * Instala apenas dependências de produção
 */
async function installProductionDeps() {
  console.log(`\n${COLORS.blue}=== INSTALANDO DEPENDÊNCIAS DE PRODUÇÃO ===${COLORS.reset}`);
  
  await execCommand('npm install --production');
  
  // Listar dependências instaladas
  const deps = await execCommand('npm ls --prod --depth=0');
  console.log(`${COLORS.green}Dependências de produção instaladas:${COLORS.reset}`);
  console.log(deps);
}

/**
 * Prepara estrutura para otimização
 */
async function prepareStructure() {
  console.log(`\n${COLORS.blue}=== PREPARANDO ESTRUTURA ===${COLORS.reset}`);
  
  // Criar diretórios necessários
  createDirIfNotExists(DIST_DIR);
  createDirIfNotExists(path.join(ROOT_DIR, 'config'));
  createDirIfNotExists(path.join(ROOT_DIR, 'scripts'));
  
  console.log(`${COLORS.green}Estrutura preparada${COLORS.reset}`);
}

/**
 * Copia arquivos essenciais para o diretório de build
 */
async function copyEssentialFiles() {
  console.log(`\n${COLORS.blue}=== COPIANDO ARQUIVOS ESSENCIAIS ===${COLORS.reset}`);
  
  // Copiar backend
  await execCommand('cp -r src/backend dist/');
  
  // Copiar frontend (apenas o necessário)
  await execCommand('mkdir -p dist/frontend/tv dist/frontend/painel');
  await execCommand('cp -r src/frontend/tv/index.html dist/frontend/tv/');
  await execCommand('cp -r src/frontend/tv/assets dist/frontend/tv/');
  await execCommand('cp -r src/frontend/painel/index.html dist/frontend/painel/');
  
  console.log(`${COLORS.green}Arquivos essenciais copiados para dist/${COLORS.reset}`);
}

/**
 * Mede o tamanho do projeto
 */
async function measureSize() {
  console.log(`\n${COLORS.blue}=== MEDINDO TAMANHO DO PROJETO ===${COLORS.reset}`);
  
  // Tamanho total
  const totalSize = await execCommand('du -sh .');
  console.log(`${COLORS.green}Tamanho total: ${totalSize}${COLORS.reset}`);
  
  // Top 5 maiores diretórios
  const topDirs = await execCommand('find . -type d -not -path "./node_modules/*" -not -path "./.git*" -exec du -sh {} \\; | sort -hr | head -5');
  console.log(`${COLORS.green}Top 5 maiores diretórios:${COLORS.reset}`);
  console.log(topDirs);
  
  // Número de arquivos
  const fileCount = await execCommand('find . -type f -not -path "./node_modules/*" -not -path "./.git*" | wc -l');
  console.log(`${COLORS.green}Número de arquivos (excluindo node_modules): ${fileCount}${COLORS.reset}`);
}

/**
 * Função principal que executa todas as etapas
 */
async function main() {
  console.log(`\n${COLORS.blue}======================================${COLORS.reset}`);
  console.log(`${COLORS.blue}    OTIMIZAÇÃO DO PROJETO RIRA 21${COLORS.reset}`);
  console.log(`${COLORS.blue}======================================${COLORS.reset}`);
  
  // Medir tamanho antes da otimização
  await measureSize();
  
  // Executar etapas de otimização
  await cleanProject();
  await prepareStructure();
  await installProductionDeps();
  await copyEssentialFiles();
  
  // Medir tamanho após otimização
  await measureSize();
  
  console.log(`\n${COLORS.green}======================================${COLORS.reset}`);
  console.log(`${COLORS.green}    OTIMIZAÇÃO CONCLUÍDA${COLORS.reset}`);
  console.log(`${COLORS.green}======================================${COLORS.reset}`);
  console.log(`\n${COLORS.yellow}Para executar a versão otimizada: node dist/backend/server.js${COLORS.reset}`);
}

// Executar script
main().catch(error => {
  console.error(`${COLORS.red}Erro durante a otimização: ${error}${COLORS.reset}`);
  process.exit(1);
}); 