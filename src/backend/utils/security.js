/**
 * Utilitários de segurança para a aplicação
 */

const config = require('../config/config');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

/**
 * Configura os middlewares de segurança
 * @param {object} app - Aplicação Express
 */
function setupSecurityMiddleware(app) {
  // Usar Helmet para configurar vários headers HTTP de segurança
  app.use(helmet());
  
  // Configurar rate limit para prevenir ataques de força bruta
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // limitar cada IP a 100 requisições por janela
    standardHeaders: true, // retornar info de rate limit nos headers `RateLimit-*`
    legacyHeaders: false, // desabilitar headers `X-RateLimit-*`
    message: 'Muitas requisições deste IP, por favor tente novamente após 15 minutos'
  });
  
  // Aplicar rate limiting a todas as requisições
  app.use(limiter);
  
  // Prevenir ataques XSS e sanitizar entradas
  app.use(xss());
  
  // Prevenir HTTP Parameter Pollution
  app.use(hpp());
  
  // Parsear cookies
  app.use(cookieParser());
  
  // Configurações de segurança básicas
  app.use((req, res, next) => {
    const headers = config.security.headers;
    
    // Aplicar headers de segurança
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
    
    // Headers adicionais de segurança com CSP mais permissivo
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://cdn.socket.io https://cdn.tailwindcss.com https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
      "connect-src 'self' wss: ws:; " +
      "font-src 'self' data:; " +
      "img-src 'self' data:;"
    );
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Referrer-Policy', 'same-origin');
    
    next();
  });
}

/**
 * Valida e sanitiza os dados de entrada
 * @param {object} data - Dados a serem sanitizados
 * @returns {object} Dados sanitizados
 */
function sanitizeInput(data) {
  if (!data) return {};
  const sanitized = {};
  
  // Função simples de sanitização para substituir o pacote sanitize
  const simpleSanitize = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  };
  
  if (typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Limitar tamanho e sanitizar strings
        sanitized[key] = simpleSanitize(value.trim().substring(0, 1000));
      } else if (typeof value === 'number') {
        // Validar números
        sanitized[key] = Number.isFinite(value) ? value : 0;
      } else if (Array.isArray(value)) {
        // Sanitizar arrays limitando tamanho
        sanitized[key] = value.slice(0, 100).map(item => 
          typeof item === 'string' ? simpleSanitize(item.trim().substring(0, 1000)) : item
        );
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
      } else if (typeof item === 'string') {
        return simpleSanitize(item.trim().substring(0, 1000));
      }
      return item;
    });
  } else if (typeof data === 'string') {
    return simpleSanitize(data.trim().substring(0, 1000));
  }
  
  return data;
}

/**
 * Valida uma origem para requisições CORS
 * @param {string} origin - Origem da requisição
 * @param {array} allowedOrigins - Origens permitidas
 * @returns {boolean} Se a origem é válida
 */
function validateOrigin(origin, allowedOrigins) {
  if (!origin || !allowedOrigins) return false;
  
  // Verificar se a origem está na lista de origens permitidas
  return allowedOrigins.some(allowed => {
    if (allowed === '*') return true;
    if (allowed === origin) return true;
    
    // Verificar wildcards simples (exemplo: *.dominio.com)
    if (allowed.startsWith('*.')) {
      const domain = allowed.substring(2);
      return origin.endsWith(domain) && origin.lastIndexOf('.') > origin.indexOf(domain) - 2;
    }
    
    return false;
  });
}

/**
 * Configura proteções de segurança para Socket.io
 * @param {object} io - Instância do Socket.io
 * @param {object} corsOptions - Opções de CORS
 */
function setupSocketSecurity(io, corsOptions) {
  // Adicionar middleware para autenticação de sockets
  io.use((socket, next) => {
    const handshakeData = socket.handshake;
    
    // Validar origem - desabilitado para permitir todas as origens
    // Mantido apenas validação contra lista negra para segurança básica
    
    // Validar IP do cliente contra lista negra (se existir)
    const clientIp = socket.handshake.address;
    if (config.security.blacklist && 
        config.security.blacklist.length > 0 && 
        config.security.blacklist.includes(clientIp)) {
      console.log(`Conexão WebSocket rejeitada: IP na lista negra ${clientIp}`);
      return next(new Error('Acesso bloqueado para este IP'));
    }
    
    // Verificações de segurança básicas são mantidas mas com critérios mais relaxados
    
    // Verificar User-Agent - apenas casos extremamente suspeitos são bloqueados
    const userAgent = handshakeData.headers['user-agent'] || '';
    if (userAgent && /malware|exploit|attack/i.test(userAgent)) {
      console.log(`Conexão WebSocket suspeita: User-Agent suspeito ${userAgent}`);
      return next(new Error('User-Agent não autorizado'));
    }
    
    // Limitação de nova conexão baseada no tempo - aumentado o limite
    const connectionKey = `${clientIp}:${userAgent.substring(0, 20)}`;
    const now = Date.now();
    
    if (!global.socketConnections) {
      global.socketConnections = {};
    }
    
    if (global.socketConnections[connectionKey]) {
      const lastConn = global.socketConnections[connectionKey];
      if (now - lastConn < 100) { // Reduzido para 100ms entre conexões
        console.log(`Conexão WebSocket rejeitada: muitas conexões rápidas de ${clientIp}`);
        return next(new Error('Muitas solicitações em sequência'));
      }
    }
    
    global.socketConnections[connectionKey] = now;
    
    // Limpar dados antigos periodicamente
    if (now % 100 === 0) { // A cada ~100 conexões
      for (const key in global.socketConnections) {
        if (now - global.socketConnections[key] > 3600000) { // 1 hora
          delete global.socketConnections[key];
        }
      }
    }
    
    next();
  });
  
  // Configurar eventos globais de segurança
  io.engine.on("connection_error", (err) => {
    console.error(`Erro de conexão Socket.io: ${err.code} - ${err.message}`);
  });
}

module.exports = {
  setupSecurityMiddleware,
  sanitizeInput,
  validateOrigin,
  setupSocketSecurity
}; 