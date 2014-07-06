var Message = require('./models/message');
var User = require('./models/user');

module.exports = function(io) {

  // listen to events from client-side ==================

	io.sockets.on('connection', function(socket) {

    socketInit(io, socket);
    chatInit(socket);

    socket.on('disconnect', function() {
      User.findOne({ username : socket.request.user.username }, function(err, user) {
        user.sockets.splice(user.sockets.indexOf(socket.id), 1);
        User.findOneAndUpdate({ username : user.username }, {sockets : user.sockets}, function() {
          console.log('socket deleted from the list');
        });
        if (user.sockets.length == 0) { // the user is offline, so notify friends
          console.log('user going offline, notifying friends');
          for (var i = 0; i < user.friends.length; i++) {
            User.findOne({ username : user.friends[i] }, function(err, friend) {
              for (var j = 0; j < friend.sockets.length; j++) {
                io.to(friend.sockets[j]).emit('userOffline', { user : user.username });
              }
            });
          }
        }
      });
      console.log('disconnect');
    });

    socket.on('talkTo', function(data) { // opened a chat window
      socket.emit('message', {message:'now talking to' + data.talkTo});
    });

    socket.on('sendMessage', function(data) {
      var newMessage = new Message();
      newMessage.from = socket.request.user.username;
      newMessage.to = data.friend;
      newMessage.content = data.content;
      newMessage.time = data.time;
      newMessage.save(function(err, msg, numAffected) {
        User.findOne({ username : data.friend }, function(err, friend) {
          for (var i = 0; i < friend.sockets.length; i++) {
            io.to(friend.sockets[i]).emit('receiveMessage', {
              from : socket.request.user.username,
              time : data.time,
              content : data.content
            });
          }
        });
      });
    });

    // user has opened a chat window with data.friend, send 10 recent msgs
    socket.on('requireRecentMessages', function(data) {
      console.log('requireRecentMessages called');
      var user = socket.request.user.username;
      Message.find()
        .or([
          { from : user, to : data.friend },
          { from : data.friend, to : user }
        ])
        .sort('-time') // sort by time, descending
        .limit(10)
        .find(function(err, messages) {
        socket.emit('receiveRecentMessages', {
          from : data.friend,
          messages : messages
        })
      });
    });

    socket.on('searchInput', function(data) {
      User.findOne({ username : data.search }, function(err, user) {
        socket.emit('searchResult', {
          found : ((user != null) ? true : false)
        });
      });
    });

	});
}

function socketInit(io, socket) {
  User.findOne({ username : socket.request.user.username }, function(err, user) {
    user.sockets.push(socket.id);
    console.log(user.sockets);
    User.findOneAndUpdate({ username : user.username }, {sockets : user.sockets}, function() {
      console.log('socket added to the list');
    });

    if (user.sockets.length == 1) {
      // came online, so notify friends
      for (var i = 0; i < user.friends.length; i++) {
        User.findOne({ username : user.friends[i] }, function(err, friend) {
          console.log('notifying ' + friend.username + ' that ' + user.username + ' came online');
          for (var j = 0; j < friend.sockets.length; j++) {
            io.to(friend.sockets[j]).emit('userOnline', { user : user.username });
          }
        });
      }
    }
  });
}

function chatInit(socket) {
  if (socket.request.user.friends) {
    var friendsArray = socket.request.user.friends;
    var onlineFriends = [];
    var friends = [];
    for (var i = 0; i < friendsArray.length; i++) {
      User.findOne({ username : friendsArray[i] }, function(err, friendData) {
        var friend = {};
        friend.username = friendData.username;
        friend.firstName = friendData.firstName;
        friend.lastName = friendData.lastName;

        // if online, add to the list of online friends
        if (friendData.sockets.length > 0) {
          onlineFriends.push(friendData.username);
        }

        friends.push(friend);
        if (friends.length == friendsArray.length) {
          console.log('emitting initFriends');
          socket.emit('initFriends', {
            friends : friends,
            onlineFriends : onlineFriends
          });
        }
      });
    }
  }

}