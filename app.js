var express = require('express')
, app = express()
, server = require('http').createServer(app)
, io = require('socket.io').listen(server)
, conf = require('./config.json')
, user = require('./user.js')
, sha1 = require('sha1')
, soloUsers = new Array()
, onlineUser = 0;

// Assign the webserver to the specific port
server.listen(conf.port);

// Use this path normally.
app.use(express.static(__dirname + '/public'));
app.get('/', function (req, res) {
    // Send the index.html file, if the server is called directly.
    res.sendFile(__dirname + '/public/index.html');
});

// Called if the server / user opens a new connection
io.sockets.on('connection', function (socket) {
    // Count up the current onlineUser and output to console.
    console.log('user online: ' + ++onlineUser);
    
    // Send all clients the current onlineUser count.
    io.sockets.emit('system_message', { type: 'user_online_total', message: onlineUser });
    
    // Send a success message to the new connected client.
    socket.emit('system_message', { type: 'user_connected', message: 'You are now connected to the server!' });

    socket.on('user_name_check', function (data) {
        user.checkIfExists(data, function(result) {
            socket.emit('user_name_check', { result: !result });
        });
    });

    socket.on('login', function (userData) {
        console.log('Data: ' + JSON.stringify(userData));
        // Assign the nickname to the current socket.
        socket.client.nickname = userData.nickname;
        user.checkIfExists(userData, function (exists, userData) {
            if (exists) {
                // User exists. Check secret.
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
                // User doesnt exist. Create new one.
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

    socket.on('switch_partner', function (data) {
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

// Writing the current port to the console
console.log('The server now runs on http://127.0.0.1:' + conf.port + '/');

function assign_partner(socket) {
    var partner;
    var oldPartner;

    socket.emit('system_message', { type: 'user_looking_partner', message: 'Looking for partner' });

    if (socket.client.partner != undefined) {
        socket.client.partner.client.partner = undefined;
        
        assign_partner(socket.client.partner);
        oldPartner = socket.client.partner;
        socket.client.partner = undefined;
    }
    
    //Loop through the solo users
    for (var i = 0; i < soloUsers.length; i++) {
        var tmpUser = soloUsers[i];
        
        if (tmpUser != socket.client.partner && tmpUser != oldPartner) {
            soloUsers.splice(i, 1);
            partner = tmpUser;
            break;
        }
    }
    
    // If we found a partner link each other.
    if (partner) {
        socket.client.partner = partner;
        partner.client.partner = socket;
        socket.emit('system_message', { type: 'user_found_partner', message: 'You are now chatting with ' + partner.client.nickname });
        partner.emit('system_message', { type: 'user_found_partner', message: 'You are now chatting with ' + socket.client.nickname });
    }
    // If no partner is found push the current user to the solo user so he can be found by others
    else {
        soloUsers.push(socket);
    }
}

// ********************************
// Prototyping for JS improvements
// ********************************

// Adds sha1 functionality to strings
String.prototype.sha1 = function () { return sha1(this); };