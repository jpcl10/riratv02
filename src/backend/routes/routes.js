/**
 * Configuração das rotas da aplicação
 */

const express = require('express');
const path = require('path');
const statusController = require('../controllers/statusController');

/**
 * Configura as rotas da aplicação
 * @param {object} app - Aplicação Express
 */
function setupRoutes(app) {
  // Servir arquivos estáticos da pasta frontend
  app.use(express.static(path.join(__dirname, '../../frontend')));

  // Redirecionar a raiz para a página inicial
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../../index.html'));
  });

  // Rotas específicas para as interfaces
  app.get('/tv', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/tv/index.html'));
  });

  app.get('/painel', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/painel/index.html'));
  });

  // Rota para verificar status do sistema
  app.get('/status', statusController.getStatus);
}

module.exports = setupRoutes; 