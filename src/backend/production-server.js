/**
 * Servidor otimizado para produção do Sistema RIRA 21
 * Versão 1.1.0 - Sanitizado e Otimizado
 */

// Módulos fundamentais
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const xss = require("xss-clean");
const hpp = require("hpp");

// Inicialização da aplicação
const app = express();
const PORT = process.env.PORT || 3001;
const clients = new Map(); // Usando Map em vez de objeto para melhor manipulação e limpeza

// Log simples
function log(tipo, mensagem) {
  const timestamp = new Date().toISOString();
  const tipoFormatado = tipo.toUpperCase().padEnd(7);
  console.log(`[${timestamp}] ${tipoFormatado} | ${mensagem}`);
}

// Log de erros
function logError(mensagem, erro) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERRO    | ${mensagem}: ${erro.message || erro}`);
}

// Função para sanitizar qualquer entrada de dados
function sanitizeInput(data) {
  if (!data) return {};
  const sanitized = {};
  
  if (typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Limitar tamanho e remover possíveis scripts ou HTML
        const cleanValue = value.trim();
        sanitized[key] = cleanValue.replace(/<(script|iframe|object|embed|form)/gi, '&lt;$1')
                                  .substring(0, 1000);
      } else if (typeof value === 'number') {
        // Validar números
        sanitized[key] = Number.isFinite(value) ? value : 0;
      } else if (Array.isArray(value)) {
        // Sanitizar arrays limitando tamanho
        sanitized[key] = value.slice(0, 100).map(item => {
          if (typeof item === 'string') {
            return item.trim()
                      .replace(/<(script|iframe|object|embed|form)/gi, '&lt;$1')
                      .substring(0, 1000);
          }
          return item;
        });
      } else if (typeof value === 'object' && value !== null) {
        // Recursivamente sanitizar objetos aninhados
        sanitized[key] = sanitizeInput(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  } else if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === 'object' && item !== null) {
        return sanitizeInput(item);
      }
      return item;
    });
  }
  
  return data;
}

// Configurações
app.use(cors({
  origin: ["http://localhost:3001", "http://127.0.0.1:3001"], // Limitar origens específicas
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.static(path.join(__dirname, '../frontend'), {
  maxAge: '1h' // Cache de 1 hora para arquivos estáticos
}));

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ limit: '1mb', extended: false }));

app.use(xss());
app.use(hpp());

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; connect-src 'self'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Feature-Policy', "camera 'none'; microphone 'none'; geolocation 'none'");
  res.setHeader('Permissions-Policy', "camera=(), microphone=(), geolocation=()");
  next();
});

// Log de requisições
app.use((req, res, next) => {
  // Filtrar arquivos estáticos para reduzir log
  if (!req.path.includes('.')) {
    log("http", `${req.method} ${req.url}`);
  }
  next();
});

// Handler de erros global para requisições
app.use((err, req, res, next) => {
  logError(`Erro na requisição ${req.method} ${req.url}`, err);
  res.status(500).json({
    error: "Erro interno do servidor",
    timestamp: new Date().toISOString()
  });
});

// Rotas principais
app.get('/', (req, res) => res.redirect('/tv'));
app.get('/tv', (req, res) => res.sendFile(path.join(__dirname, '../frontend/tv/index.html')));
app.get('/painel', (req, res) => res.sendFile(path.join(__dirname, '../frontend/painel/index.html')));
app.get('/status', (req, res) => res.json({
  status: 'online',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
  connections: getTotalConnections(),
  version: '1.1.0'
}));

// Configuração do servidor HTTP e Socket.io
const server = http.createServer(app);
const io = socketIo(server, { 
  cors: { 
    origin: ["http://localhost:3001", "http://127.0.0.1:3001"], // Limitar origens específicas
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  maxHttpBufferSize: 1e6, // 1MB
  pingTimeout: 60000, // 60 segundos
  pingInterval: 25000, // 25 segundos
  transports: ['websocket', 'polling']
});

// Limites para conexões simultâneas
const MAX_CONNECTIONS = 50;
let totalConnections = 0;

// Função para contar conexões totais
function getTotalConnections() {
  let count = 0;
  for (const [_, sockets] of clients) {
    count += sockets.length;
  }
  return count;
}

// Verificar estrutura dos arquivos
function verificarArquivos() {
  const tvHtmlPath = path.join(__dirname, '../frontend/tv/index.html');
  const painelHtmlPath = path.join(__dirname, '../frontend/painel/index.html');
  const tvAssetsPath = path.join(__dirname, '../frontend/tv/assets');
  
  let errosEncontrados = 0;
  
  // Verificar arquivos HTML principais
  if (!fs.existsSync(tvHtmlPath)) {
    logError('Arquivo TV HTML não encontrado', tvHtmlPath);
    errosEncontrados++;
  } else {
    log("info", `Arquivo TV HTML encontrado em ${tvHtmlPath}`);
  }
  
  if (!fs.existsSync(painelHtmlPath)) {
    logError('Arquivo Painel HTML não encontrado', painelHtmlPath);
    errosEncontrados++;
  } else {
    log("info", `Arquivo Painel HTML encontrado em ${painelHtmlPath}`);
  }
  
  // Verificar diretório de assets
  if (!fs.existsSync(tvAssetsPath)) {
    log("aviso", `Diretório de assets da TV não encontrado: ${tvAssetsPath}`);
  } else {
    // Verificar arquivos de som
    const soundsDir = path.join(tvAssetsPath, 'sounds');
    if (!fs.existsSync(soundsDir)) {
      log("aviso", `Diretório de sons não encontrado: ${soundsDir}`);
    } else {
      const soundFiles = [
        path.join(soundsDir, 'emergency.mp3'),
        path.join(soundsDir, 'notification.mp3'),
        path.join(soundsDir, 'reminder.mp3')
      ];
      
      soundFiles.forEach(file => {
        if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
          log("aviso", `Arquivo de som vazio ou inexistente: ${file}`);
        }
      });
    }
  }
  
  if (errosEncontrados > 0) {
    log("aviso", `Sistema iniciado com ${errosEncontrados} problema(s) de arquivos.`);
  } else {
    log("info", "Verificação de arquivos concluída com sucesso.");
  }
}

// Verificação de memória periódica
function verificarMemoria() {
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100
  };
  
  log("info", `Uso de memória: RSS ${memoryUsageMB.rss}MB, Heap Usado ${memoryUsageMB.heapUsed}MB / ${memoryUsageMB.heapTotal}MB`);
  
  // Forçar coleta de lixo se a memória estiver muito alta
  if (memoryUsageMB.heapUsed > 200) { // 200MB
    log("aviso", "Uso de memória alto. Sugerindo coleta de lixo.");
    if (global.gc) {
      global.gc();
      log("info", "Coleta de lixo forçada executada.");
    }
  }
}

// Função para adicionar delay aleatório para evitar ataques de temporização
function addRandomDelay() {
  const delayMs = Math.floor(Math.random() * 50) + 10; // 10-60ms
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

// Lógica de WebSocket
io.on("connection", (socket) => {
  // Limitar conexões
  if (totalConnections >= MAX_CONNECTIONS) {
    log("aviso", `Conexão rejeitada: limite de ${MAX_CONNECTIONS} atingido.`);
    socket.disconnect(true);
    return;
  }
  
  totalConnections++;
  log("socket", `Cliente conectado: ${socket.id} (${totalConnections} conexões ativas)`);
  
  // Id do cliente para limpeza na desconexão
  let clientId = null;
  
  // Registro de cliente
  socket.on("register", (data) => {
    try {
      // Sanitização e validação de entrada
      const sanitizedData = sanitizeInput(data);
      
      if (!sanitizedData || !sanitizedData.type || !sanitizedData.id) {
        log("aviso", `Tentativa de registro com dados inválidos: ${JSON.stringify(data)}`);
        socket.emit("registered", { 
          success: false, 
          message: "Dados de registro inválidos" 
        });
        return;
      }
      
      const { type, id } = sanitizedData;
      clientId = id;
      
      if (!clients.has(id)) {
        clients.set(id, []);
      }
      
      const clientSockets = clients.get(id);
      clientSockets.push(socket);
      
      log("info", `Cliente ${type} registrado com ID: ${id} (socket: ${socket.id})`);
      socket.emit("registered", { success: true, message: `Registrado como ${type}` });
    } catch (error) {
      logError(`Erro ao registrar cliente`, error);
      socket.emit("registered", { 
        success: false, 
        message: "Erro interno ao registrar" 
      });
    }
  });

  // Envio de mensagens
  socket.on("send_message", (data) => {
    try {
      // Sanitização e validação completa
      const sanitizedData = sanitizeInput(data);
      
      if (!sanitizedData || !sanitizedData.target || !sanitizedData.payload || !sanitizedData.payload.type) {
        log("aviso", `Mensagem inválida recebida do socket ${socket.id}`);
        socket.emit("message_sent", { success: false, error: "Mensagem inválida" });
        return;
      }
      
      const { target, payload } = sanitizedData;
      const targets = Array.isArray(target) ? target : [target];
      let entregues = 0;
      
      // Limitar tamanho da mensagem para evitar problemas de memória
      const payloadSize = JSON.stringify(payload).length;
      if (payloadSize > 100000) { // 100 KB 
        log("aviso", `Mensagem muito grande (${payloadSize} bytes) do socket ${socket.id}`);
        socket.emit("message_sent", { success: false, error: "Mensagem muito grande" });
        return;
      }
      
      log("info", `Mensagem recebida do socket ${socket.id}. Tipo: ${payload.type}, Destinos: ${targets.join(', ')}`);
      
      // Flag para verificar se algum destino existe
      let targetFound = false;
      
      targets.forEach(t => {
        if (clients.has(t)) {
          targetFound = true;
          const targetSockets = clients.get(t);
          targetSockets.forEach(s => {
            try {
              if (s.connected) {
                s.emit("message", payload);
                entregues++;
                log("debug", `Mensagem enviada para cliente ${t} (socket: ${s.id})`);
              }
            } catch (error) {
              logError(`Erro ao enviar mensagem para ${t}/${s.id}`, error);
            }
          });
        } else {
          log("aviso", `Destino não encontrado: ${t}`);
        }
      });
      
      // Adicionar um atraso aleatório para evitar 
      // ataques de temporização (enumeração de clientes por timing)
      addRandomDelay().then(() => {
        socket.emit("message_sent", { 
          success: entregues > 0,
          targets: targets, 
          delivered: entregues,
          timestamp: new Date().toISOString()
        });
        
        log("info", `Entrega concluída: ${entregues} cliente(s) receberam a mensagem`);
      });
    } catch (error) {
      logError(`Erro ao processar mensagem`, error);
      // Mesmo com erro, aplicar delay para não vazar informação
      addRandomDelay().then(() => {
        socket.emit("message_sent", { success: false, error: "Erro interno ao processar mensagem" });
      });
    }
  });

  // Desconexão
  socket.on("disconnect", () => {
    try {
      totalConnections--;
      
      if (clientId && clients.has(clientId)) {
        const clientSockets = clients.get(clientId);
        const index = clientSockets.findIndex(s => s.id === socket.id);
        
        if (index !== -1) {
          clientSockets.splice(index, 1);
          if (clientSockets.length === 0) {
            clients.delete(clientId);
          }
        }
      }
      
      log("socket", `Cliente desconectado: ${socket.id}${clientId ? ` (ID: ${clientId})` : ''} (${totalConnections} conexões ativas)`);
    } catch (error) {
      logError(`Erro ao desconectar cliente ${socket.id}`, error);
    }
  });
  
  // Tratamento de erros
  socket.on("error", (error) => {
    logError(`Erro no socket ${socket.id}`, error);
  });
  
  // Timeout para inatividade (desconecta após 4 horas)
  setTimeout(() => {
    if (socket.connected) {
      log("aviso", `Desconectando socket ${socket.id} por inatividade (4h)`);
      socket.disconnect(true);
    }
  }, 4 * 60 * 60 * 1000);
});

// Monitoramento periódico de memória e limpeza de recursos
const monitorInterval = setInterval(() => {
  verificarMemoria();
  
  // Limpar sockets desconectados
  for (const [id, sockets] of clients.entries()) {
    const socketsFiltrados = sockets.filter(s => s.connected);
    if (socketsFiltrados.length === 0) {
      clients.delete(id);
      log("info", `Removido cliente ${id} sem sockets ativos`);
    } else if (socketsFiltrados.length !== sockets.length) {
      clients.set(id, socketsFiltrados);
      log("info", `Limpeza: ${sockets.length - socketsFiltrados.length} socket(s) desconectado(s) do cliente ${id}`);
    }
  }
}, 30 * 60 * 1000); // A cada 30 minutos

// Tratamento de erros do servidor
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logError(`A porta ${PORT} já está em uso. Tente encerrar o outro processo ou use uma porta diferente.`, error);
    process.exit(1);
  } else {
    logError('Erro no servidor HTTP', error);
  }
});

// Desligar graciosamente
process.on('SIGINT', () => {
  log("info", "Recebido sinal SIGINT. Desligando servidor...");
  clearInterval(monitorInterval);
  io.close();
  server.close(() => {
    log("info", "Servidor HTTP encerrado.");
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  log("info", "Recebido sinal SIGTERM. Desligando servidor...");
  clearInterval(monitorInterval);
  io.close();
  server.close(() => {
    log("info", "Servidor HTTP encerrado.");
    process.exit(0);
  });
});

// Capturar exceções não tratadas
process.on('uncaughtException', (error) => {
  logError('Exceção não tratada', error);
  // Em produção, registrar o erro mas manter o servidor rodando
});

// Verificar arquivos antes de iniciar
verificarArquivos();

// Verificar memória inicial
verificarMemoria();

// Iniciar servidor
server.listen(PORT, () => {
  log("info", `Servidor RIRA 21 v1.1.0 iniciado na porta ${PORT}`);
  log("info", `Interface da TV: http://localhost:${PORT}/tv`);
  log("info", `Painel de Controle: http://localhost:${PORT}/painel`);
  log("info", `Status do Sistema: http://localhost:${PORT}/status`);
}); 