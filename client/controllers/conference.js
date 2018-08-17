const joi = require('joi');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');

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
      date: joi.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).required(),
      hostEmail: joi.string().email().required(),
      hostName: joi.string().regex(/[a-zA-Z-]+/).allow(''),
      guestEmail: joi.string().email().disallow(joi.ref('hostEmail')).required(),
      guestName: joi.string().regex(/[a-zA-Z-]+/).allow(''),
    }), (error, result) => {
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      datas.hostAccessCode = generateAccessCode();
      datas.guestAccessCode = generateAccessCode();

      self._app.models.conference.model.build({
        date: datas.date,
        hostEmail: datas.hostEmail,
        hostName: datas.hostName,
        hostAccessCode: datas.hostAccessCode,
        guestEmail: datas.guestEmail,
        guestName: datas.guestName,
        guestAccessCode: datas.guestAccessCode
      })
      .save()
      .then(conference => {
        var mailTransporter = nodemailer.createTransport(self._app.configs.mail);
        var datetime = datas.date.split(' ');
        var date = datetime[0].split('-');
        var time = datetime[1].split(':');
        var url = self._app.configs.server.host + ':' + this._app.configs.server.port;

        date = `${date[2]}/${date[1]}/${date[0]}`;
        time = `${time[0]}:${time[1]}`;

        // Send invitation email to guest
        mailTransporter.sendMail({
          from: 'TalkRTC Team<talkrtc@gmail.com>',
          to: datas.guestEmail,
          subject: 'Conference invitation on TalkRTC',
          html: `
          <div style="color: #444444; font-size: 15px; margin: 45px 0px;">
            <div style="font-size: 22px; margin-bottom: 25px;">Hi ${datas.guestName} !</div>
            <div style="margin-bottom: 20px;">You have been invited by <strong>${datas.hostName}</strong> to join a TalkRTC conference on <strong>${date}</strong> at <strong>${time}</strong></div>
            <div style="margin-bottom: 20px;">Your personnal access code is <strong>${datas.guestAccessCode}</strong></div>
            <div style="margin-bottom: 20px;">Join your conference at <a href="https://${url}/webcall/${conference.dataValues.token}">https://${url}/webcall/${conference.dataValues.token}</a></div>
            <div>Enjoy,<br /><strong>TalkRTC Team</strong></div>
          </div>
          `
        });

        // Send confirmation email to host
        mailTransporter.sendMail({
          from: 'TalkRTC Team<talkrtc@gmail.com>',
          to: datas.hostEmail,
          subject: 'Conference confirmation on TalkRTC',
          html: `
          <div style="color: #444444; font-size: 15px; margin: 45px 0px;">
            <div style="font-size: 22px; margin-bottom: 25px;">Hi ${datas.hostName} !</div>
            <div style="margin-bottom: 20px;">You have invited <strong>${datas.guestName}</strong> to join a TalkRTC conference on <strong>${date}</strong> at <strong>${time}</strong></div>
            <div style="margin-bottom: 20px;">Your access code is <strong>${datas.hostAccessCode}</strong></div>
            <div style="margin-bottom: 20px;">Join your conference at <a href="https://${url}/webcall/${conference.dataValues.token}">https://${url}/webcall/${conference.dataValues.token}</a></div>
            <div>Enjoy,<br /><strong>TalkRTC Team</strong></div>
          </div>
          `
        });

        res.status(200).json({ conference });
      })
      .catch(error => res.status(500).json({ error: error.parent }));
    });
  }

  login(req, res) {
    var datas = req.body;
    var self = this;

    joi.validate(datas, joi.object().keys({
      token: joi.string().regex(/^[a-zA-Z0-9-]+$/).required(),
      accessCode: joi.number().integer().min(100000).max(999999).required()
    }), (error, result) => {
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      self._app.models.conference.model.findOne({
        where: {
          token: datas.token,
          [Op.or]: [{
            hostAccessCode: datas.accessCode
          }, {
            guestAccessCode: datas.accessCode
          }]
        }
      })
      .then(conference => {
        if (!conference) {
          res.status(401).json({ error: 'Unauthorized access' });
        } else {
          var role = (conference.dataValues.hostAccessCode == datas.accessCode) ? 'host' : 'guest';

          res.status(200).json({
            token: conference.dataValues.token,
            hostName: conference.dataValues.hostName,
            guestName: conference.dataValues.guestName,
            role: role
          });
        }
      })
      .catch(error => res.status(500).json({ error: error.parent }));
    });
  }
};
