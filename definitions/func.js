FUNC.transationlog = function(query) {
	F.Fs.appendFile(PATH.databases(query.db + '.log'), JSON.stringify(query) + '\n', NOOP);
};

FUNC.checksum = function(id) {
	var sum = 0;
	for (var i = 0; i < id.length; i++)
		sum += id.charCodeAt(i);
	return sum.toString(36);
};

FUNC.preparetokens = function() {

	MAIN.tokens = {};

	if (PREF.tokens) {
		for (var token of PREF.tokens) {

			var obj = CLONE(token);
			if (obj.profiles && obj.profiles.length) {
				var tmp = {};
				for (var db of obj.profiles)
					tmp[db] = 1;
				obj.profiles = tmp;
			} else
				obj.profiles = null;

			MAIN.tokens[obj.token] = obj;
		}
	}

	if (MAIN.socket) {
		for (var key in MAIN.socket.connections) {
			var client = MAIN.socket.connections[key];
			if (client.user.token !== PREF.token) {
				var session = MAIN.tokens[client.user.token];
				if (session)
					client.user = session;
				else
					client.close(4001);
			}
		}
	}

};

FUNC.refresh = function() {
	MAIN.cache = {};
	for (var key in MAIN.db.profiles) {

		var profile = MAIN.db.profiles[key];
		var obj = {};

		try {
			obj.template = Tangular.compile(profile.html);
			obj.helpers = new Function('return ' + profile.helpers)();
		} catch (e) {}


		for (var key2 in profile.templates) {
			var template = profile.templates[key2];
			var id = key + '/' + key2 + (template.language ? ('/' + template.language) : '');
			MAIN.cache[id] = { profile: profile, template: template };
			id = (profile.reference || profile.id) + '/' + (template.reference || profile.id) + (template.language ? ('/' + template.language) : '');
			try {
				var subject = template.subject || template.name;
				if (subject && subject.indexOf('{{') !== -1)
					subject = Tangular.compile(subject);
				else
					subject = null;
				MAIN.cache[id] = { profile: profile, template: template, tlayout: obj.template, tsubject: subject, ttemplate: Tangular.compile(template.html), helpers: obj.helpers, smtp_options: profile.smtp_options ? profile.smtp_options.parseJSON(true) : {} };
			} catch (e) {}
		}
	}
};

FUNC.saveconfig = function() {
	var config = {};
	for (var item of F.extensions)
		config[item.id] = item.config;
	F.Fs.writeFile(PATH.databases('extensions.json'), JSON.stringify(config), NOOP);
};

function savemeta(db) {
	F.Fs.writeFile(PATH.databases('meta_' + db + '.json'), JSON.stringify(MAIN.meta[db] || EMPTYOBJECT), NOOP);
}

FUNC.savemeta = function(db) {
	setTimeout2(db, savemeta, 10000, 10, db);
};

FUNC.send = function(model, files, callback, user) {

	if (typeof(model.to) === 'string' && model.to.indexOf(',') !== -1)
		model.to = model.to.split(/,|;/).trim();

	if (model.to instanceof Array) {
		var arr = model.to;
		var error = null;
		arr.wait(function(item, next) {
			if (typeof(item) === 'string' && item.isEmail()) {
				model.to = item;
				FUNC.send(model, files, function(err) {
					if (err) {
						error = err;
						next('cancel');
					} else
						next();
				});
			} else
				next();
		}, function() {
			callback(error);
		});
		return;
	}

	var raw = model;
	model = CONVERT(model, 'id:String, to:String, subject:String, html:String, data:Object, attachments:[Object], language:String');

	if (!model.id) {
		callback && callback('Invalid template ID');
		return;
	}

	if (!model.to) {
		callback && callback('Invalid "to" address');
		return;
	}

	// model.id {String} a path to the template REF_PROFILE/REF_TEMPLATE or ID_PROFILE/ID_TEMPLATE
	// model.to {String} to email address
	// model.subject {String} optional, a subject
	// model.html {String} optional, a custom HTML body
	// model.data {Object} optional, additional data for the template

	var meta = MAIN.cache[model.id];
	if (meta) {

		if (user && !user.sa) {
			var access = MAIN.tokens[user.token];
			if (access) {
				if (access.profiles && !access.profiles[meta.profile.id]) {
					callback && callback('Invalid permissions');
					return;
				}
			}
		}

		NOW = new Date();

		if (meta.profile.sent)
			meta.profile.sent++;
		else
			meta.profile.sent = 1;

		if (meta.template.sent)
			meta.template.sent++;
		else
			meta.template.sent = 1;

		meta.profile.dtsent = NOW;
		meta.template.dtsent = NOW;

		var html = model.html || model.body;
		var data = model.data || {};

		if (typeof(data) !== 'object')
			data = {};

		if (html) {
			data.body = html;
			html = meta.tlayout(data, null, meta.helpers);
		} else {
			html = meta.ttemplate(data, null, meta.helpers);
			data.body = html;
			html = meta.tlayout(data, null, meta.helpers);
		}

		var arg = {};
		arg.meta = meta;
		arg.model = model;
		arg.attachments = null;

		var beg = NOW;
		var subject = model.subject || (model.subject ? meta.tsubject(data, null, meta.helpers) : (meta.template.subject || meta.template.name));
		var message = Mail.create(subject.indexOf('{{') === -1 ? subject : Tangular.render(subject, data, meta.helpers), html);

		message.from(meta.profile.from);
		meta.profile.reply && message.reply(meta.profile.reply);
		meta.profile.bcc && message.bcc(meta.profile.bcc);
		message.to(model.to);

		if (files && files.length) {
			for (var file of files)
				message.attachment(file.path, file.filename);
		}

		arg.mail = message;

		var send = function() {
			TRANSFORM('send', arg, function() {

				message.send(meta.profile.smtp, meta.smtp_options, function(err) {

					if (arg.attachments && arg.attachments.length)
						PATH.unlink(arg.attachments);

					callback && callback(err, err ? null : 1);
					NOSQL('logs').insert({ profileid: meta.profile.id, templateid: meta.template.id, profile: meta.profile.name, template: meta.template.name, subject: message.subject, to: model.to, error: err ? err.toString() : null, model: raw, duration: Date.now() - beg, dtcreated: NOW }).callback(() => MAIN.wapi && MAIN.wapi.send({ TYPE: 'logs', profileid: meta.profile.id }));

				}, true);
			});
		};

		if (model.attachments instanceof Array) {
			arg.attachments = [];
			var id = Date.now().toString(36) + GUID(2);
			model.attachments.wait(function(item, next, index) {

				if (!item.url || !item.name) {
					next();
					return;
				}

				item.filename = PATH.tmp('attachment_' + id + '_' + index + '.tmp');
				arg.attachments.push(item.filename);

				DOWNLOAD(item.url, item.filename, function(err, response) {
					response && message.attachment(item.filename, item.name);
					next();
				});

			}, send);
		} else
			send();

	} else
		callback('Template not found');
};

FUNC.audit = function(client, msg) {
	msg.token = client.user.token;
	msg.ua = client.ua;
	msg.ip = client.ip;
	msg.dtcreated = new Date();
	F.Fs.appendFile(PATH.databases('audit.log'), JSON.stringify(msg) + '\n', NOOP);
};