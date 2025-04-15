const { io } = require("socket.io-client");

// Conecta ao servidor WebSocket
const socket = io("http://localhost:3001");

// Evento de conexão
socket.on("connect", () => {
  console.log("TV conectada ao servidor WebSocket com ID:", socket.id);
  
  // Registrar como TV com ID admin
  socket.emit("register", { type: "tv", id: "admin" });
  
  // Evento para confirmar o registro
  socket.on("registered", (data) => {
    console.log("TV registrada com sucesso:", data);
  });
  
  // Evento para receber mensagens
  socket.on("message", (data) => {
    console.log("\n=== MENSAGEM RECEBIDA NA TV ===");
    console.log(JSON.stringify(data, null, 2));
    console.log("==============================\n");
    
    // Se for um alerta, simular o comportamento da TV
    if (data.type === "alert") {
      console.log(`Exibindo alerta: "${data.message}"`);
      console.log(`Som: ${data.soundType || "default"}`);
      console.log(`Duração: ${data.duration || 10000}ms`);
      
      // Simular o fim do alerta após a duração
      setTimeout(() => {
        console.log(`Alerta "${data.message}" finalizado.`);
      }, data.duration || 10000);
    }
  });
});

// Manter conexão aberta
console.log("TV simulada iniciada. Pressione Ctrl+C para encerrar.");

// Evento de erro
socket.on("error", (error) => {
  console.error("Erro na conexão da TV:", error);
});

// Evento de desconexão
socket.on("disconnect", (reason) => {
  console.log("TV desconectada:", reason);
}); 