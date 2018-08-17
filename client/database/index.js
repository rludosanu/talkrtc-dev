const Sequelize = require('sequelize');

class Database {
	constructor(app) {
		this.sequelize = new Sequelize(app.configs.database);
	}

	connect() {
		this.sequelize.authenticate()
		.then(() => console.log('[ DATABASE ] Connected to MySQL.'))
		.catch((error) => console.error(error));
	}
}

module.exports = Database;
