/**
 * Controlador para eventos do Socket.io
 */

const clientManager = require('../services/clientManager');
const { sanitizeInput } = require('../utils/security');
const config = require('../config/config');

// Estrutura para controle de rate limit de eventos de socket
const socketRateLimits = {
  // Exemplo: { 'socket-id': { lastMessage: timestamp, count: 0, blocked: false } }
};

// Limites de eventos por tipo
const EVENT_LIMITS = {
  'register': { maxPerMinute: 5, blockDuration: 1 * 60 * 1000 }, // 1 minuto
  'send_message': { maxPerMinute: 30, blockDuration: 2 * 60 * 1000 }, // 2 minutos
  'default': { maxPerMinute: 60, blockDuration: 30 * 1000 } // 30 segundos
};

/**
 * Verifica se um evento específico excedeu o limite de rate
 * @param {string} socketId - ID do socket
 * @param {string} eventType - Tipo de evento
 * @returns {boolean} Se o limite foi excedido
 */
function isRateLimited(socketId, eventType) {
  if (!socketId) return false;
  
  // Inicializar dados para este socket se não existirem
  if (!socketRateLimits[socketId]) {
    socketRateLimits[socketId] = {
      events: {},
      lastCleanup: Date.now()
    };
  }
  
  const socketData = socketRateLimits[socketId];
  
  // Inicializar dados para este tipo de evento
  if (!socketData.events[eventType]) {
    socketData.events[eventType] = {
      count: 0,
      firstEvent: Date.now(),
      blocked: false,
      blockedUntil: 0
    };
  }
  
  const eventData = socketData.events[eventType];
  const now = Date.now();
  const limits = EVENT_LIMITS[eventType] || EVENT_LIMITS.default;
  
  // Verificar se está bloqueado
  if (eventData.blocked) {
    if (now < eventData.blockedUntil) {
      return true; // Ainda bloqueado
    } else {
      // Desbloquear
      eventData.blocked = false;
      eventData.count = 0;
      eventData.firstEvent = now;
    }
  }
  
  // Reiniciar contador a cada minuto
  if (now - eventData.firstEvent > 60000) {
    eventData.count = 0;
    eventData.firstEvent = now;
  }
  
  // Incrementar contador e verificar limite
  eventData.count++;
  
  if (eventData.count > limits.maxPerMinute) {
    eventData.blocked = true;
    eventData.blockedUntil = now + limits.blockDuration;
    console.log(`Rate limit excedido para socket ${socketId} no evento ${eventType}. Bloqueado por ${limits.blockDuration/1000}s`);
    return true;
  }
  
  return false;
}

/**
 * Limpa dados de rate limit de sockets desconectados
 * @param {string} socketId - ID do socket a remover (opcional)
 */
function cleanupRateLimits(socketId = null) {
  const now = Date.now();
  
  if (socketId) {
    // Limpar dados de um socket específico
    delete socketRateLimits[socketId];
  } else {
    // Limpar dados antigos (mais de 1 hora)
    Object.keys(socketRateLimits).forEach(id => {
      if (now - socketRateLimits[id].lastCleanup > 60 * 60 * 1000) {
        delete socketRateLimits[id];
      }
    });
  }
}

/**
 * Valida os dados de registro
 * @param {object} data - Dados de registro
 * @returns {boolean} Se os dados são válidos
 */
function validateRegistrationData(data) {
  if (!data || typeof data !== 'object') return false;
  if (!data.type || !data.id) return false;
  if (typeof data.type !== 'string' || typeof data.id !== 'string') return false;
  
  // Verificar tipos válidos de cliente
  const validTypes = ['tv', 'painel', 'admin'];
  if (!validTypes.includes(data.type)) return false;
  
  // Verificar tamanho dos campos
  if (data.type.length > 20 || data.id.length > 50) return false;
  
  return true;
}

/**
 * Valida os dados de mensagem
 * @param {object} data - Dados da mensagem
 * @returns {boolean} Se os dados são válidos
 */
function validateMessageData(data) {
  if (!data || typeof data !== 'object') return false;
  if (!data.target || !data.payload) return false;
  
  // Validar destino
  if (Array.isArray(data.target)) {
    if (data.target.length === 0 || data.target.length > 20) return false;
    for (const target of data.target) {
      if (typeof target !== 'string' || target.length > 50) return false;
    }
  } else if (typeof data.target !== 'string' || data.target.length > 50) {
    return false;
  }
  
  // Validar payload
  if (typeof data.payload !== 'object') return false;
  
  // Verificar tipos de payload válidos
  if (!data.payload.type) return false;
  
  // Validações específicas por tipo de mensagem
  const validTypes = ['notification', 'alert', 'update', 'call', 'command', 'config'];
  if (!validTypes.includes(data.payload.type)) {
    return false;
  }
  
  // Validações específicas por tipo
  switch (data.payload.type) {
    case 'notification':
      if (!data.payload.title || typeof data.payload.title !== 'string' || 
          data.payload.title.length > 100) return false;
      if (data.payload.body && (typeof data.payload.body !== 'string' || 
          data.payload.body.length > 500)) return false;
      break;
      
    case 'alert':
      if (!data.payload.level || !['info', 'warning', 'error', 'critical'].includes(data.payload.level)) 
        return false;
      if (!data.payload.message || typeof data.payload.message !== 'string' || 
          data.payload.message.length > 200) return false;
      break;
      
    case 'call':
      if (!data.payload.room || typeof data.payload.room !== 'string' || 
          data.payload.room.length > 50) return false;
      if (!data.payload.name || typeof data.payload.name !== 'string' || 
          data.payload.name.length > 100) return false;
      break;
      
    case 'command':
      if (!data.payload.action || typeof data.payload.action !== 'string') return false;
      // Apenas ações específicas são permitidas
      if (!['refresh', 'restart', 'update', 'clear'].includes(data.payload.action)) 
        return false;
      break;
      
    case 'config':
      if (!data.payload.settings || typeof data.payload.settings !== 'object') 
        return false;
      // Validar campos de configuração
      for (const [key, value] of Object.entries(data.payload.settings)) {
        if (!['theme', 'volume', 'timeout', 'display'].includes(key)) return false;
        switch (key) {
          case 'volume':
            if (typeof value !== 'number' || value < 0 || value > 100) return false;
            break;
          case 'timeout':
            if (typeof value !== 'number' || value < 0 || value > 3600) return false;
            break;
          case 'theme':
            if (typeof value !== 'string' || !['light', 'dark', 'auto'].includes(value)) 
              return false;
            break;
          case 'display':
            if (typeof value !== 'object') return false;
            break;
        }
      }
      break;
  }
  
  // Validar tamanho dos dados
  if (JSON.stringify(data.payload).length > 1024 * 1024) return false; // Max 1MB
  
  return true;
}

/**
 * Valida a integridade dos dados de uma mensagem complexa
 * @param {object} payload - Payload da mensagem
 * @returns {boolean} Se o payload é válido
 */
function validatePayloadIntegrity(payload) {
  if (!payload || typeof payload !== 'object') return false;
  
  // Verificar tipo
  if (!payload.type || typeof payload.type !== 'string') return false;
  
  // Validar estrutura conforme o tipo
  switch(payload.type) {
    case 'notification':
      // Verificar campos obrigatórios
      if (!payload.title || typeof payload.title !== 'string') return false;
      
      // Verificar campos opcionais
      if (payload.timestamp && (typeof payload.timestamp !== 'string' || 
          !payload.timestamp.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z$/))) {
        return false;
      }
      
      // Verificar consistência de dados (exemplo: se há data de expiração, deve ser futura)
      if (payload.expiresAt) {
        const expires = new Date(payload.expiresAt).getTime();
        const now = new Date().getTime();
        if (isNaN(expires) || expires <= now) return false;
      }
      break;
    
    case 'alert':
      // Verificar campos obrigatórios para alertas
      if (!payload.level || !payload.message) return false;
      if (!['info', 'warning', 'error', 'critical'].includes(payload.level)) return false;
      
      // Se for crítico, verificar dados adicionais
      if (payload.level === 'critical' && !payload.action) return false;
      break;
      
    case 'call':
      // Validar nome e sala
      if (!payload.room || !payload.name) return false;
      
      // Números de sala devem ser numéricos
      if (payload.roomNumber && isNaN(Number(payload.roomNumber))) return false;
      
      // Prioridade deve ser válida
      if (payload.priority && 
          !['low', 'normal', 'high', 'emergency'].includes(payload.priority)) {
        return false;
      }
      break;
      
    case 'config':
      // Configurações devem ter objeto settings
      if (!payload.settings || typeof payload.settings !== 'object') return false;
      
      // Validar cada configuração
      for (const [key, value] of Object.entries(payload.settings)) {
        // Verificar valores numéricos
        if (['volume', 'brightness', 'timeout'].includes(key) && 
            (typeof value !== 'number' || value < 0 || value > 100)) {
          return false;
        }
        
        // Verificar temas
        if (key === 'theme' && !['light', 'dark', 'auto', 'custom'].includes(value)) {
          return false;
        }
      }
      break;
  }
  
  return true;
}

/**
 * Configura os eventos de socket para um cliente
 * @param {object} socket - Socket do cliente
 */
function setupSocketEvents(socket) {
  console.log(`Cliente conectado: ${socket.id}`);
  
  // Limitar número de listeners por socket para evitar memory leaks
  socket.setMaxListeners(15);
  
  // Aplicar limites de conexão por IP
  const clientIp = socket.handshake.address;
  const socketCount = clientManager.getSocketCountByIp(clientIp);
  
  if (socketCount >= config.security.rateLimit.socketMaxConnectionsPerIp) {
    console.log(`Conexão rejeitada do IP ${clientIp}: limite excedido`);
    socket.disconnect(true);
    return;
  }
  
  // Limitar tempo de conexão (4 horas máximo)
  const connectionTimeout = setTimeout(() => {
    if (socket.connected) {
      console.log(`Desconectando socket ${socket.id} por timeout (4h)`);
      socket.disconnect(true);
    }
  }, 4 * 60 * 60 * 1000);

  // Evento de registro
  socket.on("register", (data) => {
    try {
      // Verificar rate limit
      if (isRateLimited(socket.id, 'register')) {
        socket.emit("registered", { 
          success: false, 
          message: "Muitas tentativas. Tente novamente mais tarde." 
        });
        return;
      }
    
      // Sanitizar e validar dados
      const sanitizedData = sanitizeInput(data);
      
      if (!validateRegistrationData(sanitizedData)) {
        console.log(`Tentativa de registro com dados inválidos: ${JSON.stringify(data)}`);
        socket.emit("registered", { 
          success: false, 
          message: "Dados de registro inválidos" 
        });
        return;
      }
      
      const { type, id } = sanitizedData;
      clientManager.registerClient(id, socket, type, clientIp);
      
      // Enviar confirmação para o cliente
      socket.emit("registered", { 
        success: true, 
        message: `Registrado como ${type}` 
      });
    } catch (error) {
      console.error(`Erro ao registrar cliente:`, error);
      socket.emit("registered", { 
        success: false, 
        message: "Erro interno ao registrar" 
      });
    }
  });

  // Evento de envio de mensagem
  socket.on("send_message", (data) => {
    try {
      // Verificar rate limit
      if (isRateLimited(socket.id, 'send_message')) {
        socket.emit("message_sent", { 
          success: false, 
          error: "Limite de mensagens excedido. Aguarde um momento." 
        });
        return;
      }
    
      // Sanitizar e validar dados
      const sanitizedData = sanitizeInput(data);
      
      if (!validateMessageData(sanitizedData)) {
        console.log(`Tentativa de envio de mensagem com dados inválidos: ${JSON.stringify(data)}`);
        socket.emit("message_sent", { 
          success: false, 
          error: "Dados da mensagem inválidos" 
        });
        return;
      }
      
      const { target, payload } = sanitizedData;
      
      // Validar integridade do payload para mensagens complexas
      if (!validatePayloadIntegrity(payload)) {
        console.log(`Mensagem com payload inconsistente: ${JSON.stringify(payload)}`);
        socket.emit("message_sent", { 
          success: false, 
          error: "Estrutura de dados inconsistente" 
        });
        return;
      }
      
      // Feedback para o remetente
      socket.emit("message_sent", { 
        success: entregues > 0,
        targets: Array.isArray(target) ? target : [target], 
        delivered: entregues,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Erro ao enviar mensagem:`, error);
      socket.emit("message_sent", { 
        success: false, 
        error: "Erro interno ao enviar mensagem" 
      });
    }
  });

  // Evento de desconexão
  socket.on("disconnect", () => {
    try {
      clearTimeout(connectionTimeout);
      const clientId = clientManager.removeClient(socket);
      console.log(`Cliente desconectado: ${socket.id}${clientId ? ` (ID: ${clientId})` : ''}`);
      
      // Limpar dados de rate limit para este socket
      cleanupRateLimits(socket.id);
    } catch (error) {
      console.error(`Erro ao desconectar cliente:`, error);
    }
  });
  
  // Tratamento de erros
  socket.on("error", (error) => {
    console.error(`Erro no socket ${socket.id}:`, error);
  });
  
  // Limpeza periódica de dados de rate limit (a cada hora)
  setInterval(() => {
    cleanupRateLimits();
  }, 60 * 60 * 1000);
}

module.exports = {
  setupSocketEvents
}; 