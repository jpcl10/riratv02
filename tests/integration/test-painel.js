const { io } = require("socket.io-client");
const readline = require('readline');

// Criar interface de linha de comando
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Conecta ao servidor WebSocket
const socket = io("http://localhost:3001");

// Menu de opções
function showMenu() {
  console.log("\n=== PAINEL DE TESTE ===");
  console.log("1. Enviar alerta");
  console.log("2. Enviar tarefas");
  console.log("3. Enviar mídia");
  console.log("4. Enviar agenda");
  console.log("5. Enviar QR Code");
  console.log("6. Enviar enquete");
  console.log("0. Sair");
  console.log("=====================");
  
  rl.question("Escolha uma opção: ", (option) => {
    switch(option) {
      case "1":
        sendAlert();
        break;
      case "2":
        sendTasks();
        break;
      case "3":
        sendMedia();
        break;
      case "4":
        sendAgenda();
        break;
      case "5":
        sendQRCode();
        break;
      case "6":
        sendPoll();
        break;
      case "0":
        socket.disconnect();
        rl.close();
        console.log("Teste finalizado.");
        break;
      default:
        console.log("Opção inválida!");
        showMenu();
        break;
    }
  });
}

// Enviar alerta
function sendAlert() {
  rl.question("Mensagem do alerta: ", (message) => {
    rl.question("Tipo de som (default, emergency, notification, reminder): ", (soundType) => {
      rl.question("Duração (ms): ", (duration) => {
        const payload = {
          type: "alert",
          message: message,
          soundType: soundType || "default",
          duration: parseInt(duration) || 10000
        };
        
        socket.emit("send_message", { target: "admin", payload });
        console.log("Alerta enviado!");
        
        setTimeout(showMenu, 1000);
      });
    });
  });
}

// Enviar tarefas
function sendTasks() {
  const tasks = [];
  
  function addTask() {
    rl.question("Digite uma tarefa (ou vazio para finalizar): ", (task) => {
      if (task.trim()) {
        tasks.push(task);
        addTask();
      } else {
        const payload = {
          type: "tasks",
          tasks: tasks
        };
        
        socket.emit("send_message", { target: "admin", payload });
        console.log("Tarefas enviadas!");
        
        setTimeout(showMenu, 1000);
      }
    });
  }
  
  addTask();
}

// Enviar mídia
function sendMedia() {
  rl.question("Tipo de mídia (image, video): ", (mediaType) => {
    rl.question("URL da mídia: ", (mediaUrl) => {
      rl.question("Legenda: ", (mediaCaption) => {
        const payload = {
          type: "media",
          mediaType: mediaType,
          mediaUrl: mediaUrl,
          mediaCaption: mediaCaption
        };
        
        socket.emit("send_message", { target: "admin", payload });
        console.log("Mídia enviada!");
        
        setTimeout(showMenu, 1000);
      });
    });
  });
}

// Enviar agenda
function sendAgenda() {
  const events = [];
  
  function addEvent() {
    rl.question("Horário (formato HH:MM, ou vazio para finalizar): ", (time) => {
      if (time.trim()) {
        rl.question("Título: ", (title) => {
          rl.question("Descrição: ", (description) => {
            events.push({ time, title, description });
            addEvent();
          });
        });
      } else {
        const payload = {
          type: "agenda",
          events: events
        };
        
        socket.emit("send_message", { target: "admin", payload });
        console.log("Agenda enviada!");
        
        setTimeout(showMenu, 1000);
      }
    });
  }
  
  addEvent();
}

// Enviar QR Code
function sendQRCode() {
  rl.question("URL para o QR Code: ", (url) => {
    rl.question("Texto: ", (text) => {
      const payload = {
        type: "qrcode",
        url: url,
        text: text
      };
      
      socket.emit("send_message", { target: "admin", payload });
      console.log("QR Code enviado!");
      
      setTimeout(showMenu, 1000);
    });
  });
}

// Enviar enquete
function sendPoll() {
  rl.question("Pergunta da enquete: ", (question) => {
    const options = [];
    
    function addOption() {
      rl.question("Opção (ou vazio para finalizar): ", (text) => {
        if (text.trim()) {
          rl.question("Votos: ", (votes) => {
            options.push({ text, votes: parseInt(votes) || 0 });
            addOption();
          });
        } else {
          if (options.length < 2) {
            console.log("Adicione pelo menos duas opções!");
            addOption();
          } else {
            const payload = {
              type: "poll",
              question: question,
              options: options
            };
            
            socket.emit("send_message", { target: "admin", payload });
            console.log("Enquete enviada!");
            
            setTimeout(showMenu, 1000);
          }
        }
      });
    }
    
    addOption();
  });
}

// Evento de conexão
socket.on("connect", () => {
  console.log("Painel conectado ao servidor WebSocket com ID:", socket.id);
  
  // Registrar como painel
  socket.emit("register", { type: "panel", id: "test-panel" });
  
  // Evento para confirmar o registro
  socket.on("registered", (data) => {
    console.log("Painel registrado com sucesso:", data);
    showMenu();
  });
  
  // Evento para confirmar o envio da mensagem
  socket.on("message_sent", (data) => {
    console.log("Status de envio da mensagem:", data);
  });
});

// Evento de erro
socket.on("error", (error) => {
  console.error("Erro na conexão do painel:", error);
});

// Evento de desconexão
socket.on("disconnect", (reason) => {
  console.log("Painel desconectado:", reason);
}); 