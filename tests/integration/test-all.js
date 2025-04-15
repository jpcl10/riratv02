const { io } = require("socket.io-client");

// Conecta ao servidor WebSocket
const socket = io("http://localhost:3001");
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Evento de conexão
socket.on("connect", async () => {
  console.log("Script de teste conectado ao servidor WebSocket com ID:", socket.id);
  
  // Registrar como painel
  socket.emit("register", { type: "panel", id: "test-all" });
  
  socket.on("registered", async (data) => {
    console.log("Registrado com sucesso:", data);
    
    // Executar todos os testes em sequência
    try {
      console.log("\n===== INICIANDO TESTES AUTOMATIZADOS =====\n");
      
      // Teste 1: Alerta
      await testAlert();
      
      // Teste 2: Tarefas
      await testTasks();
      
      // Teste 3: Mídia
      await testMedia();
      
      // Teste 4: Agenda
      await testAgenda();
      
      // Teste 5: QR Code
      await testQRCode();
      
      // Teste 6: Enquete
      await testPoll();
      
      console.log("\n===== TODOS OS TESTES CONCLUÍDOS =====\n");
      
      // Encerrar após todos os testes
      socket.disconnect();
      console.log("Teste finalizado.");
      process.exit(0);
    } catch (error) {
      console.error("Erro durante os testes:", error);
      socket.disconnect();
      process.exit(1);
    }
  });
  
  // Evento para confirmar o envio da mensagem
  socket.on("message_sent", (data) => {
    console.log("Status de envio da mensagem:", data);
  });
});

// Teste de Alerta
async function testAlert() {
  console.log("\n----- TESTE 1: ALERTA -----");
  
  const payload = {
    type: "alert",
    message: "Teste de alerta automatizado",
    soundType: "notification",
    duration: 3000
  };
  
  console.log("Enviando alerta:", payload);
  socket.emit("send_message", { target: "admin", payload });
  
  // Aguardar resposta
  await delay(2000);
  console.log("Teste de alerta concluído.");
}

// Teste de Tarefas
async function testTasks() {
  console.log("\n----- TESTE 2: TAREFAS -----");
  
  const payload = {
    type: "tasks",
    tasks: [
      "Verificar estoque",
      "Ligar para fornecedor",
      "Atualizar sistema"
    ]
  };
  
  console.log("Enviando tarefas:", payload);
  socket.emit("send_message", { target: "admin", payload });
  
  // Aguardar resposta
  await delay(2000);
  console.log("Teste de tarefas concluído.");
}

// Teste de Mídia
async function testMedia() {
  console.log("\n----- TESTE 3: MÍDIA -----");
  
  const payload = {
    type: "media",
    mediaType: "image",
    mediaUrl: "https://picsum.photos/800/600",
    mediaCaption: "Imagem de teste"
  };
  
  console.log("Enviando mídia:", payload);
  socket.emit("send_message", { target: "admin", payload });
  
  // Aguardar resposta
  await delay(2000);
  console.log("Teste de mídia concluído.");
}

// Teste de Agenda
async function testAgenda() {
  console.log("\n----- TESTE 4: AGENDA -----");
  
  const payload = {
    type: "agenda",
    events: [
      { time: "09:00", title: "Reunião Diária", description: "Sala de conferências" },
      { time: "12:00", title: "Almoço", description: "Restaurante" },
      { time: "15:30", title: "Apresentação", description: "Auditório principal" }
    ]
  };
  
  console.log("Enviando agenda:", payload);
  socket.emit("send_message", { target: "admin", payload });
  
  // Aguardar resposta
  await delay(2000);
  console.log("Teste de agenda concluído.");
}

// Teste de QR Code
async function testQRCode() {
  console.log("\n----- TESTE 5: QR CODE -----");
  
  const payload = {
    type: "qrcode",
    url: "https://exemplo.com.br",
    text: "Escaneie para mais informações"
  };
  
  console.log("Enviando QR Code:", payload);
  socket.emit("send_message", { target: "admin", payload });
  
  // Aguardar resposta
  await delay(2000);
  console.log("Teste de QR Code concluído.");
}

// Teste de Enquete
async function testPoll() {
  console.log("\n----- TESTE 6: ENQUETE -----");
  
  const payload = {
    type: "poll",
    question: "Qual recurso você mais gosta?",
    options: [
      { text: "Alertas", votes: 5 },
      { text: "Agenda", votes: 8 },
      { text: "Mídia", votes: 3 }
    ]
  };
  
  console.log("Enviando enquete:", payload);
  socket.emit("send_message", { target: "admin", payload });
  
  // Aguardar resposta
  await delay(2000);
  console.log("Teste de enquete concluído.");
}

// Evento de erro
socket.on("error", (error) => {
  console.error("Erro na conexão:", error);
});

// Evento de desconexão
socket.on("disconnect", (reason) => {
  console.log("Desconectado:", reason);
}); 