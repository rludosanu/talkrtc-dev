const Sequelize = require('sequelize');

class Database {
	constructor(app) {
		this.sequelize = new Sequelize(app.configs.database);
	}

	connect() {
		this.sequelize.authenticate()
		.then(() => console.log('[ DATABASE ] Connected to MySQL.'))
		.catch((error) => console.error('[ DATABASE ] Unable to connect to MySQL. Check logs for details.'));
	}
}

module.exports = Database;
