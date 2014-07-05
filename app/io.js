var Message = require('./models/message');
var User = require('./models/user');

module.exports = function(io) {

  // listen to events from client-side ==================

	io.sockets.on('connection', function(socket) {

    socketInit(socket);
    chatInit(socket);

    socket.on('disconnect', function() {
      User.findOne({ username : socket.request.user.username }, function(err, user) {
        user.sockets.splice(user.sockets.indexOf(socket.id), 1);
        User.findOneAndUpdate({ username : user.username }, {sockets : user.sockets}, function() {
          console.log('socket deleted from the list');
        });
      });
      console.log('disconnect');
    });

    socket.on('talkTo', function(data) { // opened a chat window
      socket.emit('message', {message:'now talking to' + data.talkTo});
    });

    socket.on('sendMessage', function(data) {
      User.findOne({ username : data.friend }, function(err, friend) {
        for (var i = 0; i < friend.sockets.length; i++) {
          io.to(friend.sockets[i]).emit('receiveMessage', {
            from : socket.request.user.username,
            time : data.time,
            content : data.content
          });
        }
      });
      var newMessage = new Message();
      newMessage.from = socket.request.user.username;
      newMessage.to = data.friend;
      newMessage.content = data.content;
      newMessage.time = data.time;
      newMessage.save();
    });
	});
}

function socketInit(socket) {
  User.findOne({ username : socket.request.user.username }, function(err, user) {
    user.sockets.push(socket.id);
    console.log(user.sockets);
    User.findOneAndUpdate({ username : user.username }, {sockets : user.sockets}, function() {
      console.log('socket added to the list');
    });
  });
}

function chatInit(socket) {
  if (socket.request.user.friends) {
    var friendsArray = socket.request.user.friends;
    var friends = [];
    for (var i = 0; i < friendsArray.length; i++) {
      User.findOne({ username : friendsArray[i] }, function(err, friendData) {
        var friend = {};
        friend.username = friendData.username;
        friend.firstName = friendData.firstName;
        friend.lastName = friendData.lastName;

        friends.push(friend);
        if (friends.length == friendsArray.length) {
          console.log('emitting initFriends');
          socket.emit('initFriends', { friends : friends });
        }
      });
    }
  }

}