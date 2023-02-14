NEWSCHEMA('Templates', function(schema) {

	schema.action('list', {
		name: 'List of templates',
		params: '*profileid:UID',
		permissions: 'profiles',
		action: function($) {

			var params = $.params;
			var db = MAIN.db.profiles[params.profileid];

			if (db) {

				var arr = [];

				for (var key in db.templates) {
					var item = db.templates[key];
					var obj = {};
					obj.id = item.id;
					obj.profileid = item.profileid;
					obj.icon = item.icon;
					obj.name = item.name;
					obj.group = item.group;
					obj.color = db.color;
					obj.count = db.count;
					obj.dtsent = db.dtsent;
					obj.reference = (db.reference || db.id) + '/' + (item.reference || item.id);
					arr.push(obj);
				}

				arr.quicksort('name');

				var data = {};
				data.items = arr;
				data.layout = db.html;
				$.callback(data);
			} else
				$.invalid('@(Profile not found)');
		}

	});

	schema.action('read', {
		name: 'Read template',
		params: '*profileid:UID, *id:UID',
		permissions: 'profiles',
		action: function($) {
			var params = $.params;
			var db = MAIN.db.profiles[params.profileid];
			if (db) {
				var item = db.templates[params.id];
				if (item)
					$.callback(item);
				else
					$.invalid('@(Template not found)');
			} else
				$.invalid('@(Profile not found)');
		}
	});

	schema.action('create', {
		name: 'Create template',
		input: '*name, *subject, reference, group, html, icon:Icon',
		params: '*profileid:UID',
		permissions: 'profiles',
		action: function($, model) {

			var params = $.params;
			var db = MAIN.db.profiles[params.profileid];

			if (!db) {
				$.invalid('@(Profile not found)');
				return;
			}

			model.id = UID();
			db.templates[model.id] = model;
			$.success(model.id);

			MAIN.db.save();
			FUNC.refresh();
		}
	});

	schema.action('update', {
		name: 'Update template',
		input: '*name, *subject, reference, group, icon:Icon',
		params: '*profileid:UID, *id:UID',
		permissions: 'profiles',
		action: function($, model) {

			var params = $.params;
			var db = MAIN.db.profiles[params.profileid];

			if (!db) {
				$.invalid('@(Profile not found)');
				return;
			}

			var item = db.templates[params.id];

			if (!item) {
				$.invalid('@(Template not found)');
				return;
			}

			COPY(model, item);
			$.success(params.id);

			MAIN.db.save();
			FUNC.refresh();

		}
	});

	schema.action('remove', {
		name: 'Remove template',
		params: '*profileid:UID, *id:UID',
		permissions: 'profiles',
		action: function($) {

			var params = $.params;
			var db = MAIN.db.profiles[params.profileid];

			if (db) {
				if (db.templates[params.id]) {
					delete db.templates[params.id];
					MAIN.db.save();
					$.success(params.id);
				} else
					$.invalid('@(Template not found)');
			} else
				$.invalid('@(Profile not found)');

		}
	});

	schema.action('clone', {
		name: 'Clone template',
		params: '*profileid:UID, *id:UID',
		permissions: 'profiles',
		action: async function($) {

			var params = $.params;
			var db = MAIN.db.profiles[params.profileid];

			if (!db) {
				$.invalid('@(Profile not found)');
				return;
			}

			var item = db.templates[params.id];
			if (!item) {
				$.invalid('@(Template not found)');
				return;
			}

			item = CLONE(item);
			item.id = UID();
			item.name += ' (CLONED)';
			item.reference += '_cloned';
			item.count = 0;
			item.dtsent = null;
			db.templates[item.id] = item;

			MAIN.db.save();
			FUNC.refresh();

			$.success(item.id);

		}
	});

	schema.action('html', {
		name: 'Update HTML content',
		input: 'html:String',
		params: '*profileid:UID, *id:UID',
		permissions: 'profiles',
		action: function($, model) {
			var params = $.params;
			var db = MAIN.db.profiles[params.profileid];
			if (db) {
				var item = db.templates[params.id];
				if (item) {
					item.html = model.html;
					MAIN.db.save();
					FUNC.refresh();
					$.success(params.id);
				} else
					$.invalid('@(Template not found)');
			} else
				$.invalid('@(Profile not found)');
		}
	});

	schema.action('export', {
		name: 'Export template',
		params: '*profileid:UID, *id:UID',
		permissions: 'profiles',
		action: function($) {
			var params = $.params;
			var db = MAIN.db.profiles[params.profileid];
			if (db) {
				var template = db.templates[params.id];
				if (template)
					$.callback(template);
				else
					$.invalid('@(Template not found)');
			} else
				$.invalid('@(Profile not found)');
		}
	});

	schema.action('import', {
		name: 'Import template',
		params: '*profileid:UID',
		input: '*id, *name, *subject, reference, html, group, icon:Icon, color:Color',
		permissions: 'profiles',
		action: function($, model) {
			var params = $.params;
			var db = MAIN.db.profiles[params.profileid];
			if (db) {
				db.templates[model.id] = model;
				MAIN.db.save();
				FUNC.refresh();
				$.success();
			} else
				$.invalid('@(Profile not found)');
		}
	});

	schema.action('test', {
		name: 'Send a test email',
		input: '*html, *email:Email',
		params: '*profileid:UID, id:UID',
		permissions: 'profiles',
		action: function($, model) {
			var params = $.params;
			var db = MAIN.db.profiles[params.profileid];
			if (db) {

				var template = null;

				if (params.id) {
					template = db.templates[params.id];
					if (!template) {
						$.invalid('@(Template not found)');
						return;
					}
				}

				if (db.mail_smtp) {
					var mail = Mail.create(CONF.name + ': Test', model.html);
					var opt = db.mail_smtp_options ? db.mail_smtp_options.parseJSON() : null;
					mail.from(db.from);
					mail.to(model.email);
					db.reply && mail.reply(db.reply);
					mail.send(db.mail_smtp, opt, $.done());
				} else
					$.invalid('@(Invalid SMTP configuration)');

			} else
				$.invalid('@(Profile not found)');
		}
	});

	schema.action('bulksend', {
		name: 'Bulk send',
		input: '*email, model:JSON',
		params: '*profileid:UID, id:UID',
		permissions: 'profiles',
		action: function($, model) {

			var params = $.params;
			var db = MAIN.db.profiles[params.profileid];

			if (db) {
				var template = db.templates[params.id];
				if (template) {

					var tmp = {};
					tmp.id = db.reference + '/' + template.reference;
					tmp.email = model.email.split(/,|\n/);
					tmp.model = model.model.parseJSON(true);

					for (var m of tmp.email) {
						var obj = {};
						obj.id = tmp.id;
						obj.to = m.trim();
						obj.data = tmp.model;
						FUNC.send(obj);
					}

					$.success();

				} else
					$.invalid('@(Template not found)');
			} else
				$.invalid('@(Profile not found)');

		}
	});

});