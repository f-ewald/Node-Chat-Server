var express = require('express')
, app = express()
, server = require('http').createServer(app)
, io = require('socket.io').listen(server)
, conf = require('./config.json')
, user = require('./user.js')
, sha1 = require('sha1')
, soloUsers = new Array()
, onlineUser = 0;
// Webserver
// auf den Port x schalten
server.listen(conf.port);

// wenn der Pfad / aufgerufen wird
app.use(express.static(__dirname + '/public'));
app.get('/', function (req, res) {
    // so wird die Datei index.html ausgegeben
    res.sendFile(__dirname + '/public/index.html');
});
// Websocket
io.sockets.on('connection', function (socket) {
    console.log('user online: ' + ++onlineUser);
    
    
    //send all clients the current online user count
    io.sockets.emit('system_message', { type: 'user_online_total', message: onlineUser });
    
    // der Client ist verbunden
    

    socket.emit('system_message', { message: 'Du bist nun mit dem Server verbunden!' });
    
    
    socket.on('login', function (userData) {
        console.log('Data: ' + JSON.stringify(userData));
        socket.client.nickname = userData.nickname;
        user.checkIfExists(userData, function (exists, userData) {
            if (exists) {
                console.log('// User exists. Check secret.');
                user.verifySecret(userData, function (success) {
                    if (success) {
                        socket.client.isLoggedIn = true;
                        socket.emit('system_message', { message: 'Welcome to chat' });
                        assign_partner(socket);
                        
                    } else {
                        socket.emit('system_message', { message: 'Error: Wrong secret' });
                    }
                });
            } else {
                console.log('// User doesnt exist. Create new one.');
                user.addUser(userData, function (success, userData) {
                    socket.emit('system_message', { type: 'user_created', message: 'User created' });
                    socket.emit('user_info', userData);
                    assign_partner(socket);
                });
            }
        });
    });

    socket.on('chat_message', function (data) {
        console.log('message received: ' + JSON.stringify(data));
        if (socket.client.isLoggedIn) {
            if (socket.client.partner != undefined) {
                socket.client.partner.emit('chat_message', { nickname: socket.client.nickname, message: data.message });
            }
            socket.emit('chat_message', { nickname: socket.client.nickname, message: data.message });
        } else {
            socket.emit('system_message', { type: 'error', message: 'Youre not allowed to do that. Please relogin' });
        }
    });

    socket.on('switch_partner', function(data) {
        // We disconnect each other and switch the partners
        // First we check if the partner is already in the solo users so that he cant find him/herself
        
        if (soloUsers.indexOf(socket) == -1) {
            assign_partner(socket);
        }
    });

    socket.on('disconnect', function () {
        io.sockets.emit('system_message', { type: 'user_online_total', message: --onlineUser });
        console.log('Disconnect - looking for new room');
        if (socket.client.partner != undefined) {
            socket.client.partner.client.partner = undefined;
            assign_partner(socket.client.partner);
        }
        var indexOfSoloUser = soloUsers.indexOf(socket);
        if (indexOfSoloUser != -1) {
            soloUsers.splice(indexOfSoloUser, 1);
        }
    });
});
// Portnummer in die Konsole schreiben
console.log('Der Server läuft nun unter http://127.0.0.1:' + conf.port + '/');



function assign_partner(socket) {
    //Loop through the solo users

    var partner;
    var oldPartner;

    socket.emit('system_message', { type: 'user_looking_partner', message: 'Looking for partner' });

    if (socket.client.partner != undefined) {
        socket.client.partner.client.partner = undefined;
        
        assign_partner(socket.client.partner);
        oldPartner = socket.client.partner;
        socket.client.partner = undefined;
    }

    for (var i = 0; i < soloUsers.length; i++) {
        var tmpUser = soloUsers[i];
        
        if (tmpUser != socket.client.partner && tmpUser != oldPartner) {
            soloUsers.splice(i, 1);
            partner = tmpUser;
            break;
        }
    }
    
    if (partner) {
        socket.client.partner = partner;
        partner.client.partner = socket;
        socket.emit('system_message', { type: 'user_found_partner', message: 'You are now chatting with ' + partner.client.nickname });
        partner.emit('system_message', { type: 'user_found_partner', message: 'You are now chatting with ' + socket.client.nickname });
    } else {
        soloUsers.push(socket);
    }
}



// ********************************
// Prototyping for JS improvements
// ********************************

// Checks if an Object is an array.
/*Object.prototype.isArray = function() {
    if (Object.prototype.toString.call(this) == '[object Array]')
         return true;
    return false;
};*/

// Adds sha1 functionality to strings
String.prototype.sha1 = function () { return sha1(this); };

Math.randomBounds = function(lower, upper) {
    var rnd = Math.random();
    var abs = upper - lower;
    return Math.round(rnd * 10000 % abs) + lower;
};

