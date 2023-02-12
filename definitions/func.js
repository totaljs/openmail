FUNC.refresh = function() {
	MAIN.cache = {};
	for (var key in MAIN.db.profiles) {

		var profile = MAIN.db.profiles[key];
		var obj = {};

		obj.layout = FUNC.parsetemplate(profile.html || '{{ value | raw }}');

		for (var key2 in profile.templates) {

			var template = profile.templates[key2];
			var id = profile.reference + '/' + template.reference;

			try {

				obj.template = FUNC.parsetemplate(template.html || '');
				if (obj.layout && obj.layout.helpers) {
					for (var key in obj.layout.helpers)
						obj.template.helpers[key] = obj.layout.helpers[key];
				}

				obj.subject = template.subject.indexOf('{{') !== -1 ? Tangular.compile(template.subject) : null;
				MAIN.cache[id] = { profile: profile, template: template, tlayout: obj.layout, ttemplate: obj.template, tsubject: obj.subject, subject: template.subject, smtp: profile.mail_smtp, smtp_options: profile.mail_smtp_options ? JSON.parse(profile.mail_smtp_options) : null };

			} catch (e) {
				console.log(profile.name, e);
			}
		}
	}
};

var Sender = '*id:String, *to:String, reply:Email, cc:Email, bcc:Email, data:Object, attachments:[*name:String, *url:String]'.toJSONSchema();

function sendmail($, arg) {
	TRANSFORM('render', arg, function() {

		arg.model.profileid = arg.meta.profile.id;
		arg.model.templateid = arg.meta.template.id;
		arg.model.dtcreated = NOW = new Date();

		if (arg.attachments && arg.attachments.length)
			PATH.unlink(arg.attachments);

		arg.mail.send(arg.meta.smtp, arg.meta.smtp_options, function(err) {

			arg.model.profile = arg.meta.profile.name;
			arg.model.template = arg.meta.template.name;
			arg.model.from = arg.meta.profile.from;
			arg.model.subject = arg.mail.subject;
			arg.model.error = err;
			arg.model.duration = Date.now() - arg.model.dtcreated.getTime();

			DB().insert('nosql/logs', arg.model);
			if ($) {
				if (err)
					$.invalid(err);
				else
					$.success();
			}
		});
	});
}

FUNC.send = function(data, $) {

	var schema = Sender.transform(data);
	if (schema.error) {
		$ && $.invalid(schema.error);
		return;
	}

	var model = schema.response;
	var meta = MAIN.cache[model.id];
	if (meta) {

		NOW = new Date();

		if (meta.profile.count)
			meta.profile.count++;
		else
			meta.profile.count = 1;

		if (meta.template.count)
			meta.template.count++;
		else
			meta.template.count = 1;

		meta.profile.dtsent = NOW;
		meta.template.dtsent = NOW;

		var data = model.data || {};

		if (typeof(data) !== 'object')
			data = {};

		var html = meta.ttemplate.template({ value: data }, meta.tlayout.model, meta.ttemplate.helpers);
		html = meta.tlayout.template({ value: html }, meta.tlayout.model, meta.tlayout.helpers);

		var subject;

		if (meta.tsubject)
			subject = meta.tsubject({ value: data }, meta.tlayout.model, meta.ttemplate.helpers);
		else
			subject = meta.subject;

		var arg = {};

		arg.mail = Mail.create(subject, html);
		arg.meta = meta;
		arg.model = model;
		arg.html = html;
		arg.subject = subject;
		arg.mail.to(model.to);
		arg.mail.from(meta.profile.from || meta.profile.sender);

		var reply = data.reply || meta.profile.reply;
		reply && arg.mail.reply(reply);

		data.cc && arg.mail.cc(data.cc);

		var bcc = data.bcc || meta.profile.bcc;
		bcc && arg.mail.bcc(bcc);

		if ($ && $.files && $.files.length) {
			for (var file of $.files)
				arg.mail.attachment(file.path, file.filename);
		}

		if (model.attachments) {

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
					response && arg.mail.attachment(item.filename, item.name);
					next();
				});

			}, () => sendmail($, arg));

		} else
			sendmail($, arg);

	} else if($)
		$.invalid('Template not found');
};

FUNC.parsetemplate = function(body) {

	var helpers = {};
	var model = EMPTYOBJECT;
	var strhelpers = '';
	var beg = body.indexOf('<scr' + 'ipt>');
	var end;

	// helpers
	if (beg !== -1) {
		end = body.indexOf('</scr' + 'ipt>', beg + 8);
		strhelpers = body.substring(beg + 8, end).trim();
		body = body.substring(0, beg) + body.substring(end + 9);
	}

	// model
	beg = body.indexOf('<scr' + 'ipt type="text/json">');
	if (beg !== -1) {
		end = body.indexOf('</scr' + 'ipt>', beg + 8);
		model = (body.substring(beg + 25, end).trim()).parseJSON(true);
		body = body.substring(0, beg) + body.substring(end + 9);
	}

	if (strhelpers)
		new Function('Thelpers', strhelpers)(helpers);

	var output = {};
	output.helpers = helpers;
	output.template = Tangular.compile(body.trim());
	output.model = model;
	return output;
};