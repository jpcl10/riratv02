/**
 * Script para minificar arquivos HTML e JavaScript
 * Reduz o tamanho dos arquivos removendo espaços, comentários e formatação
 * Versão: 1.2.0
 */

const fs = require('fs');
const path = require('path');

// Cores para console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Configurações
const CONFIGURACOES = {
  // Lista de arquivos que não devem ser processados
  ARQUIVOS_IGNORADOS: ['.DS_Store', 'Thumbs.db', '.gitkeep'],
  // Tamanho máximo de arquivo para processamento (10MB)
  TAMANHO_MAXIMO: 10 * 1024 * 1024
};

/**
 * Minifica conteúdo HTML
 * @param {string} content - Conteúdo HTML
 * @returns {string} Conteúdo HTML minificado
 */
function minifyHTML(content) {
  try {
    const resultado = content
      // Remover comentários
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remover quebras de linha e espaços extras
      .replace(/\s+/g, ' ')
      // Remover espaços entre tags
      .replace(/>\s+</g, '><')
      // Remover espaços antes de fechar tags
      .replace(/\s+>/g, '>')
      // Remover espaços após abrir tags
      .replace(/<\s+/g, '<')
      // Remover espaços extras em atributos
      .replace(/\s{2,}/g, ' ')
      .trim();
    
    return resultado;
  } catch (error) {
    console.error(`${colors.red}Erro ao minificar HTML: ${error.message}${colors.reset}`);
    return content; // Retorna conteúdo original em caso de erro
  }
}

/**
 * Minifica conteúdo JavaScript
 * @param {string} content - Conteúdo JavaScript
 * @returns {string} Conteúdo JavaScript minificado
 */
function minifyJS(content) {
  try {
    // Esta é uma versão simplificada - em um projeto real, usar terser ou uglify-js
    const resultado = content
      // Remover comentários de uma linha
      .replace(/\/\/.*$/gm, '')
      // Remover comentários de múltiplas linhas
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remover quebras de linha e espaços extras
      .replace(/\s+/g, ' ')
      // Remover espaços antes/depois de operadores
      .replace(/\s*([=+\-*/<>!?:;,{}()[\]])\s*/g, '$1')
      .trim();
    
    return resultado;
  } catch (error) {
    console.error(`${colors.red}Erro ao minificar JavaScript: ${error.message}${colors.reset}`);
    return content; // Retorna conteúdo original em caso de erro
  }
}

/**
 * Minifica um arquivo
 * @param {string} inputFile - Caminho do arquivo de entrada
 * @param {string} outputFile - Caminho do arquivo de saída
 * @param {string} type - Tipo de arquivo (html, js)
 * @returns {object|null} Estatísticas de minificação ou null em caso de erro
 */
function minifyFile(inputFile, outputFile, type) {
  try {
    // Verificações de segurança
    if (!fs.existsSync(inputFile)) {
      throw new Error(`Arquivo não encontrado: ${inputFile}`);
    }
    
    // Verifica o tamanho do arquivo
    const stats = fs.statSync(inputFile);
    if (stats.size > CONFIGURACOES.TAMANHO_MAXIMO) {
      console.warn(`${colors.yellow}⚠ Arquivo muito grande (${Math.round(stats.size/1024)}KB), pulando: ${inputFile}${colors.reset}`);
      return null;
    }
    
    console.log(`${colors.blue}Minificando: ${inputFile}${colors.reset}`);
    
    // Ler o conteúdo do arquivo
    const content = fs.readFileSync(inputFile, 'utf8');
    
    // Minificar baseado no tipo
    let minified;
    if (type === 'html') {
      minified = minifyHTML(content);
    } else if (type === 'js') {
      minified = minifyJS(content);
    } else {
      throw new Error(`Tipo não suportado: ${type}`);
    }
    
    // Calcular taxa de compressão
    const originalSize = content.length;
    const minifiedSize = minified.length;
    const reduction = ((originalSize - minifiedSize) / originalSize * 100).toFixed(2);
    
    // Garantir que o diretório de destino exista
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Salvar arquivo minificado
    fs.writeFileSync(outputFile, minified);
    
    console.log(`${colors.green}✓ Minificado: ${outputFile}${colors.reset}`);
    console.log(`${colors.cyan}ℹ Redução: ${reduction}% (${originalSize} → ${minifiedSize} bytes)${colors.reset}`);
    
    return {
      originalSize,
      minifiedSize,
      reduction,
      inputFile,
      outputFile
    };
  } catch (error) {
    console.error(`${colors.red}✗ Erro ao minificar ${inputFile}: ${error.message}${colors.reset}`);
    return null;
  }
}

/**
 * Copia um arquivo com validação
 * @param {string} sourcePath - Caminho do arquivo de origem
 * @param {string} targetPath - Caminho do arquivo de destino
 * @returns {boolean} Sucesso da operação
 */
function copyFile(sourcePath, targetPath) {
  try {
    // Verifica se o arquivo de origem existe
    if (!fs.existsSync(sourcePath)) {
      console.warn(`${colors.yellow}⚠ Arquivo de origem não encontrado: ${sourcePath}${colors.reset}`);
      return false;
    }
    
    // Verifica se é um dos arquivos para ignorar
    const fileName = path.basename(sourcePath);
    if (CONFIGURACOES.ARQUIVOS_IGNORADOS.includes(fileName)) {
      console.log(`${colors.yellow}ℹ Ignorando arquivo: ${sourcePath}${colors.reset}`);
      return false;
    }
    
    // Garante que o diretório de destino exista
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Copia o arquivo
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`${colors.green}✓ Copiado: ${sourcePath} → ${targetPath}${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Erro ao copiar ${sourcePath}: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Copia um diretório recursivamente
 * @param {string} sourceDir - Diretório de origem
 * @param {string} targetDir - Diretório de destino
 * @returns {number} Número de arquivos copiados
 */
function copyDirectory(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    console.warn(`${colors.yellow}⚠ Diretório de origem não encontrado: ${sourceDir}${colors.reset}`);
    return 0;
  }
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  console.log(`${colors.blue}Copiando diretório: ${sourceDir} → ${targetDir}${colors.reset}`);
  
  let copiedFiles = 0;
  
  try {
    const items = fs.readdirSync(sourceDir);
    
    for (const item of items) {
      // Pula arquivos ocultos e arquivos da lista de ignorados
      if (item.startsWith('.') || CONFIGURACOES.ARQUIVOS_IGNORADOS.includes(item)) {
        continue;
      }
      
      const sourcePath = path.join(sourceDir, item);
      const targetPath = path.join(targetDir, item);
      
      const stat = fs.statSync(sourcePath);
      
      if (stat.isFile()) {
        if (copyFile(sourcePath, targetPath)) {
          copiedFiles++;
        }
      } else if (stat.isDirectory()) {
        copiedFiles += copyDirectory(sourcePath, targetPath);
      }
    }
    
    return copiedFiles;
  } catch (error) {
    console.error(`${colors.red}✗ Erro ao copiar diretório ${sourceDir}: ${error.message}${colors.reset}`);
    return copiedFiles;
  }
}

/**
 * Função principal
 */
function main() {
  const rootDir = path.resolve(__dirname, '..');
  
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}  MINIFICAÇÃO DE ARQUIVOS RIRA 21 v1.2.0  ${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  // Criar diretório dist se não existir
  const distDir = path.join(rootDir, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
    console.log(`${colors.green}✓ Diretório dist/ criado${colors.reset}`);
  }
  
  // Criar diretórios para arquivos minificados
  fs.mkdirSync(path.join(distDir, 'frontend', 'tv'), { recursive: true });
  fs.mkdirSync(path.join(distDir, 'frontend', 'painel'), { recursive: true });
  
  // Minificar arquivos HTML
  const htmlFiles = [
    {
      input: path.join(rootDir, 'src', 'frontend', 'tv', 'index.html'),
      output: path.join(distDir, 'frontend', 'tv', 'index.html'),
      type: 'html'
    },
    {
      input: path.join(rootDir, 'src', 'frontend', 'painel', 'index.html'),
      output: path.join(distDir, 'frontend', 'painel', 'index.html'),
      type: 'html'
    }
  ];
  
  // Processar cada arquivo HTML
  let totalOriginal = 0;
  let totalMinified = 0;
  let arquivosProcessados = 0;
  
  console.log(`\n${colors.blue}=== MINIFICAÇÃO DE ARQUIVOS HTML ===${colors.reset}`);
  
  htmlFiles.forEach(file => {
    const resultado = minifyFile(file.input, file.output, file.type);
    if (resultado) {
      totalOriginal += resultado.originalSize;
      totalMinified += resultado.minifiedSize;
      arquivosProcessados++;
    }
  });
  
  // Minificar arquivos JavaScript separados (se existirem)
  console.log(`\n${colors.blue}=== MINIFICAÇÃO DE ARQUIVOS JAVASCRIPT ===${colors.reset}`);
  
  // Procurar por arquivos JS em ambos os diretórios
  const jsDirs = [
    path.join(rootDir, 'src', 'frontend', 'tv', 'js'),
    path.join(rootDir, 'src', 'frontend', 'painel', 'js')
  ];
  
  jsDirs.forEach(jsDir => {
    if (fs.existsSync(jsDir)) {
      const jsFiles = fs.readdirSync(jsDir)
        .filter(file => file.endsWith('.js') && !CONFIGURACOES.ARQUIVOS_IGNORADOS.includes(file));
      
      if (jsFiles.length === 0) {
        console.log(`${colors.yellow}ℹ Nenhum arquivo JavaScript encontrado em: ${jsDir}${colors.reset}`);
        return;
      }
      
      jsFiles.forEach(jsFile => {
        const inputJsFile = path.join(jsDir, jsFile);
        const relativePath = path.relative(path.join(rootDir, 'src'), jsDir);
        const outputJsDir = path.join(distDir, relativePath);
        const outputJsFile = path.join(outputJsDir, jsFile);
        
        const resultado = minifyFile(inputJsFile, outputJsFile, 'js');
        if (resultado) {
          totalOriginal += resultado.originalSize;
          totalMinified += resultado.minifiedSize;
          arquivosProcessados++;
        }
      });
    }
  });
  
  // Copiar arquivos de assets para ambos TV e painel
  console.log(`\n${colors.blue}=== COPIANDO ARQUIVOS DE ASSETS ===${colors.reset}`);
  
  const assetsSrcDirs = [
    { src: path.join(rootDir, 'src', 'frontend', 'tv', 'assets'), 
      dest: path.join(distDir, 'frontend', 'tv', 'assets') },
    { src: path.join(rootDir, 'src', 'frontend', 'painel', 'assets'), 
      dest: path.join(distDir, 'frontend', 'painel', 'assets') }
  ];
  
  let copiedFiles = 0;
  
  assetsSrcDirs.forEach(dirPair => {
    if (fs.existsSync(dirPair.src)) {
      copiedFiles += copyDirectory(dirPair.src, dirPair.dest);
    }
  });
  
  // Estatísticas finais
  console.log(`\n${colors.blue}=== RESUMO DA MINIFICAÇÃO ===${colors.reset}`);
  console.log(`${colors.cyan}ℹ Arquivos processados: ${arquivosProcessados}${colors.reset}`);
  console.log(`${colors.cyan}ℹ Arquivos copiados: ${copiedFiles}${colors.reset}`);
  
  if (arquivosProcessados > 0) {
    const totalReduction = ((totalOriginal - totalMinified) / totalOriginal * 100).toFixed(2);
    console.log(`${colors.cyan}ℹ Total original: ${totalOriginal} bytes${colors.reset}`);
    console.log(`${colors.cyan}ℹ Total minificado: ${totalMinified} bytes${colors.reset}`);
    console.log(`${colors.green}✓ Redução total: ${totalReduction}%${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠ Nenhum arquivo foi minificado${colors.reset}`);
  }
  
  console.log(`${colors.blue}===============================${colors.reset}\n`);
  console.log(`${colors.green}✓ Minificação concluída com sucesso!${colors.reset}\n`);
}

// Executar script
try {
  main();
} catch (error) {
  console.error(`\n${colors.red}✗ Erro durante a minificação: ${error.message}${colors.reset}`);
  console.error(`${colors.red}Detalhes: ${error.stack}${colors.reset}\n`);
  process.exit(1);
} 