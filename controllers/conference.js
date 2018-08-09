const joi = require('joi');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
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
      type: joi.string().valid(['webchat', 'webcall']).required(),
      date: joi.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).required(),
      hostEmail: joi.string().email().required(),
      hostFirstName: joi.string().regex(/[a-zA-Z-]+/).allow(''),
      hostLastName: joi.string().regex(/[a-zA-Z-]+/).allow(''),
      hostCompanyName: joi.string().regex(/[a-zA-Z0-9- ]+/).allow(''),
      guestEmail: joi.string().email().disallow(joi.ref('hostEmail')).required(),
      guestFirstName: joi.string().regex(/[a-zA-Z-]+/).allow(''),
      guestLastName: joi.string().regex(/[a-zA-Z-]+/).allow('')
    }), (error, result) => {
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      datas.hostAccessCode = generateAccessCode();
      datas.guestAccessCode = generateAccessCode();

      self._app.models.conference.model.build({
        type: datas.type,
        date: datas.date,
        hostEmail: datas.hostEmail,
        hostFirstName: datas.hostFirstName,
        hostLastName: datas.hostLastName,
        hostCompanyName: datas.hostCompanyName,
        hostAccessCode: datas.hostAccessCode,
        guestEmail: datas.guestEmail,
        guestFirstName: datas.guestFirstName,
        guestLastName: datas.guestLastName,
        guestAccessCode: datas.guestAccessCode
      })
      .save()
      .then(conference => {
        var mailTransporter = nodemailer.createTransport(self._app.configs.mail);
        var datetime = datas.date.split(' ');
        var date = datetime[0].split('-');
        var time = datetime[1].split(':');
        var host = '';
        var guest = '';

        date = `${date[2]}/${date[1]}/${date[0]}`;
        time = `${time[0]}:${time[1]}`;

        if (datas.hostFirstName) {
          host = datas.hostFirstName;
          if (datas.hostLastName) {
            host += ' ' + datas.hostLastName;
          }
        } else {
          host = datas.hostEmail;
        }

        if (datas.guestFirstName) {
          guest = datas.guestFirstName;
          if (datas.guestLastName) {
            guest += ' ' + datas.guestLastName;
          }
        } else {
          guest = datas.guestEmail;
        }

        // Send invitation email to guest
        mailTransporter.sendMail({
          from: 'TalkRTC <talkrtc@gmail.com>',
          to: datas.guestEmail,
          subject: 'Conference invitation on TalkRTC',
          html: `
          <div style="color: #444444; font-size: 15px; width: 550px; margin: 45px 0px;">
            <div style="font-size: 34px; margin-bottom: 25px;">
              Hi ${guest} !
            </div>
            <div style="margin-bottom: 20px;">
              You have been invited by <strong>${host}</strong> to join a TalkRTC conference on <strong>${date}</strong> at <strong>${time}</strong>.
            </div>
            <div style="margin-bottom: 20px;">
              Your personnal access code is <strong>${datas.guestAccessCode}</strong>.
            </div>
            <div style="margin-bottom: 20px;">
              Join your conference at <a href="http://127.0.0.1:3000/join/${conference.dataValues.token}">www.talkrtc.io/join/${conference.dataValues.token}</a>.
            </div>
            <div>
              Enjoy your conference,<br /><strong>TalkRTC Team</strong>
            </div>
          </div>
          `
        });

        // Send confirmation email to host
        mailTransporter.sendMail({
          from: 'TalkRTC <talkrtc@gmail.com>',
          to: datas.hostEmail,
          subject: 'Conference confirmation on TalkRTC',
          html: `
          <div style="color: #444444; font-size: 15px; width: 550px; margin: 45px 0px;">
            <div style="font-size: 34px; margin-bottom: 25px;">
              Hi ${host} !
            </div>
            <div style="margin-bottom: 20px;">
              You have invited <strong>${guest}</strong> to join a TalkRTC conference on <strong>${date}</strong> at <strong>${time}</strong>.
            </div>
            <div style="margin-bottom: 20px;">
              Your access code is <strong>${datas.hostAccessCode}</strong>.
            </div>
            <div style="margin-bottom: 20px;">
              Join your conference at <a href="http://127.0.0.1:3000/join/${conference.dataValues.token}">www.talkrtc.io/join/${conference.dataValues.token}</a>.
            </div>
            <div>
              Enjoy your conference,<br /><strong>TalkRTC Team</strong>
            </div>
          </div>
          `
        });

        res.status(200).json({ conference });
      })
      .catch(error => res.status(500).json({ error: error.parent }));
    });
  }

  join(req, res) {
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
          var jwtDatas = {
            token: conference.dataValues.token,
            type: conference.dataValues.type,
            role: (conference.dataValues.hostAccessCode == datas.accessCode) ? 'host' : 'guest'
          };
          var jwtSecret = self._app.configs.jsonwebtoken.secret;
          var token = jwt.sign(jwtDatas, jwtSecret);

          res.status(200).json({ token: token });
        }
      })
      .catch(error => res.status(500).json({ error: error.parent }));
    });
  }
};
