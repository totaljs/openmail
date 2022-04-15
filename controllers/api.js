exports.install = function() {

	ROUTE('+SOCKET  /', socket, 1024);
	ROUTE('+POST    /', http, [60 * 5000], 1024); // 5 min. timeout + 1024 kB data
	ROUTE('+POST    /', http, ['upload', 60 * 5000], 1024 * 50); // 5 min. timeout + 50 MB

	// Index
	ROUTE('GET /', index);
};

function index() {
	if (PREF.token)
		this.plain(MAIN.name + ' v' + MAIN.version);
	else
		this.redirect('/setup/');
}

function socket() {

	var self = this;

	MAIN.socket = self;

	self.sendmeta = function(client) {
		var msg = { type: 'init', name: PREF.name, version: MAIN.version, id: MAIN.name };
		if (client)
			client.send(msg);
		else
			self.send(msg);
	};

	self.on('open', function(client) {
		client.dtconnected = new Date();
		self.sendmeta(client);
	});

	self.on('message', function(client, msg) {

		if (PREF.log_requests)
			FUNC.audit(client, msg);

		if (msg.type === 'send' && msg.to) {
			FUNC.send(msg, null, function(err, response) {
				msg.callbackid && client.send({ callbackid: msg.callbackid, error: err, success: err == null, response: response });
			}, client.user);
		}

	});
}

function http() {

	var $ = this;
	var payload = $.body;

	if (typeof(payload.data) === 'string' && payload.data.isJSON())
		payload.data = payload.data.parseJSON(true);

	if (typeof(payload.attachments) === 'string' && payload.attachments.isJSON())
		payload.attachments = payload.attachments.parseJSON(true);

	if (PREF.log_requests)
		FUNC.audit($, payload);

	FUNC.send(payload, $.files, $.done(), $.user);
}