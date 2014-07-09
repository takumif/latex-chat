var Message = require('./models/message'),
    Group   = require('./models/group'),
    User    = require('./models/user');

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
      newMessage.to = data.recipient;
      newMessage.content = data.content;
      newMessage.time = data.time;
      newMessage.save(function(err, msg, numAffected) {
        if (data.isGroupMsg) {

          Group.findOne({ idString : data.recipient }, function(err, group) {
            // check if it's a new group
            if (socket.request.user.groups.indexOf(data.recipient) == -1) {
              // it is a new group
              for (var i = 0; i < group.members.length; i++) {
                registerMemberToGroup(group.idString, group.members[i]);
              }
            }

            var recipients = [];
            for (var i = 0; i < group.members.length; i++) {
              User.findOne({ username : group.members[i] }, function(err, f) {
                if (f != null) recipients.push(f);
              });
            }

            for (var r = 0; r < recipients.length; r++) {
              for (var i = 0; i < recipients[r].sockets.length; i++) {
                io.to(recipients[r].sockets[i]).emit('receiveMessage', {
                  from : socket.request.user.username,
                  time : data.time,
                  content : data.content,
                  chat : data.recipient
                });
              }
            }
          });
        } else {
          User.findOne({ username : data.recipient }, function(err, friend) {
            if (friend != null) {
              for (var i = 0; i < friend.sockets.length; i++) {
                io.to(friend.sockets[i]).emit('receiveMessage', {
                  from : socket.request.user.username,
                  time : data.time,
                  content : data.content,
                  chat : socket.request.user.username
                });
              }
            }
          });
        }
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
        .limit(30)
        .find(function(err, messages) {
        socket.emit('receiveRecentMessages', {
          from : data.friend,
          messages : messages
        })
      });
    });

    socket.on('searchInput', function(data) {
      var friends = socket.request.user.friends;
      var pending = socket.request.user.pending;
      User.findOne({ username : data.search }, function(err, user) {
        var friend = (user != null && friends.indexOf(user.username) == -1 && pending.indexOf(user.username) == -1) ? {
          username : user.username,
          firstName : user.firstName,
          lastName : user.lastName
        } : null;
        socket.emit('searchResult', {
          friend : friend
        });
      });
    });

    socket.on('sendFriendRequest', function(data) {
      var user = socket.request.user;
      if (user.friends.indexOf(data.friend == -1) &&
          user.pending.indexOf(data.friend == -1)) {
        User.findOne({ username : data.friend }, function(err, friend) {
          if (friend) {
            user.pending.push(friend.username);
            User.findOneAndUpdate({ username : user.username }, {pending : user.pending}, function() {
              console.log('sending friend request');
            });
            for (var i = 0; i < friend.sockets.length; i++) {
              io.to(friend.sockets[i]).emit('receiveFriendRequest', { friend : userNames(user) });
            }
          }
        });
      }
    });

    socket.on('saveOpenChats', function(data) {
      console.log('saveOpenChats');
      var openChats = [];
      var user = socket.request.user;
      for (var i = 0; i < data.openChats.length; i++) {
        if (user.friends.indexOf(data.openChats[i]) != -1 || user.groups.indexOf(data.openChats[i]) != -1) {
          openChats.push(data.openChats[i]);
        }
      }
      User.findOneAndUpdate({ username : user.username }, { openChats : openChats }, function() {
      });
    });

    socket.on('makeGroup', function(data) {
      if (!data.members || typeof(data.members) != 'object') return false; // invalid socket emission

      var members = [ socket.request.user.username ];
      for (var i = 0; i < data.members.length; i++) {
        User.findOne({ username : data.members[i] }, function(err, friend) {
          members.push(friend.username);
          if (members.length == data.members.length + 1) { // callback at the end of the forloop
            var group = new Group();
            group.idString = String(group.id);
            group.members = members;
            group.save(function() {
              console.log('made group: ' + group.idString);
              socket.emit('madeGroup', {
                id : group.idString,
                members : members
              }); // end socket.emit('madeGroup')
            }); // end group.save
          }
        }); // end User.findOne
      }
    }); // end socket.on('makeGroup')

	}); // end socket.on('connection')
}

function socketInit(io, socket) {
  User.findOne({ username : socket.request.user.username }, function(err, user) {
    user.sockets.push(socket.id);
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
          var groups = {};

          getMembersOfGroups(socket, groups, socket.request.user.groups, function() {
            console.log('emitting initFriends');

            socket.emit('initFriends', {
              friends : friends,
              onlineFriends : onlineFriends,
              chattingWith : socket.request.user.openChats,
              groups : groups
            });
          });
        }
      });
    }
  }

}

function registerMembersToGroup(group, members) {
  for (var i = 0; i < members.length; i++) {
    registerMemberToGroup(group, members[i]);
  }
}

function registerMemberToGroup(group, member) {
  Group.findOne({ idString : group }, function(err, g) {
    if (g.members.indexOf(member) == -1) {
      g.members.push(member);
      g.save();
    }
  });
  User.findOne({ username : member }, function(err, user) {
    if (user.groups.indexOf(group) == -1) {
      user.groups.push(group);
      user.save();
    }
  });
}

function getMembersOfGroups(socket, groups, groupIDs, callback) {
  for (var i = 0; i < groupIDs.length; i++) {
    var id = groupIDs[i];
    Group.findOne({ idString : id }, function(err, group) {
      if (group == null) {
        console.log('group not found');
      }
      groups[id] = group.members;
      if (groupIDs.indexOf(id) == groupIDs.length - 1) {
        groups[id].splice(groups[id].indexOf(socket.request.user.username), 1); // get rid of user from the array
        callback();
      }
    });
  }
}

function userNames(user) {
  return {
    username : user.username,
    firstName : user.firstName,
    lastName : user.lastName
  };
}

