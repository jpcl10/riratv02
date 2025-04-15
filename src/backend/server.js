/**
 * Servidor principal do Sistema RIRA 21
 * Sistema de Comunicação Interna para Consultórios e Clínicas
 */

// Importações de módulos principais
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");

// Importações de módulos internos
const config = require('./config/config');
const setupRoutes = require('./routes/routes');
const { 
  setupSecurityMiddleware, 
  setupSocketSecurity,
  sanitizeInput 
} = require('./utils/security');
const { setupSocketEvents } = require('./controllers/socketController');

// Inicialização da aplicação Express
const app = express();

// Limitar tamanho do corpo das requisições
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ limit: '1mb', extended: false }));

// Configurações de CORS
app.use(cors(config.security.cors));

// Configurações de segurança
setupSecurityMiddleware(app);

// Middleware para sanitizar dados de entrada
app.use((req, res, next) => {
  if (req.body) req.body = sanitizeInput(req.body);
  if (req.query) req.query = sanitizeInput(req.query);
  if (req.params) req.params = sanitizeInput(req.params);
  next();
});

// Configuração de rotas
setupRoutes(app);

// Criação do servidor HTTP
const server = http.createServer(app);

// Configuração do Socket.io com opções mais seguras
const io = socketIo(server, {
  cors: config.security.cors,
  maxHttpBufferSize: 1e6, // 1MB 
  pingTimeout: 60000, // 60 segundos
  pingInterval: 25000, // 25 segundos
  transports: ['websocket', 'polling'],
  allowEIO3: false // Força EIO versão 4 ou posterior
});

// Configuração de segurança para Socket.io
setupSocketSecurity(io, config.security.cors);

// Configuração dos eventos do Socket.io
io.on("connection", setupSocketEvents);

// Tratamento de erros do servidor
server.on('error', (error) => {
  console.error('Erro no servidor:', error);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('Erro não capturado:', error);
  // Em produção, pode ser interessante notificar administradores
  // mas não fechar o servidor, apenas registrar o erro
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promessa rejeitada não tratada:', reason);
});

// Iniciar o servidor
server.listen(config.server.port, '0.0.0.0', () => {
  console.log(`\n======================================`);
  console.log(`🚀 Servidor ${config.system.name} rodando na porta ${config.server.port}`);
  
  if (config.server.isReplit) {
    console.log(`📺 Acesse o servidor através da URL do seu Replit`);
    console.log(`   Use os caminhos: /tv ou /painel`);
  } else {
    console.log(`📺 TV: http://localhost:${config.server.port}/tv`);
    console.log(`🎛️ Painel: http://localhost:${config.server.port}/painel`);
    console.log(`📊 Status: http://localhost:${config.server.port}/status`);
    
    // Exibir também o endereço IP local para acesso em rede
    console.log(`\n📡 Acesso na rede local:`);
    console.log(`   TV: http://192.168.1.223:${config.server.port}/tv`);
    console.log(`   Painel: http://192.168.1.223:${config.server.port}/painel`);
  }
  
  console.log(`Iniciado em: ${new Date().toLocaleString('pt-BR')}`);
  console.log(`======================================\n`);
}); 