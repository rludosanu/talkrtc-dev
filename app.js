const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');

const Database = require('./database/index');
const Models = require('./models/index');
const Controllers = require('./controllers/index');
const Routers = require('./routers/index');
const SocketServer = require('./rtc/index');

class App {
	constructor(configs) {
		this.configs = configs;
		this.expressServer = express();
		this.socketServer = new SocketServer(this);
		this.database = new Database(this);
		this.models = new Models(this);
		this.controllers = new Controllers(this);
		this.routers = new Routers(this);
	}

	start() {
		// Connect to database
		this.database.connect();

		// Log every request to the console
		this.expressServer.use(morgan('dev'));

		// Setup url parser
		this.expressServer.use(bodyParser.json());
		this.expressServer.use(bodyParser.urlencoded({ extended: true }));
		this.expressServer.use(bodyParser.json({ type: 'application/json' }));

		// Setup routers
		this.expressServer.use(this.routers.client.router);
		this.expressServer.use('/api/conference', this.routers.conference.router);

		// Run app
		this.expressServer.listen(this.configs.expressServer.port, (error) => {
			if (error) {
				console.log(error);
				process.exit(1);
			}
			console.log('Client server is running on port ' + this.configs.expressServer.port);
		});

		// Run RTC
		this.socketServer.start();
	}
}

module.exports = function(configs) {
	return new App(configs);
};
