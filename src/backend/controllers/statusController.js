/**
 * Controlador de status do sistema
 * Fornece informações sobre o estado atual do servidor
 */

const os = require('os');
const crypto = require('crypto');
const clientManager = require('../services/clientManager');
const config = require('../config/config');

// Chave de acesso para status detalhado (gerada no início da aplicação)
const ACCESS_TOKEN = crypto.randomBytes(16).toString('hex');
console.log(`Token de acesso para status detalhado: ${ACCESS_TOKEN}`);

/**
 * Verifica se uma requisição é de origem local
 * @param {string} ip - Endereço IP
 * @returns {boolean} Se o IP é local
 */
function isLocalRequest(ip) {
  if (!ip) return false;
  
  // Lista de padrões de IP locais
  const localPatterns = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    '192.168.0.',
    '192.168.1.',
    '10.0.0.',
    '10.0.1.',
    'localhost'
  ];
  
  return localPatterns.some(pattern => ip.startsWith(pattern));
}

/**
 * Retorna informações de status do sistema
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
function getStatus(req, res) {
  try {
    // Obter e normalizar o IP requisitante
    const requestIp = req.ip || 
                      req.connection.remoteAddress || 
                      req.socket.remoteAddress || 
                      req.headers['x-forwarded-for'];
    
    // Verificar se é uma requisição local
    const isLocal = isLocalRequest(requestIp);
    
    // Verificar token na query ou header para acesso administrativo
    const requestToken = req.query.token || req.headers['x-access-token'];
    const isAdminRequest = requestToken === ACCESS_TOKEN;
    
    // Informações básicas de sistema que são seguras para compartilhar
    const basicInfo = {
      system: {
        name: config.system.name,
        version: config.system.version,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      connections: {
        clientCount: clientManager.getClientCount(),
        totalConnections: clientManager.getTotalConnections()
      }
    };
    
    // Registrar tentativa de acesso detalhado
    if (req.query.detail || req.query.token || req.headers['x-access-token']) {
      const isAuthorized = isLocal || isAdminRequest;
      console.log(`Acesso detalhado de status: IP=${requestIp}, Autorizado=${isAuthorized}, Token presente=${!!requestToken}`);
    }
    
    // Informações mais detalhadas apenas para requisições locais ou com token válido
    if (isLocal || isAdminRequest) {
      return res.json({
        ...basicInfo,
        security: {
          corsEnabled: !!config.security.cors,
          rateLimitEnabled: !!config.security.rateLimit,
          securityHeadersCount: Object.keys(config.security.headers).length,
        },
        advancedConnections: clientManager.getConnectionStats(),
        environment: process.env.NODE_ENV || 'development',
        os: {
          type: os.type(),
          release: os.release(),
          hostname: os.hostname(),
          cpus: os.cpus().length,
          loadavg: os.loadavg(),
          uptime: Math.floor(os.uptime()),
        },
        memory: {
          serverTotalMem: Math.round(os.totalmem() / (1024 * 1024)),
          serverFreeMem: Math.round(os.freemem() / (1024 * 1024)),
          processMemory: Math.round(process.memoryUsage().rss / (1024 * 1024)),
          heapUsed: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
          heapTotal: Math.round(process.memoryUsage().heapTotal / (1024 * 1024)),
        },
        // Adicionar campo para informar como obter acesso ao status completo
        access: {
          type: isLocal ? 'local' : 'token',
          tokenHint: isAdminRequest ? 'valid' : 'Obtenha um token válido para acesso completo'
        }
      });
    }
    
    // Para requisições não-locais, retornar apenas informações básicas
    return res.json(basicInfo);
  } catch (error) {
    console.error('Erro ao obter status:', error);
    res.status(500).json({ 
      error: 'Erro interno ao obter status do sistema' 
    });
  }
}

module.exports = {
  getStatus
}; 