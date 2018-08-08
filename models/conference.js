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
			hostEmail: {
				type: Sequelize.STRING,
				allowNull: false,
				required: true
			},
			hostFirstName: {
				type: Sequelize.STRING,
				allowNull: true,
				defaultValue: null
			},
			hostLastName: {
				type: Sequelize.STRING,
				allowNull: true,
				defaultValue: null
			},
			hostCompanyName: {
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
			guestFirstName: {
				type: Sequelize.STRING,
				allowNull: true,
				defaultValue: null
			},
			guestLastName: {
				type: Sequelize.STRING,
				allowNull: true,
				defaultValue: null
			},
			guestAccessCode: {
				type: Sequelize.INTEGER,
				allowNull: false,
				required: true
			},
			conferenceType: {
				type: Sequelize.ENUM('webchat', 'webcall'),
				allowNull: false,
				required: true
			},
			conferenceDate: {
				type: Sequelize.DATE,
				allowNull: false,
				required: true
			},
			conferenceMessage: {
				type: Sequelize.TEXT,
				allowNull: true,
				defaultValue: null
			}
		});

		this.model.sync({
			force: this.reset
		});
	}
}
