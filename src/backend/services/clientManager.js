/**
 * Serviço de gerenciamento de clientes WebSocket
 * Responsável por registrar, remover e gerenciar os clientes conectados
 */

const config = require('../config/config');

// Armazena os clientes conectados por ID
const clients = {};

// Armazena informações sobre conexões por IP para limitação
const ipConnections = {};

// Sistema de bloqueio para operações críticas
const locks = {
  clients: false,
  ips: false,
  operations: new Map(), // Bloqueios específicos por operação
  timeouts: new Map() // Timeouts para liberação automática
};

/**
 * Obtém um bloqueio para uma operação
 * @param {string} resource - Nome do recurso a bloquear (ex: 'clients' ou ID específico)
 * @param {number} timeout - Tempo máximo de bloqueio em ms (padrão: 1000ms)
 * @returns {boolean} Se conseguiu obter o bloqueio
 */
function acquireLock(resource, timeout = 1000) {
  // Caso especial para recursos globais
  if (resource === 'clients' && locks.clients) return false;
  if (resource === 'ips' && locks.ips) return false;
  
  // Para recursos específicos
  if (locks.operations.has(resource)) return false;
  
  // Obter bloqueio
  if (resource === 'clients') locks.clients = true;
  else if (resource === 'ips') locks.ips = true;
  else locks.operations.set(resource, true);
  
  // Configurar liberação automática após timeout
  const timeoutId = setTimeout(() => {
    releaseLock(resource);
    console.warn(`Bloqueio de ${resource} liberado automaticamente após timeout`);
  }, timeout);
  
  locks.timeouts.set(resource, timeoutId);
  
  return true;
}

/**
 * Libera um bloqueio para uma operação
 * @param {string} resource - Nome do recurso a liberar
 */
function releaseLock(resource) {
  // Caso especial para recursos globais
  if (resource === 'clients') locks.clients = false;
  else if (resource === 'ips') locks.ips = false;
  else locks.operations.delete(resource);
  
  // Cancelar timeout
  if (locks.timeouts.has(resource)) {
    clearTimeout(locks.timeouts.get(resource));
    locks.timeouts.delete(resource);
  }
}

/**
 * Registra um novo cliente
 * @param {string} id - ID do cliente
 * @param {object} socket - Socket do cliente
 * @param {string} type - Tipo do cliente (tv, painel, etc)
 * @param {string} ip - Endereço IP do cliente
 * @returns {boolean} Sucesso da operação
 */
function registerClient(id, socket, type, ip) {
  try {
    // Validar entradas
    if (!id || !socket || !type) {
      console.error(`[ERRO] Tentativa de registro com parâmetros inválidos: ID=${id}, Tipo=${type}`);
      return false;
    }
    
    // Obter bloqueio para operação de registro
    const lockResource = `client:${id}`;
    if (!acquireLock(lockResource)) {
      console.warn(`[CONCORRÊNCIA] Operação de registro para ${id} abortada: recurso bloqueado`);
      return false;
    }
    
    try {
      // Limitação por IP se fornecido
      if (ip) {
        trackIpConnection(ip, socket.id);
      }
      
      // Registrar cliente
      if (!clients[id]) clients[id] = [];
      clients[id].push({
        socket,
        type,
        connectedAt: new Date(),
        ip: ip || 'unknown'
      });
      
      console.log(`[REGISTER] ${type} registrado com ID: ${id}, IP: ${ip || 'unknown'}`);
      return true;
    } finally {
      // Sempre liberar o bloqueio, mesmo em caso de erro
      releaseLock(lockResource);
    }
  } catch (error) {
    console.error('[ERRO] Falha ao registrar cliente:', error);
    return false;
  }
}

/**
 * Rastreia conexões por IP para prevenir abusos
 * @param {string} ip - Endereço IP
 * @param {string} socketId - ID do socket
 */
function trackIpConnection(ip, socketId) {
  if (!ip) return;
  
  // Obter bloqueio para operação em IPs
  if (!acquireLock(`ip:${ip}`, 500)) {
    console.warn(`[CONCORRÊNCIA] Operação de rastreamento para IP ${ip} abortada: recurso bloqueado`);
    return;
  }
  
  try {
    if (!ipConnections[ip]) {
      ipConnections[ip] = {
        count: 0,
        sockets: [],
        firstConnection: new Date()
      };
    }
    
    // Adicionar o socketId à lista deste IP
    ipConnections[ip].count++;
    ipConnections[ip].sockets.push(socketId);
    ipConnections[ip].lastConnection = new Date();
    
    // Verificar se o IP está na lista negra
    if (config.security.blacklist && config.security.blacklist.includes(ip)) {
      console.warn(`[SEGURANÇA] Conexão detectada de IP na lista negra: ${ip}`);
    }
  } finally {
    // Sempre liberar o bloqueio
    releaseLock(`ip:${ip}`);
  }
  
  // Limpar sockets antigos que possam ter sido desconectados sem remoção adequada
  cleanupStaleIpConnections();
}

/**
 * Limpa conexões antigas por IP
 */
function cleanupStaleIpConnections() {
  // Executar a cada 100 novas conexões para não impactar performance
  const totalConnections = Object.values(ipConnections).reduce((sum, conn) => sum + conn.count, 0);
  if (totalConnections % 100 !== 0) return;
  
  console.log('[MANUTENÇÃO] Limpando conexões IP antigas');
  
  const now = new Date();
  for (const [ip, data] of Object.entries(ipConnections)) {
    const hoursSinceLastConnection = (now - data.lastConnection) / (1000 * 60 * 60);
    
    // Se última conexão foi há mais de 24h, remover da lista
    if (hoursSinceLastConnection > 24) {
      delete ipConnections[ip];
    }
  }
}

/**
 * Remove um cliente
 * @param {object} socket - Socket do cliente
 * @returns {string|null} ID do cliente removido ou null
 */
function removeClient(socket) {
  if (!socket) return null;
  
  let clientId = null;
  let clientIp = null;
  
  try {
    // Obter bloqueio global para operação de busca
    if (!acquireLock('clients', 2000)) {
      console.warn(`[CONCORRÊNCIA] Operação de remoção abortada: recurso global bloqueado`);
      return null;
    }
    
    try {
      // Encontrar o cliente a ser removido
      for (const [id, list] of Object.entries(clients)) {
        const index = list.findIndex(client => client.socket.id === socket.id);
        if (index !== -1) {
          clientId = id;
          clientIp = list[index].ip;
          break;
        }
      }
    } finally {
      // Sempre liberar o bloqueio global
      releaseLock('clients');
    }
    
    // Se encontrou o cliente, obter bloqueio específico e remover
    if (clientId) {
      const lockResource = `client:${clientId}`;
      if (!acquireLock(lockResource)) {
        console.warn(`[CONCORRÊNCIA] Remoção para cliente ${clientId} abortada: recurso bloqueado`);
        return null;
      }
      
      try {
        // Realizar a remoção
        const index = clients[clientId].findIndex(client => client.socket.id === socket.id);
        if (index !== -1) {
          clients[clientId].splice(index, 1);
          if (clients[clientId].length === 0) delete clients[clientId];
        }
      } finally {
        // Sempre liberar o bloqueio
        releaseLock(lockResource);
      }
    }
    
    // Atualizar contagem de IP se disponível
    if (clientIp) {
      const ipLockResource = `ip:${clientIp}`;
      if (acquireLock(ipLockResource, 500)) {
        try {
          if (ipConnections[clientIp]) {
            ipConnections[clientIp].count = Math.max(0, ipConnections[clientIp].count - 1);
            
            // Remover socketId da lista de sockets deste IP
            const socketIndex = ipConnections[clientIp].sockets.indexOf(socket.id);
            if (socketIndex !== -1) {
              ipConnections[clientIp].sockets.splice(socketIndex, 1);
            }
          }
        } finally {
          releaseLock(ipLockResource);
        }
      }
    }
    
    return clientId;
  } catch (error) {
    console.error('[ERRO] Falha ao remover cliente:', error);
    return null;
  }
}

/**
 * Envia uma mensagem para um ou mais destinos
 * @param {string|array} target - ID ou array de IDs dos destinos
 * @param {object} payload - Conteúdo da mensagem
 * @returns {number} Número de clientes que receberam a mensagem
 */
function sendMessage(target, payload) {
  if (!target || !payload) {
    console.error('[ERRO] Tentativa de envio de mensagem com parâmetros inválidos');
    return 0;
  }
  
  try {
    const targets = Array.isArray(target) ? target : [target];
    let entregues = 0;
    
    // Log da mensagem sendo enviada
    console.log(`[MENSAGEM] Tipo: ${payload.type}, Destino: ${targets.join(', ')}`);
    
    // Para cada destino, obter bloqueio antes de enviar
    targets.forEach(t => {
      // Verificar se o cliente existe
      if (!clients[t]) return;
      
      // Obter bloqueio para este cliente
      const lockResource = `client:${t}`;
      if (!acquireLock(lockResource, 300)) {
        console.warn(`[CONCORRÊNCIA] Envio para cliente ${t} abortado: recurso bloqueado`);
        return;
      }
      
      try {
        // Copiar lista de sockets para evitar problemas de concorrência
        // durante a iteração
        const clientSockets = [...clients[t]];
        
        clientSockets.forEach(client => {
          try {
            client.socket.emit("message", payload);
            entregues++;
          } catch (err) {
            console.error(`[ERRO] Falha ao enviar mensagem para cliente ${t} (socket ${client.socket.id}):`, err);
          }
        });
      } finally {
        // Sempre liberar o bloqueio
        releaseLock(lockResource);
      }
    });
    
    console.log(`[ENTREGA] Mensagem entregue para ${entregues} cliente(s)`);
    return entregues;
  } catch (error) {
    console.error('[ERRO] Falha ao processar envio de mensagem:', error);
    return 0;
  }
}

/**
 * Retorna o número de conexões de um determinado IP
 * @param {string} ip - Endereço IP
 * @returns {number} Número de conexões
 */
function getSocketCountByIp(ip) {
  if (!ip || !ipConnections[ip]) return 0;
  return ipConnections[ip].count;
}

/**
 * Retorna o número total de clientes conectados
 * @returns {number} Número de clientes
 */
function getClientCount() {
  return Object.keys(clients).length;
}

/**
 * Retorna o número total de conexões ativas
 * @returns {number} Número de conexões
 */
function getTotalConnections() {
  let count = 0;
  for (const list of Object.values(clients)) {
    count += list.length;
  }
  return count;
}

/**
 * Retorna as estatísticas de conexão por IP
 * @returns {object} Estatísticas de conexão
 */
function getConnectionStats() {
  return {
    clientCount: getClientCount(),
    totalConnections: getTotalConnections(),
    ipConnectionsCount: Object.keys(ipConnections).length,
    topIPs: Object.entries(ipConnections)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([ip, data]) => ({
        ip, 
        connections: data.count,
        firstSeen: data.firstConnection,
        lastSeen: data.lastConnection
      }))
  };
}

module.exports = {
  registerClient,
  removeClient,
  sendMessage,
  getClientCount,
  getSocketCountByIp,
  getTotalConnections,
  getConnectionStats
}; 