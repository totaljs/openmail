NEWSCHEMA('Templates', function(schema) {

	schema.define('id', UID);
	schema.define('profileid', UID, true);
	schema.define('icon', 'Icon');
	schema.define('name', String, true);
	schema.define('language', String);
	schema.define('subject', String);
	schema.define('reference', String);
	schema.define('html', String);
	schema.define('model', String);

	schema.setQuery(function($) {

		var profile = MAIN.db.profiles[$.id];

		if (!profile) {
			$.invalid(404);
			return;
		}

		var arr = [];

		if (profile.templates) {
			for (var key in profile.templates) {
				var item = profile.templates[key];
				var obj = {};
				obj.id = item.id;
				obj.profileid = item.profileid;
				obj.icon = item.icon;
				obj.name = item.name;
				obj.language = item.language;
				obj.subject = item.subject;
				obj.color = profile.color;
				obj.reference = (profile.reference || profile.id) + '/' + (item.reference || item.id) + (item.language ? ('/' + item.language) : '');
				obj.dtcreated = item.dtcreated;
				obj.dtupdated = item.dtupdated;
				obj.sent = item.sent;
				arr.push(obj);
			}
			arr.quicksort('name');
		}

		var data = {};
		data.items = arr;
		data.layout = profile.html;
		$.callback(data);
	});

	schema.setRead(function($) {
		var item = MAIN.db.profiles[$.params.profileid];
		if (item) {
			var template = item.templates[$.params.id];
			if (template)
				$.callback(template);
			else
				$.invalid(404);
		} else
			$.invalid(404);
	});

	schema.setSave(function($, model) {

		var profile = MAIN.db.profiles[model.profileid];
		if (!profile) {
			$.invalid(404);
			return;
		}

		if (model.id) {
			var template = profile.templates[model.id];
			if (template) {
				template.icon = model.icon;
				template.name = model.name;
				template.language = model.language;
				template.subject = model.subject;
				template.reference = model.reference;
				template.html = model.html;
				template.model = model.model;
				template.dtupdated = NOW;
				delete MAIN.cache[model.id];
			} else {
				$.invalid(404);
				return;
			}
		} else {
			model.id = UID();
			model.dtcreated = NOW;
			model.sent = 0;
			profile.templates[model.id] = model;
		}

		FUNC.refresh();
		MAIN.db.save();
		$.success(model.id);
	});

	schema.addWorkflow('clone', function($) {

		var profile = MAIN.db.profiles[$.params.profileid];
		if (!profile) {
			$.invalid(404);
			return;
		}

		var template = profile.templates[$.params.id];
		if (template) {
			template = CLONE(template);
			template.id = UID();
			template.name += ' (CLONED)';
			template.reference += '_cloned';
			template.dtcreated = NOW;
			template.dtupdated = NOW;
			profile.templates[template.id] = template;
			FUNC.refresh();
			MAIN.db.save();
			$.success();
		} else
			$.invalid(404);

	});

	schema.setRemove(function($) {
		var item = MAIN.db.profiles[$.params.profileid];
		if (item) {
			delete item.templates[$.params.id];
			MAIN.db.save();
			FUNC.refresh();
			$.success();
		} else
			$.invalid(404);
	});

});

NEWSCHEMA('Templates/Test', function(schema) {

	schema.define('profileid', UID, true);
	schema.define('templateid', UID, true);
	schema.define('email', 'String', true);

	schema.addWorkflow('test', function($, model) {

		var addresses = model.email.split(/\,|\n/g).trim();

		if (addresses.length) {

			var profile = MAIN.db.profiles[model.profileid];
			if (profile) {
				var template = profile.templates[model.templateid];
				if (template) {

					try {

						var tlayout = Tangular.compile(profile.html);
						var ttemplate = Tangular.compile(template.html);

						var obj = {};
						var helpers = {};
						var model2 = {};

						if (profile.helpers) {
							try {
								helpers = new Function('return ' + profile.helpers)();
							} catch (e) {
								$.invalid('Invalid helpers: ' + e.message);
								return;
							}
						}

						if (profile.model) {
							try {
								model2 = new Function('return ' + profile.model)();
							} catch (e) {
								$.invalid('Invalid secondary model: ' + e.message);
								return;
							}
						}

						if (template.model) {
							try {
								obj = new Function('return ' + template.model)();
							} catch (e) {
								$.invalid('Invalid model: ' + e.message);
								return;
							}
						}

						var html = ttemplate(obj, model2, helpers);
						obj.body = html;
						html = tlayout(obj, model2, helpers);

						var subject = template.subject || template.name;
						if (subject.indexOf('{{') !== -1)
							subject = Tangular.compile(subject)(obj, model2, helpers);

						var message = Mail.create('[TEST] ' + subject, html);

						message.from(profile.from);
						profile.reply && message.reply(profile.reply);
						profile.bcc && message.bcc(profile.bcc);

						for (var item of addresses)
							message.to(item);

						message.send(profile.smtp, profile.smtp_options.parseJSON(true), $.done());
						return;

					} catch (e) {
						$.invalid('Invalid template: ' + e.message);
						return;
					}
				}
			}

			$.invalid(404);

		} else
			$.invalid('@(Invalid email addresses)');

	});

});