const Sequelize = require('sequelize');

module.exports = class Conference {
	constructor(app) {
		this._app = app;
		this.reset = this._app.configs.models.sync;

		this.model = this._app.database.sequelize.define('conference', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				allowNull: false,
				autoIncrement: true
			},
			token: {
				type: Sequelize.UUID,
				allowNull: false,
				required: true,
				defaultValue: Sequelize.UUIDV4
			},
			date: {
				type: Sequelize.DATE,
				allowNull: false,
				required: true
			},
			hostEmail: {
				type: Sequelize.STRING,
				allowNull: false,
				required: true
			},
			hostName: {
				type: Sequelize.STRING,
				allowNull: true,
				defaultValue: null
			},
			hostAccessCode: {
				type: Sequelize.INTEGER,
				allowNull: false,
				required: true
			},
			guestEmail: {
				type: Sequelize.STRING,
				allowNull: false,
				required: true
			},
			guestName: {
				type: Sequelize.STRING,
				allowNull: true,
				defaultValue: null
			},
			guestAccessCode: {
				type: Sequelize.INTEGER,
				allowNull: false,
				required: true
			}
		});

		this.model.sync({
			force: this.reset
		});
	}
}
