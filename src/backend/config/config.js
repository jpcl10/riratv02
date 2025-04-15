/**
 * Arquivo de configuração do sistema RIRA 21
 * Contém todas as configurações centralizadas
 */

const config = {
  // Configurações do servidor
  server: {
    port: process.env.PORT || 3001,
    isReplit: Boolean(process.env.REPL_ID || process.env.REPL_SLUG),
  },
  
  // Configurações de segurança
  security: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
      'Feature-Policy': "camera 'none'; microphone 'none'; geolocation 'none'",
      'Permissions-Policy': "camera=(), microphone=(), geolocation=()"
    },
    cors: {
      // Permitir acesso de qualquer origem
      origin: '*',
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400 // 24 horas
    },
    // Configurações de limitação de conexões e rate limit
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      maxRequestsPerIp: 100,
      socketMaxConnectionsPerIp: 5,
      socketMaxConnectionsTotal: 50
    },
    // Lista de IPs/redes banidos (opcional)
    blacklist: [
      // '192.168.0.1',
      // '10.0.0.0/24'
    ],
    // Configurações de cookies
    cookies: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    }
  },
  
  // Configurações de caminho
  paths: {
    frontend: '../frontend',
    index: '../../index.html'
  },
  
  // Configurações do sistema
  system: {
    name: 'RIRA 21',
    version: '1.0.0',
    description: 'Sistema de Comunicação Interna para Consultórios e Clínicas'
  }
};

module.exports = config; 