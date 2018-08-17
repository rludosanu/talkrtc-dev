const express = require('express');
const path = require('path');

class ClientRouter {
  constructor(app) {
    this._app = app;

    // Create new router
    this.router = express.Router();

    // Setup public directory
    this.router.use('/public', express.static(path.join(__dirname, '../public')));

    // Render index page
    this.router.get('/', (req, res) => res.render('index', {
      clientServer: this._app.configs.server.host + ':' + this._app.configs.server.port
    }));

    // Render webcall page
    this.router.get('/webcall/:token', (req, res) => res.render('webcall', {
      clientServer: this._app.configs.server.host + ':' + this._app.configs.server.port,
      signalingServer: this._app.configs.signaling.host + ':' + this._app.configs.signaling.port
    }));

    // Render 404 page
    this.router.get('/404', (req, res) => res.render('404'));

    // Redirect any other request to /404
    this.router.get('/*', (req, res) => res.redirect('/404'));
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
