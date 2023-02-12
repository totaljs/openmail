exports.install = function() {

	ROUTE('+POST    /', http, [60 * 5000], 1024); // 5 min. timeout + 1024 kB data
	ROUTE('+POST    /', http, ['upload', 60 * 5000], 1024); // 5 min. timeout + 1024 kB data
	ROUTE('+POST    /api/upload/', upload, 1024);

	// Index
	ROUTE('GET /', index);
	ROUTE('FILE /download/*.*', download);
};


function index() {
	if (CONF.token)
		this.plain(CONF.name);
	else
		this.redirect('/setup/');
}


function http() {

	var $ = this;
	var payload = $.body;

	if (typeof(payload.data) === 'string' && payload.data.isJSON())
		payload.data = payload.data.parseJSON(true);

	if (typeof(payload.attachments) === 'string' && payload.attachments.isJSON())
		payload.attachments = payload.attachments.parseJSON(true);

	if (payload.to && payload.to.indexOf(',') !== -1) {

		var email = payload.to.split(',');

		email.wait(function(m, next) {
			var item = CLONE(payload);
			item.to = m.trim();
			FUNC.send(item);
			setTimeout(next, 10);
		});

		$.success();

	} else
		FUNC.send(payload, $);
}

function upload() {

	var $ = this;
	var file = $.files[0];

	if (file) {
		file.fs('files', UID(), $.successful(function(response) {
			response.url = $.hostname('/download/{id}.{ext}'.args(response));
			$.json(response);
		}));
	} else
		$.json(null);

}

function download(req, res) {
	var filename = req.split[1];
	var index = filename.lastIndexOf('.');
	res.filefs('files', filename.substring(0, index), !!req.query.download);
}