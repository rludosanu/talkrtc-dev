const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');

const Database = require('./database/index');
const Models = require('./models/index');
const Controllers = require('./controllers/index');
const Routers = require('./routers/index');

class App {
	constructor(configs) {
		this.configs = configs;
		this.server = express();
		this.database = new Database(this);
		this.models = new Models(this);
		this.controllers = new Controllers(this);
		this.routers = new Routers(this);
	}

	start() {
		// Connect to database
		this.database.connect();

		// Log every request to the console
		this.server.use(morgan('dev'));

		// Setup url parser
		this.server.use(bodyParser.json());
		this.server.use(bodyParser.urlencoded({ extended: true }));
		this.server.use(bodyParser.json({ type: 'application/json' }));

		// Setup routers
		this.server.use(this.routers.client.router);
		this.server.use('/api/conference', this.routers.conference.router);

		// Run app
		this.server.listen(this.configs.server.port, (error) => {
			if (error) {
				console.log(error);
				process.exit(1);
			}
			console.log('[ SERVER ] Server is running on port ' + this.configs.server.port);
		});
	}
}

module.exports = function(configs) {
	return new App(configs);
};
