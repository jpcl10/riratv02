#!/bin/bash

# Script de inicialização otimizado para produção do RIRA 21
# Versão 1.0.0

echo "==============================================="
echo "    INICIALIZANDO SERVIDOR RIRA 21 PRODUÇÃO    "
echo "==============================================="

# Diretório do script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/rira21-prod-$(date +%Y%m%d).log"

# Criar diretório de logs se não existir
mkdir -p "$LOG_DIR"

# Verificar se o diretório dist existe
if [ ! -d "$PROJECT_DIR/dist" ]; then
  echo "ERRO: Diretório dist não encontrado!"
  echo "Execute primeiro: npm run build"
  exit 1
fi

# Verificar se o arquivo do servidor existe
SERVER_FILE="$PROJECT_DIR/dist/backend/production-server.js"
if [ ! -f "$SERVER_FILE" ]; then
  echo "ERRO: Arquivo do servidor de produção não encontrado!"
  echo "Verifique se o build foi realizado corretamente."
  exit 1
fi

# Definir opções do Node.js
export NODE_OPTIONS="--max-old-space-size=512"

echo "Iniciando servidor com limite de memória: 512MB"
echo "Logs sendo salvos em: $LOG_FILE"
echo ""
echo "Pressione Ctrl+C para encerrar"
echo "==============================================="

# Iniciar o servidor com redirecionamento de logs
node "$SERVER_FILE" 2>&1 | tee -a "$LOG_FILE"

# Capturar código de saída
EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -ne 0 ]; then
  echo "ERRO: O servidor encerrou com código $EXIT_CODE"
  echo "Verifique os logs para mais detalhes: $LOG_FILE"
  exit $EXIT_CODE
fi 