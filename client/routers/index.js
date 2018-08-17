const express = require('express');
const path = require('path');

class ClientRouter {
  constructor(app) {
    this._app = app;

    // Create new router
    this.router = express.Router();

    // Setup public directory path
    this.router.use('/public', express.static(path.join(__dirname, '../public')));

    // Index page
    this.router.get('/', (req, res) => res.sendFile(this.resolveViewPath('index')));

    // Call conference
    this.router.get('/webcall/:token', (req, res) => res.sendFile(this.resolveViewPath('webcall')));

    // Page not found
    this.router.get('/404', (req, res) => res.sendFile(this.resolveViewPath('404')));

    // Redirect any other request to /404
    this.router.get('/*', (req, res) => res.redirect('/404'));
  }

  resolveViewPath(filename) {
    return path.resolve(path.join(__dirname, '../public/views', filename + '.html'));
  }
}

class ConferenceRouter {
  constructor(app) {
    this._app = app;
    this.router = express.Router();

    // Create a new conference
    this.router.post('/', this._app.controllers.conference.create.bind(this));

    // Join a conference
    this.router.post('/login', this._app.controllers.conference.login.bind(this));
  }
}

class Router {
  constructor(app) {
    this._app = app;

    this.client = new ClientRouter(app);
    this.conference = new ConferenceRouter(app);
  }
}

module.exports = Router;
