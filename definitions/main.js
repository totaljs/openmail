MAIN.version = 1;
MAIN.name = 'OpenMail';
MAIN.stats = MEMORIZE('stats');
MAIN.db = MEMORIZE('db');
MAIN.cache = {};
MAIN.tokens = {};

// Temporary, it's loaded automatically
MAIN.meta = {};

if (!MAIN.db.profiles)
	MAIN.db.profiles = {};

ON('ready', function() {
	PREF.name && LOADCONFIG({ name: PREF.name, allow_tms: PREF.allow_tms, secret_tms: PREF.secret_tms });
	FUNC.preparetokens();
	FUNC.refresh();
});