var sha1 = require('sha1')
, db;


exports.checkIfExists = function (user, callback) {
	db.get('SELECT COUNT(*) AS count FROM user WHERE nickname = ?', user.nickname, function (err, row) {
		console.log(row.count);
		if (row.count == 0) {
			if (typeof callback == 'function') {
				callback(false, user);
			}
		} else {
			if (typeof callback == 'function') {
				callback(true, user);
			}
		}
	});
};

exports.verifySecret = function (user, callback) {
	var nickname = user != undefined && user.nickname != undefined ? user.nickname : '';
	var secret = user != undefined && user.secret != undefined ? user.secret : '';
	console.log(nickname);
	console.log(secret);
	console.log(JSON.stringify(user));
	db.get('SELECT * FROM user WHERE nickname = ?', nickname, function (err, row) {
		if (err) throw err;
		if (row != undefined && row.secret == secret) {
			if (typeof callback == 'function') callback (true);
		} else {
			if (typeof callback == 'function') callback (false);
		};
	});
}


exports.addUser = function (user, callback) {
    user.secret = generateSecret(user.nickname);
	addUserSQL(user);
	if (typeof callback == "function") {
		callback(true, user);
	}
};

function addUserSQL(user) {
	db.run('INSERT INTO user VALUES (?, ?, ?, ?)',
		[
			user.nickname,
			'',
			new Date(),
			user.secret
		]);
}

//Initialize the user class
(function () {
	var sqlite3 = require('sqlite3').verbose();
	db = new sqlite3.Database('./users.sqlite3', function (e) {
		if(e) console.log(e);
	});
	db.run('CREATE TABLE IF NOT EXISTS user (nickname TEXT, email TEXT, lastlogin DATETIME, secret TEXT)');
})();


function generateSecret(str) {
	var salt = new Date () + Math.random ();
	return sha1(str + salt);
}
