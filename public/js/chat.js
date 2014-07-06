$(function() {
	var chattingWith = [];
	var onlineFriends = [];
	var friends = []; // [ { username: '', firstName: '', lastName: ''}, ... ]

	var socket = io.connect('http://localhost:8080');

	socket.on('initFriends', function(data) {
		if (data.onlineFriends) {
			onlineFriends = data.onlineFriends;
		}
		if (data.friends) {
			friends = data.friends;
			for (var i = 0; i < friends.length; i++) {
				$('.friendListUl').append(friendListItem(friends[i], online));
			}

			$('.friendLi').click(function() { // open chat window with the friend
				var friend = $(this).attr('id').slice(9);
				if (chattingWith.indexOf(friend) == -1) { // if not already chatting
					openChatWindow(friend, socket, chattingWith);
				}
			});
		}
	});

	socket.on('receiveMessage', function(data) {
		if (chattingWith.indexOf(data.from) > -1) { // chat window already open
			$('#chatContent-' + data.from).append(chatMessage(data.from, data.time, data.content));
		} else { // chat window not open, so open it
			openChatWindow(data.from, socket, chattingWith);
		}
		highlightChatWindow(data.from);
	});

	// receiving messages to populate the newly-opened chat window with
	socket.on('receiveRecentMessages', function(data) {
		if (chattingWith.indexOf(data.from) > -1) {
			var chatContent = $('#chatContent-' + data.from);
			for (var i = 0; i < data.messages.length; i++) {
				chatContent.prepend(chatMessage(data.messages[i].from, data.messages[i].time, data.messages[i].content));
			}
		}
	});

	// a friend has gone offline
	socket.on('userOffline', function(data) {
		makeFriendOffline(data.friend, onlineFriends);
	});

	// a friend has come online
	socket.on('userOnline', function(data) {
		makeFriendOnline(data.friend, onlineFriends);
	});
});

function makeFriendOffline(friend, onlineFriends) {
	onlineFriends.splice(onlineFriends.indexOf(friend), 1);
	console.log('online friends: ' + onlineFriends);

	if (chattingWith.indexOf(friend) > -1) { // chat window open
		makeChatWindowOffline(friend);
	}
	makeFriendListItemOffline(friend, onlineFriends);
}

function makeFriendOnline(friend, onlineFriends) {
	if (onlineFriends.indexOf(friend) != -1) {
		console.log('error: friend registered as online came online again');
	} else {
		if (chattingWith.indexOf(friend) > -1) { // chat window open
			makeChatWindowOnline(friend);
		}
		makeFriendListItemOnline(friend, onlineFriends);
	}
}

function makeChatWindowOffline(friend) {
	$('#chatHeader-' + friend).removeClass('onlineChatHeader');
}

function makeChatWindowOnline(friend) {
	$('#chatHeader-' + friend).addClass('onlineChatHeader');
}

function makeFriendListItemOffline(friend, onlineFriends) {
	$('#friendLi-' + friend).removeClass('onlineFriendLi');
	var lastOnline = onlineFriends[onlineFriends.length - 1];
	$('#friendLi-' + friend).insertAfter($('#friendLi-' + lastOnline.username));
}

function makeFriendListItemOnline(friend, onlineFriends) {
	$('#friendLi-' + friend).addClass('onlineFriendLi');
	$('#friendListUl').prepend($('#friendLi-' + friend));
}

function openChatWindow(friend, socket, chattingWith) {
	$('.chats').append(chatWindow(friend));
	socket.emit('talkTo', {
		friend : friend
	});
	populateChatContent(friend, socket);
	bindChatInput(friend, socket);
	bindCloseChatWindow(chattingWith, friend);
	chattingWith.push(friend);
}

function populateChatContent(friend, socket) {
	socket.emit('requireRecentMessages', {
		friend : friend
	});
}

function highlightChatWindow(friend) {
	$('.highlightedChatWindow').removeClass('.highlightedChatWindow');
	$('#chatWindow-' + friend).addClass('.highlightedChatWindow');
}

function bindChatInput(friend, socket) {
	$('#chatInput-' + friend).bind('keypress', function(evt) {
		var code = evt.keyCode || evt.which;
		if (code == 13) {
			sendChatMessage(friend, socket);
		}
	});
}

function sendChatMessage(friend, socket) {
	var content = $('#chatInput-' + friend).val();
	var time = new Date();
	socket.emit('sendMessage', {
		content : content,
		friend : friend,
		time : time
	});
	$('#chatInput-' + friend).val('');
	$('#chatContent-' + friend).append(chatMessage(user, time, content));
}

function bindCloseChatWindow(chattingWith, friend) {
	$('#closeChatWindow-' + friend).click(function(evt){
		$(this).closest('.chatWindow').remove();
		chattingWith.splice(chattingWith.indexOf(friend), 1);
		evt.preventDefault(); 
	});
}

function friendListItem(friend, online) {
	// friend = { username: '', firstName: '', lastName: ''}
	return (
	  '<li class="friendLi" id="friendLi-' + friend.username + '">' + 
	  friend.username + '</li>'
	);
}

function chatWindow(friend) {
	return (
    '<div class="chatWindow" id="chatWindow-' + friend + '">' +
    '<div class="chatHeader" id="chatHeader->' + friend + '">' + friend +
    '<a href="" class="closeChatWindow" id="closeChatWindow-' + friend +
    '">x</a></div>' +
    '<div class="chatContent" id="chatContent-' + friend + '"></div>' +
    '<div class="chatInputDiv">' +
    '<input type="text" class="chatInput" id="chatInput-' + friend +
		'" /></div></div>'
	);
}

function chatMessage(from, time, content) {
	return (
	  '<div class="chatMessage">' + 
	  '<div class="chatMessageSender">' + from + '</div>' +
	  '<div class="chatMessageTime">' + time + '</div>' +
	  '<div class="chatMessageContent">' + content + '</div>' +
	  '</div>'
	);
}


