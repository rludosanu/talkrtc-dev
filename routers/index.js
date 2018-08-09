const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

class ClientRouter {
  constructor(app) {
    this._app = app;

    // Check token validity
    this.checkToken = function(req, res, next) {
      var self = this;

      console.log('[ INFO ] Checking token validity');
      if (!req.cookies || !req.cookies.token) {
        console.log('[ ERROR ] Token not found. Redirecting to /404.');
        res.redirect('/404');
      } else {
        jwt.verify(req.cookies.token, self._app.configs.jsonwebtoken.secret, (error, decoded) => {
          if (error) {
            console.log('[ ERROR ] Token not decoded. Redirecting to /404.');
            res.redirect('/404');
          } else {
            if (req.params.token == decoded.token) {
              console.log('[ SUCCESS ] Matching tokens.');
              next();
            } else {
              console.log('[ ERROR ] Unmatching tokens. Redirecting to /404.');
              res.redirect('/404');
            }
          }
        });
      }
    };

    // Create new router
    this.router = express.Router();

    // Setup cookie parser
    this.router.use(cookieParser());

    // Setup public directory path
    this.router.use('/public', express.static(path.join(__dirname, '../public')));

    // Index page
    this.router.get('/', (req, res) => res.sendFile(this.resolveViewPath('index')));

    // Create a conference
    this.router.get('/create', (req, res) => res.sendFile(this.resolveViewPath('create')));

    // Join a conference
    this.router.get('/join/:token', (req, res) => res.sendFile(this.resolveViewPath('join')));

    // Chat conference
    this.router.get('/webchat/:token', this.checkToken.bind(this), (req, res) => res.sendFile(this.resolveViewPath('webchat')));

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

    // Join a conference
    this.router.post('/join', this._app.controllers.conference.join.bind(this));
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
