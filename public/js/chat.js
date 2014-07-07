$(function() {
	var chattingWith = [];
	var onlineFriends = [];
	var friends = []; // [ { username: '', firstName: '', lastName: ''}, ... ]
	pending = [];

	var socket = io.connect('http://localhost:8080');

	searchInit(socket);
	documentInit();

	socket.on('initFriends', function(data) {
		if (data.onlineFriends) {
			onlineFriends = data.onlineFriends;
		}
		if (data.friends) {
			friends = data.friends;
			
			for (var i = 0; i < friends.length; i++) {
				if (onlineFriends.indexOf(friends[i].username) > -1) {
					$('.friendListUl').prepend(friendListItem(friends[i], true));
				}else {
					$('.friendListUl').append(friendListItem(friends[i], false));
				}
				
			}

			$('.friendLi').click(function() { // open chat window with the friend
				var friend = $(this).attr('id').slice(9);
				if (chattingWith.indexOf(friend) == -1) { // if not already chatting
					openChatWindow(friend, socket, chattingWith, onlineFriends, friends);
				} else {
					selectChatWindow(friend);
				}
			});
		}
	});

	socket.on('receiveMessage', function(data) {
		if (chattingWith.indexOf(data.from) > -1) { // chat window already open
			$('#chatContent-' + data.from).append(chatMessage(data.from, data.time, data.content, friends));
		} else { // chat window not open, so open it
			openChatWindow(data.from, socket, chattingWith, onlineFriends, friends);
		}
		highlightChatWindow(data.from);
		scrollChatToBottom(data.from, true);
	});

	// receiving messages to populate the newly-opened chat window with
	socket.on('receiveRecentMessages', function(data) {
		if (chattingWith.indexOf(data.from) > -1) {
			var chatContent = $('#chatContent-' + data.from);
			for (var i = 0; i < data.messages.length; i++) {
				chatContent.prepend(chatMessage(data.messages[i].from, data.messages[i].time, data.messages[i].content, friends));
			}
			scrollChatToBottom(data.from, false);
		}
	});

	// a friend has gone offline
	socket.on('userOffline', function(data) {
		makeFriendOffline(data.user, onlineFriends, chattingWith);
	});

	// a friend has come online
	socket.on('userOnline', function(data) {
		makeFriendOnline(data.user, onlineFriends, chattingWith);
	});

	socket.on('receiveFriendRequest', function(data) {
		receiveFriendRequest(data.friend);
	});
});

function documentInit() {
	$(window).click(function() {
		if (noTextSelected()) {
			$('.selectedChatWindow').removeClass('selectedChatWindow');
		}
	});
}

function makeFriendOffline(friend, onlineFriends, chattingWith) {
	console.log(onlineFriends);
	onlineFriends.splice(onlineFriends.indexOf(friend), 1);
	console.log(friend + ' went offline');

	if (chattingWith.indexOf(friend) > -1) { // chat window open
		makeChatWindowOffline(friend);
	}
	makeFriendListItemOffline(friend, onlineFriends);
}

function makeFriendOnline(friend, onlineFriends, chattingWith) {
	if (onlineFriends.indexOf(friend) != -1) {
		console.log('error: friend registered as online came online again');
	} else {
		console.log(friend + ' came online');
		onlineFriends.push(friend);
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
	console.log('making chat header online');
	$('#chatHeader-' + friend).addClass('onlineChatHeader');
}

function makeFriendListItemOffline(friend, onlineFriends) {
	$('#friendLi-' + friend).removeClass('onlineFriendLi');
	var lastOnline = onlineFriends[onlineFriends.length - 1];
	console.log(onlineFriends);
	$('#friendLi-' + friend).insertAfter($('#friendLi-' + lastOnline));
}

function makeFriendListItemOnline(friend, onlineFriends) {
	$('#friendLi-' + friend).addClass('onlineFriendLi');
	$('.friendListUl').prepend($('#friendLi-' + friend));
}

function openChatWindow(friend, socket, chattingWith, onlineFriends, friends) {
	$('.chats').append(chatWindow(friend, friends));
	socket.emit('talkTo', {
		friend : friend
	});
	populateChatContent(friend, socket);
	bindChatInput(friend, socket, friends);
	bindCloseChatWindow(chattingWith, friend);
	chattingWith.push(friend);
	if (onlineFriends.indexOf(friend) > -1) {
		makeChatWindowOnline(friend);
	}
	resizeChatContentWrapper();
	selectChatWindow(friend);
	bindChatWindow(friend);
}

function selectChatWindow(friend) {
	if (noTextSelected()) {
		var w = $('#chatWindow-' + friend);
		setTimeout(function() { // give time for the previous selection to disappear
			if (!w.hasClass('selectedChatWindow')) {
				w.addClass('selectedChatWindow');
			}
		}, 50);
		w.find('textarea').focus();
	}
}

function bindChatWindow(friend) {
	$('#chatWindow-' + friend).click(function() {
		selectChatWindow(friend);
	});
}

function populateChatContent(friend, socket) {
	socket.emit('requireRecentMessages', {
		friend : friend
	});
}

function highlightChatWindow(friend) {
	$('.highlightedChatWindow').removeClass('highlightedChatWindow');
	$('#chatWindow-' + friend).addClass('highlightedChatWindow');
}

function bindChatInput(friend, socket, friends) {
	$('#chatInput-' + friend).bind('keypress', function(evt) {
		var code = evt.keyCode || evt.which;
		if (code == 13) {
			if (!evt.shiftKey) {
				evt.preventDefault();
				if ($('#chatInput-' + friend).val() != '') {
					sendChatMessage(friend, socket, friends);
				}
			}
		}
	});
}

function sendChatMessage(friend, socket, friends) {
	var content = $('#chatInput-' + friend).val();
	var time = new Date();
	socket.emit('sendMessage', {
		content : content,
		friend : friend,
		time : time
	});
	$('#chatInput-' + friend).val(null);
	$('#chatContent-' + friend).append(chatMessage(user, time, content, friends));
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
	var onlineClass = online ? ' onlineFriendLi' : '';
	return (
	  '<li class="friendLi' + onlineClass + '" id="friendLi-' + friend.username + '">' + 
	  friend.firstName + ' ' + friend.lastName + '</li>'
	);
}

function chatWindow(friend, friends) {
	var name = getName(friends, friend);
	return (
    '<div class="chatWindow" id="chatWindow-' + friend + '">' +
    '<div class="chatHeader" id="chatHeader-' + friend + '">' + name +
    '<a href="" class="closeChatWindow" id="closeChatWindow-' + friend +
    '">x</a></div>' +
    '<div class="chatContentWrapper" id="chatContentWrapper-' + friend + '">' +
    '<div class="chatContent" id="chatContent-' + friend + '"></div></div>' +
    '<div class="chatInputDiv">' +
    '<textarea cols="39" rows="5" class="chatInput" id="chatInput-' + friend +
		'" placeholder="Message..."/></div></div>'
	);
}
function formatTime(time) {
	var months=["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	var day = time.getDate(),
		month = months[time.getMonth()],
		minutes = time.getMinutes(),
		hours = time.getHours();
	if (minutes < 10) {
			minutes= "0"+minutes;
		}
	return (month+ " " +day +", " + hours+":"+minutes);
}

function chatMessage(from, time, content, friends) {
	if (typeof time == 'string') {
		time = new Date(time);
	}
	var name = (from == user) ? userFirstName : getFirstName(friends, from);
	return (
	  '<div class="chatMessage">' + 
	  '<div class="chatMessageSender">' + name + '</div>' +
	  '<div class="chatMessageTime">' + formatTime(time) + '</div>' +
	  '<div class="chatMessageContent">' + escapeHtml(content) + '</div>' +
	  '</div>'
	);
}

function escapeHtml(string) {
	 var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
  };
  return String(string).replace(/[&<>"'\/]/g, function (s) {
    return entityMap[s];
  });
}

function getFirstName(friends, username) {
	var f = friends.filter(function(obj) { return obj.username == username })[0];
	return f.firstName;
}

function getName(friends, username) {
	var f = friends.filter(function(obj) { return obj.username == username })[0];
	return (f.firstName + ' ' + f.lastName);
}

function scrollChatToBottom(friend, animate) {
	var d = $('#chatContentWrapper-' + friend);
	if (animate) {
		d.animate({ scrollTop : d.prop('scrollHeight') }, 300);
	} else {
		d.scrollTop(d.prop('scrollHeight'));
	}
}

function noTextSelected() {
	return (getSelection().toString() == '');
}

// ===================== SEARCH FUNCTION ==============================

function searchInit(socket) {
	var typingTimer;                //timer identifier
  var doneTypingInterval = 500;  //time in ms, 5 second for example

	//on keyup, start the countdown
	$('#searchBar').keyup(function(){
    clearTimeout(typingTimer);
    $('#searchResult').html('');
    typingTimer = setTimeout(function() { doneTypingSearch(socket) }, doneTypingInterval);
	});

	//on keydown, clear the countdown 
	$('#searchBar').keydown(function(){
	  clearTimeout(typingTimer);
	  $('#searchResult').html('');
	});

	socket.on('searchResult', function(data) {
		if (data.friend) {
			$('#searchResult').html('<img id="searchAdd" src="/img/add.png">');
			$('#searchAdd').click(function() { addFriend(data.friend, socket) });
		} else {
		  $('#searchResult').html('');
		}
	});
}

function doneTypingSearch(socket) {
	if ($('#searchBar').val() != '') {
		$('#searchResult').html('<img id="searchAdd" src="/img/loading.gif">');
	  socket.emit('searchInput', { search : $('#searchBar').val() });
	}
}

function addFriend(friend, socket) {
	if (pending.indexOf(friend.username) == -1) {
		pending.push(friend.username);
		var li = friendListItem(friend, false);
		li = li.replace('class="', 'class="pendingFriendLi ');
		$('.friendListUl').append(li);
		socket.emit('sendFriendRequest', { friend : friend.username });
	}
}

function receiveFriendRequest (friend) {
	var li = friendListItem(friend, false);
	li = li.replace('class="', 'class="pendingRequestFriendLi ');
	$('.friendListUl').append(li);
}



