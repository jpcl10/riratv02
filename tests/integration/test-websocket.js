const { io } = require("socket.io-client");

// Conecta ao servidor WebSocket
const socket = io("http://localhost:3001");

// Evento de conexão
socket.on("connect", () => {
  console.log("Conectado ao servidor WebSocket com ID:", socket.id);
  
  // Registrar como painel
  socket.emit("register", { type: "panel", id: "test-client" });
  
  // Enviar alerta após 2 segundos
  setTimeout(() => {
    console.log("Enviando alerta para TV");
    
    const payload = {
      type: "alert",
      message: "Teste de alerta via WebSocket",
      soundType: "notification",
      duration: 5000
    };
    
    socket.emit("send_message", { target: "admin", payload });
  }, 2000);
  
  // Evento para confirmar o registro
  socket.on("registered", (data) => {
    console.log("Registrado com sucesso:", data);
  });
  
  // Evento para confirmar o envio da mensagem
  socket.on("message_sent", (data) => {
    console.log("Status de envio da mensagem:", data);
    
    // Desconectar após 1 segundo
    setTimeout(() => {
      socket.disconnect();
      console.log("Desconectado");
    }, 1000);
  });
});

// Evento de erro
socket.on("error", (error) => {
  console.error("Erro na conexão:", error);
});

// Evento de desconexão
socket.on("disconnect", (reason) => {
  console.log("Desconectado:", reason);
}); 