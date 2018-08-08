const express = require('express');
const path = require('path');

class ClientRouter {
  constructor(app) {
    // Create new router
    this.router = express.Router();

    // Setup public directory path
    this.router.use('/public', express.static(path.join(__dirname, '../public')));

    // Index page
    this.router.get('/', (req, res) => res.sendFile(this.resolveViewPath('index')));

    // Create a conference
    this.router.get('/create/:type', (req, res) => {
      let type = req.params.type;

      if (['webchat', 'webcall'].indexOf(type) != -1) {
        res.sendFile(this.resolveViewPath('create-' + type));
      } else {
        res.redirect('/404');
      }
    });

    // Join a conference
    // this.router.get('/join/:token', (req, res) => res.sendFile(this.resolveViewPath('join')));

    // Chat conference
    // this.router.get('/webchat/:token', (req, res) => res.sendFile(this.resolveViewPath('webchat')));

    // Call conference
    // this.router.get('/webcall/:token', (req, res) => res.sendFile(this.resolveViewPath('webcall')));

    this.router.get('/404', (req, res) => res.sendFile(this.resolveViewPath('404')));

    // Page not found
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
