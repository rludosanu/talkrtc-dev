const joi = require('joi');
const { Op } = require('sequelize');

module.exports = class Controller {
  constructor(app) {
		this._app = app;
	}

  create(req, res) {
    var datas = req.body;
    var self = this;
    var generateAccessCode = function() {
      return Math.floor(Math.random() * (999999 - 100000) + 100000);
    };

    joi.validate(datas, joi.object().keys({
      hostEmail: joi.string().email().required(),
      hostFirstName: joi.string().regex(/[a-zA-Z-]+/).allow(''),
      hostLastName: joi.string().regex(/[a-zA-Z-]+/).allow(''),
      hostCompanyName: joi.string().regex(/[a-zA-Z0-9- ]+/).allow(''),
      guestEmail: joi.string().email().disallow(joi.ref('hostEmail')).required(),
      guestFirstName: joi.string().regex(/[a-zA-Z-]+/).allow(''),
      guestLastName: joi.string().regex(/[a-zA-Z-]+/).allow(''),
      conferenceType: joi.string().valid(['webchat', 'webcall']).required(),
      conferenceDate: joi.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).required(),
      conferenceMessage: joi.string().allow('')
    }), (error, result) => {
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      datas.hostAccessCode = generateAccessCode();
      datas.guestAccessCode = generateAccessCode();

      self._app.models.conference.model.build({
        hostEmail: datas.hostEmail,
        hostFirstName: datas.hostFirstName,
        hostLastName: datas.hostLastName,
        hostCompanyName: datas.hostCompanyName,
        hostAccessCode: datas.hostAccessCode,
        guestEmail: datas.guestEmail,
        guestFirstName: datas.guestFirstName,
        guestLastName: datas.guestLastName,
        guestAccessCode: datas.guestAccessCode,
        conferenceType: datas.conferenceType,
        conferenceDate: datas.conferenceDate,
        conferenceMessage: datas.conferenceMessage
      })
      .save()
      .then(conference => res.status(200).json({ conference }))
      .catch(error => res.status(500).json({ error: error.parent }));
    });
  }
};
