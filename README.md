# RIRA 21 - Sistema de Comunicação Interna

Sistema de comunicação interna para consultórios e clínicas, permitindo o envio de alertas, tarefas e conteúdo multimídia para TVs na recepção.

## Funcionalidades

- **Alertas em tempo real**: Envio de mensagens de emergência para TVs
- **Agenda de compromissos**: Gerenciamento visual de compromissos
- **Mídia**: Exibição de imagens e vídeos
- **Enquetes**: Criação de pesquisas simples para pacientes
- **QR Code**: Geração de QR Codes para informações adicionais

## Estrutura do Projeto

```
rira-21/
├── dist/             # Arquivos minificados para produção
├── scripts/          # Scripts de automação e build
├── src/              # Código-fonte do projeto
│   ├── backend/      # Servidor e API
│   └── frontend/     # Interfaces de usuário
│       ├── tv/       # Interface para exibição (TV)
│       └── painel/   # Interface para administração
└── tests/            # Testes automatizados
```

## Requisitos

- Node.js 14 ou superior
- NPM 6 ou superior

## Instalação

```bash
# Instalar dependências
npm install

# Iniciar em modo desenvolvimento
npm run dev

# Construir versão de produção
npm run prod:build

# Iniciar servidor de produção
npm run start:prod
```

## Uso

Após iniciar o servidor, acesse:

- **Painel de Controle**: http://localhost:3001/painel
- **Interface da TV**: http://localhost:3001/tv

## Manutenção

Para limpar o projeto e remover arquivos temporários:

```bash
npm run clean
```

Para sanitizar e otimizar a aplicação:

```bash
npm run minify
```

## Resolução de Problemas

### Problemas de Memória (Erro "Killed")

Se o servidor for encerrado abruptamente com mensagem "Killed", isso geralmente indica que o sistema operacional encerrou o processo devido ao consumo excessivo de memória.

#### Soluções:

1. **Use o modo de produção seguro**
   ```
   npm run start:prod:safe
   ```
   Este comando inicia o servidor com limites de memória adequados e logs aprimorados.

2. **Aumente a memória disponível**
   ```
   NODE_OPTIONS=--max-old-space-size=1024 npm run start:prod
   ```
   Isso aumenta o limite de heap para 1GB.

3. **Monitore o uso de memória**
   ```
   ps -o pid,rss,command ax | grep "node"
   ```
   Este comando mostra o uso de memória (RSS) dos processos Node.js em KB.

4. **Verifique arquivos de mídia**
   Certifique-se de que os arquivos de áudio em `/assets/sounds/` sejam válidos e não estejam corrompidos.

5. **Limpe recursos não utilizados**
   ```
   npm run clean
   ```
   Remove arquivos temporários e caches desnecessários.

### Melhorias de Desempenho

Para melhorar o desempenho em ambientes com recursos limitados:

1. Reduza o número máximo de conexões simultâneas em `production-server.js`
2. Defina timeouts mais curtos para desconexão de sockets inativos
3. Use o comando `start:prod:safe` que inclui otimizações de memória
4. Evite o uso excessivo de mídias pesadas na interface da TV

## Licença

MIT 