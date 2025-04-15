const { io } = require("socket.io-client");
const fs = require('fs');

// Arquivo de log
const logFile = 'tv-messages.log';

// Limpar arquivo de log anterior
fs.writeFileSync(logFile, '=== LOG DE MENSAGENS RECEBIDAS NA TV ===\n\n', 'utf8');

// Função para registrar no log
function logMessage(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  fs.appendFileSync(logFile, logEntry, 'utf8');
}

// Conecta ao servidor WebSocket
const socket = io("http://localhost:3001");

// Evento de conexão
socket.on("connect", () => {
  logMessage(`TV conectada ao servidor WebSocket com ID: ${socket.id}`);
  
  // Registrar como TV com ID admin
  socket.emit("register", { type: "tv", id: "admin" });
  
  // Evento para confirmar o registro
  socket.on("registered", (data) => {
    logMessage(`TV registrada com sucesso: ${JSON.stringify(data)}`);
  });
  
  // Evento para receber mensagens
  socket.on("message", (data) => {
    logMessage(`\n=== MENSAGEM RECEBIDA NA TV ===`);
    logMessage(`Tipo: ${data.type}`);
    logMessage(`Conteúdo: ${JSON.stringify(data, null, 2)}`);
    logMessage(`==============================\n`);
    
    // Se for um alerta, simular o comportamento da TV
    if (data.type === "alert") {
      logMessage(`Exibindo alerta: "${data.message}"`);
      logMessage(`Som: ${data.soundType || "default"}`);
      logMessage(`Duração: ${data.duration || 10000}ms`);
      
      // Simular o fim do alerta após a duração
      setTimeout(() => {
        logMessage(`Alerta "${data.message}" finalizado.`);
      }, data.duration || 10000);
    }
  });
});

// Manter conexão aberta
logMessage("TV simulada iniciada. Pressione Ctrl+C para encerrar.");

// Evento de erro
socket.on("error", (error) => {
  logMessage(`Erro na conexão da TV: ${error}`);
});

// Evento de desconexão
socket.on("disconnect", (reason) => {
  logMessage(`TV desconectada: ${reason}`);
}); 