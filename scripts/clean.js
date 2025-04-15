/**
 * Script para limpeza e organização do projeto RIRA 21
 * Remove arquivos temporários, arquivos desnecessários e organiza a estrutura do projeto
 * Envia arquivos removidos para a lixeira do desktop
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Diretório raiz do projeto
const ROOT_DIR = path.resolve(__dirname, '..');
// Caminho para a lixeira do desktop
const DESKTOP_PATH = path.join(os.homedir(), 'Desktop');
const TRASH_PATH = path.join(DESKTOP_PATH, 'RIRA21_LIXEIRA');

// Cores para o console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

/**
 * Cria a pasta de lixeira no desktop se não existir
 */
function criarPastaLixeira() {
  if (!fs.existsSync(TRASH_PATH)) {
    try {
      fs.mkdirSync(TRASH_PATH, { recursive: true });
      console.log(`${colors.green}✓ Pasta de lixeira criada: ${TRASH_PATH}${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}✗ Erro ao criar pasta de lixeira: ${error.message}${colors.reset}`);
      // Se não conseguir criar a lixeira, continua sem ela
    }
  }
}

/**
 * Move arquivos e diretórios para a lixeira
 * @param {string} targetPath - Caminho do arquivo/diretório a ser movido
 * @param {boolean} isDir - Se é um diretório
 */
function moverParaLixeira(targetPath, isDir = false) {
  if (!fs.existsSync(targetPath)) return;
  
  try {
    // Obtém o nome base do arquivo/diretório
    const baseName = path.basename(targetPath);
    // Adiciona timestamp para evitar conflitos de nome
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const destinationPath = path.join(TRASH_PATH, `${baseName}_${timestamp}`);
    
    // Se a lixeira não existir, exclui diretamente
    if (!fs.existsSync(TRASH_PATH)) {
      if (isDir) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
      console.log(`${colors.yellow}⚠ Lixeira não encontrada, item excluído permanentemente: ${targetPath}${colors.reset}`);
      return;
    }
    
    // Copia o arquivo/diretório para a lixeira
    if (isDir) {
      execSync(`cp -r "${targetPath}" "${destinationPath}"`, { stdio: 'ignore' });
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.copyFileSync(targetPath, destinationPath);
      fs.unlinkSync(targetPath);
    }
    
    console.log(`${colors.green}✓ Item movido para lixeira: ${targetPath} → ${destinationPath}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}✗ Erro ao mover para lixeira ${targetPath}: ${error.message}${colors.reset}`);
    
    // Se falhar ao mover, exclui diretamente
    try {
      if (isDir) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
      console.log(`${colors.yellow}⚠ Item excluído diretamente: ${targetPath}${colors.reset}`);
    } catch (err) {
      console.error(`${colors.red}✗ Erro ao excluir ${targetPath}: ${err.message}${colors.reset}`);
    }
  }
}

/**
 * Limpa diretórios vazios recursivamente
 * @param {string} directory - Diretório a ser verificado
 */
function limparDiretoriosVazios(directory) {
  if (!fs.existsSync(directory)) return;
  
  // Ignora node_modules e a lixeira
  if (directory.includes('node_modules') || directory.includes('RIRA21_LIXEIRA')) return;

  const items = fs.readdirSync(directory);
  
  // Processa subdiretórios primeiro
  for (const item of items) {
    const fullPath = path.join(directory, item);
    if (fs.statSync(fullPath).isDirectory()) {
      limparDiretoriosVazios(fullPath);
    }
  }
  
  // Verifica novamente após potencialmente limpar subdiretórios
  const remainingItems = fs.readdirSync(directory);
  if (remainingItems.length === 0 && directory !== ROOT_DIR) {
    moverParaLixeira(directory, true);
  }
}

/**
 * Executa limpeza principal do projeto
 */
function limparProjeto() {
  console.log(`\n${colors.blue}=== INICIANDO LIMPEZA DO PROJETO ===${colors.reset}\n`);
  
  // Criar pasta de lixeira no desktop
  criarPastaLixeira();
  
  // Lista de diretórios para remover
  const dirsToRemove = [
    path.join(ROOT_DIR, 'dist'),
    path.join(ROOT_DIR, '.lixeira'),
    path.join(ROOT_DIR, 'logs'),
    path.join(ROOT_DIR, 'tests', 'unit'), // Diretório vazio
  ];
  
  // Lista de arquivos para remover
  const filesToRemove = [
    path.join(ROOT_DIR, 'rira-21-v1.0.0.tar.gz'),
    path.join(ROOT_DIR, 'INSTRUÇÕES-OTIMIZAÇÃO.md'),
    // Documentos desnecessários que podem ser consolidados
    path.join(ROOT_DIR, 'docs', 'otimizacao-avancada.md'),
    path.join(ROOT_DIR, 'docs', 'otimizacao.md'),
    path.join(ROOT_DIR, 'docs', 'resultados-teste.md'),
  ];
  
  // Remove diretórios
  console.log(`${colors.yellow}Removendo diretórios desnecessários...${colors.reset}`);
  dirsToRemove.forEach(dir => moverParaLixeira(dir, true));
  
  // Remove arquivos
  console.log(`\n${colors.yellow}Removendo arquivos desnecessários...${colors.reset}`);
  filesToRemove.forEach(file => moverParaLixeira(file, false));
  
  // Limpa node_modules se existir
  if (fs.existsSync(path.join(ROOT_DIR, 'node_modules'))) {
    console.log(`\n${colors.yellow}Limpando node_modules...${colors.reset}`);
    try {
      execSync('npm prune --production', { cwd: ROOT_DIR });
      console.log(`${colors.green}✓ Dependências de desenvolvimento removidas${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}✗ Erro ao limpar node_modules: ${error.message}${colors.reset}`);
    }
  }
  
  // Limpa diretórios vazios
  console.log(`\n${colors.yellow}Limpando diretórios vazios...${colors.reset}`);
  limparDiretoriosVazios(ROOT_DIR);
  
  // Organiza documentação
  console.log(`\n${colors.yellow}Organizando documentação...${colors.reset}`);
  const docsDir = path.join(ROOT_DIR, 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
    console.log(`${colors.green}✓ Diretório de documentação criado${colors.reset}`);
  }
  
  console.log(`\n${colors.green}=== LIMPEZA CONCLUÍDA ===${colors.reset}`);
  console.log(`${colors.blue}Estrutura do projeto otimizada e organizada${colors.reset}`);
  console.log(`${colors.yellow}Arquivos removidos foram enviados para: ${TRASH_PATH}${colors.reset}\n`);
}

// Executar script
try {
  limparProjeto();
} catch (error) {
  console.error(`${colors.red}Erro durante a limpeza: ${error.message}${colors.reset}`);
  process.exit(1);
} 