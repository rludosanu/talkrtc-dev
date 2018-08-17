const fs = require('fs');
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const https = require('https');
const mustacheExpress = require('mustache-express');
const path = require('path');

const Config = require('./config/index');
const Database = require('./database/index');
const Models = require('./models/index');
const Controllers = require('./controllers/index');
const Routers = require('./routers/index');

class Server {
	constructor(config) {
		// Store global configuration
		this.configs = config;

		// Build
		this.database = new Database(this);
		this.models = new Models(this);
		this.controllers = new Controllers(this);
		this.routers = new Routers(this);

		// Create app
		this.app = express();

		// Log every request to the console
		this.app.use(morgan('dev'));

		// Setup url parser
		this.app.use(bodyParser.json());
		this.app.use(bodyParser.urlencoded({ extended: true }));
		this.app.use(bodyParser.json({ type: 'application/json' }));

		// Setup mustache
		this.app.engine('html', mustacheExpress());
		this.app.set('view engine', 'html');
		this.app.set('view cache', false);
		this.app.set('views', path.join(__dirname, '/public/views'));

		// Setup routers
		this.app.use(this.routers.client.router);
		this.app.use('/api/conference', this.routers.conference.router);

		// Create https server
		this.server = https.createServer({
			key: fs.readFileSync('./ssl/key.pem'),
		  cert: fs.readFileSync('./ssl/cert.pem')
		}, this.app);
	}

	start() {
		// Connect to database
		this.database.connect();

		// Run server
		this.server.listen(this.configs.server.port, (error) => {
			if (error) {
				console.log(error);
				process.exit(1);
			}
			console.log('Express server is running on port ' + this.configs.server.port);
		});
	}
}

const server = new Server(Config);

server.start();
