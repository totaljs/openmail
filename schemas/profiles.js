NEWSCHEMA('Profiles', function(schema) {

	schema.define('id', UID);
	schema.define('name', String, true);
	schema.define('reference', String);
	schema.define('html', String, true);
	schema.define('icon', 'Icon');
	schema.define('color', 'Color');
	schema.define('model', String);
	schema.define('smtp', String, true);
	schema.define('smtp_options', 'JSON');
	schema.define('helpers', String);
	schema.define('from', 'Email', true);
	schema.define('reply', 'Email');
	schema.define('bcc', 'Email');

	schema.setQuery(function($) {

		var arr = [];

		for (var key in MAIN.db.profiles) {
			var item = MAIN.db.profiles[key];
			var obj = {};
			obj.id = item.id;
			obj.name = item.name;
			obj.icon = item.icon;
			obj.color = item.color;
			obj.reference = item.reference;
			obj.smtp = item.smtp;
			obj.smtp_error = item.smtp_error;
			obj.dtcreated = item.dtcreated;
			obj.dtupdated = item.dtupdated;
			arr.push(obj);
		}

		arr.quicksort('name');
		$.callback(arr);
	});

	schema.setRead(function($) {
		var id = $.id;
		var item = MAIN.db.profiles[id];
		if (item) {

			if ($.query.type === 'basic') {
				var obj = {};
				obj.id = item.id;
				obj.name = item.name;
				obj.icon = item.icon;
				obj.color = item.color;
				obj.reference = item.reference;
				obj.helpers = item.helpers;
				obj.model = item.model;
				obj.from = item.from;
				obj.smtp = item.smtp;
				obj.smtp_error = item.smtp_error;
				$.callback(obj);
			} else
				$.callback(item);
		} else
			$.invalid(404);
	});

	schema.setSave(function($, model) {

		var item;

		if (model.id) {
			item = MAIN.db.profiles[model.id];
			if (item) {
				if (!item.templates)
					item.templates = {};
				item.name = model.name;
				item.color = model.color;
				item.icon = model.icon;
				item.reference = model.reference;
				item.smtp = model.smtp;
				item.smtp_options = model.smtp_options;
				item.html = model.html;
				item.helpers = model.helpers;
				item.model = model.model;
				item.bcc = model.bcc;
				item.from = model.from;
				item.reply = model.reply;
				item.dtupdated = NOW;
			} else {
				$.invalid(404);
				return;
			}
		} else {
			model.id = UID();
			model.dtcreated = NOW;
			model.templates = {};
			item = model;
			MAIN.db.profiles[model.id] = model;
		}

		var options = {};
		if (item.smtp_options) {
			var tmp = item.smtp_options.parseJSON();
			if (tmp)
				options = tmp;
		}

		Mail.try(item.smtp, options, function(error) {
			item.smtp_error = error ? error.toString() : null;
			MAIN.db.save();
		});

		FUNC.refresh();
		$.success(model.id);

	});

	schema.setRemove(function($) {

		var id = $.id;
		var item = MAIN.db.profiles[id];
		if (item) {
			delete MAIN.db.profiles[id];
			FUNC.refresh();
			MAIN.db.save();
			$.success();

		} else
			$.invalid(404);
	});

	schema.addWorkflow('test', function($) {
		var item = MAIN.db.profiles[$.id];
		if (item)
			EXEC('+Profiles/SMTP --> test', { smtp: item.smtp, smtp_options: item.smtp_options }, $.callback, $);
		else
			$.invalid(404);
	});

	schema.addWorkflow('clone', function($) {
		var id = $.id;
		var item = MAIN.db.profiles[id];
		if (item) {
			item = CLONE(item);
			item.id = UID();
			item.name += ' (CLONED)';
			item.reference += '_cloned';

			var templates = {};

			for (var key in item.templates) {
				var template = item.templates[key];
				template.id = UID();
				template.profileid = item.id;
				templates[template.id] = template;
			}

			item.templates = templates;
			MAIN.db.profiles[item.id] = item;
			FUNC.refresh();
			MAIN.db.save();
			$.success();
		} else
			$.invalid(404);
	});

});

NEWSCHEMA('Profiles/Backup', function(schema) {

	schema.define('data', 'JSON', true);

	schema.addWorkflow('make', function($) {

		if (!$.user.sa) {
			$.invalid(401);
			return;
		}

		var id = $.id;
		var profile = MAIN.db.profiles[id];
		if (profile) {

			var dir = PATH.tmp(id);
			var filename = PATH.tmp('openmail_' + (profile.reference || profile.id) + '_' + NOW.format('yyyy-MM-dd.txt'));

			F.Fs.mkdir(dir, function() {
				var filenamemeta = PATH.join(dir, 'meta.json');
				F.Fs.writeFile(filenamemeta, JSON.stringify(profile), function() {
					BACKUP(filename, dir, function(err, response) {
						if (err) {
							$.invalid(err);
						} else {

							$.controller.file('~' + response.filename, U.getName(response.filename), null, function() {
								// Clear files + directory
								PATH.rmdir(dir);
								PATH.unlink(response.filename);
							});

							$.cancel();
						}
					});
				});
			});

		} else
			$.invalid(404);
	});

});

NEWSCHEMA('Profiles/SMTP', function(schema) {

	schema.define('smtp', String, true);
	schema.define('smtp_options', 'JSON');

	schema.addWorkflow('test', function($, model) {
		var options = {};

		if (model.smtp_options) {
			var tmp = model.smtp_options.parseJSON();
			if (tmp)
				options = tmp;
		}

		Mail.try(model.smtp, options, $.done());
	});
});