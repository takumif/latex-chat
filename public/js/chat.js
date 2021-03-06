$(function() {
	chattingWith = [];
	onlineFriends = [];
	friendsArr = []; // [ username, ... ]
	friends = []; // [ { username: '', firstName: '', lastName: ''}, ... ]
	pending = [];
	friendRequests = []; // [ { username: '', firstName: '', lastName: ''}, ... ]
	sentMsgs = {};		
	groups = {}; // { groupName : [friend1, friend2], .. }
	earliestMsgs = {}; // { username: date, ... }
	friendsInfo = {}; // { username: { lastMsgUser : username, lastMsgTime : time }, ... }
	initialized = false;

	socket = io.connect(document.URL);

	documentInit();

	socket.on('initFriends', function(data) {
		if (!initialized) {
		initialized = true;

		if (data.onlineFriends) {
			onlineFriends = data.onlineFriends;
		}
		if (data.friends) {
			friends = data.friends;
		}
		if (data.friendsArr) {
			friendsArr = data.friendsArr;
		}
		if (data.chattingWith) {
			chattingWith = data.chattingWith;
		}
		if (data.groups) {
			console.log('groups:');
			console.log(data.groups);
			groups = data.groups;
		}

		if (data.friends) {
			for (var i = 0; i < friends.length; i++) {
				addToSentMsgs(friends[i].username);
			}
			
			for (var i = 0; i < friends.length; i++) {
				addToFriendListDiv(friends[i]);
			}
		} // end if (data.friends)
		
		if (data.groups) {
			for (var group in groups) {
				console.log('group: ' + group);
				if (groups.hasOwnProperty(group)) {
					addToSentMsgs(group);
					$('.friendListUl').append(friendListItem(group, false));
					bindFriendListItem(group);
				}
			}
		}

		if (data.friendRequests) {
			if (data.friendRequests.length) {
				friendRequests = data.friendRequests;
				initFriendRequests();
			}
		}

		if (data.pending) {
			pending = data.pending;
			for (var i = 0; i < pending.length; i++) {
				$('.friendListUl').append(pendingFriendListItem(pending));
			}
		}

		for (var i = 0; i < chattingWith.length; i++) {
			createChatWindow(chattingWith[i], socket, chattingWith, onlineFriends, friends);
		}
		refreshChatHidden();

	}}); // end socket.on('initFriends')

	socket.on('receiveMessage', function(data) {
		console.log('received a message');
		if (chattingWith.indexOf(data.chat) > -1) { // chat window already open
			if (friendsInfo[data.chat] && 
			    friendsInfo[data.chat].lastMsgUser == data.from && 
			    new Date(data.time) - new Date(friendsInfo[data.chat].lastMsgTime) < 300000) {
				$('#chatContent-' + data.chat).append(chatMessageWithoutName(data.from, data.time, data.content, friends));
			} else {
				$('#chatContent-' + data.chat).append(chatMessage(data.from, data.time, data.content, friends));
			}
			friendsInfo[data.chat].lastMsgUser = data.from;
			friendsInfo[data.chat].lastMsgTime = data.time;
		} else { // chat window not open, so open it
			openNewChatWindow(data.chat, socket, chattingWith, onlineFriends, friends);
		}
		highlightChatWindow(data.chat);
		formatElem($('#chatContent-' + data.chat), true);
	});

	// receiving messages to populate the newly-opened chat window with
	socket.on('receiveRecentMessages', function(data) {
		if (data.from && data.messages && data.messages.length) {
			prependMsgsToChat(data);
			formatElem($('#chatContent-' + data.from), true);
		}
	});

	// loading previous messages because the user scrolled up in the chat window
	socket.on('receivePreviousMessages', function(data){
		if (data.messages && data.messages.length &&
		    data.messages[data.messages.length - 1].time != earliestMsgs[data.from]) {

			// get the previously earliest message
			var msg = $('#chatMessage-' + earliestMsgs[data.from].replace(/:|./g, '-'));
			console.log('message:');
			console.log(msg);

			prependMsgsToChat(data);
			formatElem($('#chatContent-' + data.from), false);
			
			// scroll to where it was before
			$('#chatContentWrapper-' + data.from).scrollTop(msg.offset().top);
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

	socket.on('madeGroup', function(data) {
		if (data.id && data.members) {
			groups[data.id] = data.members;
			openNewChatWindow(data.id, socket, chattingWith, onlineFriends, friends);
			addToSentMsgs(data.id);
		}
	});

	socket.on('foundGroup', function(data) { // formed a group that already exists
		groups[data.id] = data.members;
		if (chattingWith.indexOf(data.id) > -1) {
			openChatWindow(data.id); // bring the window into the view
		} else { // chat window not open, so open it
			openNewChatWindow(data.id, socket, chattingWith, onlineFriends, friends);
		}
		highlightChatWindow(data.id);
		formatElem($('#chatContent-' + data.id), true);
	}); // end socket.on('foundGroup')

	socket.on('addFriend', function(data) {
		if (data.online) onlineFriends.push(data.friend.username);
		addToFriendListDiv(data.friend);
		friendsArr.push(data.friend.username);
		friends.push(data.friend);
		if (pending.indexOf(data.friend.username) != -1) {
			pending.splice(pending.indexOf(data.friend.username), 1);
			$('#pendingFriendLi-' + data.friend.username).remove();
		}
		friendRequests.push(data.friend);
		addToSentMsgs(data.friend.username);
	}); // end socket.on('addFriend')

});

$.fn.extend({
  insertAtCursor: function(value) {
    var cursorPos = getCursorPos(this[0]);
	  this.val(
	    this.val().substring(0, cursorPos) + 
	    value + 
	    this.val().substring(cursorPos, this.val().length)
	  );
	}
});

function documentInit() {
	$(window).click(function(evt) {
		if (noTextSelected()) {
			$('.selectedChatWindow').removeClass('selectedChatWindow');
			if (evt.target == $('.minimizedToggle')[0]) {
				toggleMinimizedList();
			} else {
				if (!$(evt.target).hasClass('closeChatWindow')) {
					hideMinimizedList();
				}
			}
		}
	});

	organizeChatWindows();

	searchInit(socket);
}

function displayUsername (data, index) {
	if (index == data.messages.length - 1) return true;
	var oldTime = new Date(data.messages[index + 1].time),
		newTime = new Date(data.messages[index].time);
	if ((newTime - oldTime) > 300000) {
		return true;
	} else if (data.messages[index].from != data.messages[index + 1].from) {
		return true 
	}
	return false;
}

function bindFriendListItem(friend) {

	$('#friendLi-' + friend).click(function() { // open chat window with the friend
		var friend = $(this).attr('id').slice(9);
		if (chattingWith.indexOf(friend) == -1) { // if not already chatting
			openNewChatWindow(friend, socket, chattingWith, onlineFriends, friends);
		} else {
			openChatWindow(friend);
		}
	});
}

function addToFriendListDiv(friend) {
	if (onlineFriends.indexOf(friend.username) > -1) {
		$('.friendListUl').prepend(friendListItem(friend, true));
	} else {
		$('.friendListUl').append(friendListItem(friend, false));
	}
	bindFriendListItem(friend.username);
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

function openNewChatWindow(friend, socket, chattingWith, onlineFriends, friends) {
	chattingWith.push(friend);
	$('.chats').append(chatWindow(friend, friends));
	openChatWindow(friend); // order the chats, refreshChatHidden

	initChatWindow(friend, socket, chattingWith, onlineFriends, friends);
}

function initChatWindow(friend, socket, chattingWith, onlineFriends, friends) {
	socket.emit('talkTo', {
		friend : friend
	});
	populateChatContent(friend, socket);
	bindChatInput(friend, socket, friends);
	bindCloseChatWindow(chattingWith, friend);
	if (onlineFriends.indexOf(friend) > -1) {
		makeChatWindowOnline(friend);
	}
	resizeChatContentWrapper(); // in js/style.js
	bindChatWindow(friend);
	initAddToGroupInput(friend);
}

function createChatWindow(friend, socket, chattingWith, onlineFriends, friends) {
	$('.chats').append(chatWindow(friend, friends));
  initChatWindow(friend, socket, chattingWith, onlineFriends, friends);
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
		console.log('focusing on the textarea');
	}
}

function bindChatWindow(friend) {
	$('#chatHeader-' + friend + ', #chatContentWrapper-' + friend + ', #chatButtonsDiv-' + friend)
	  .click(function() {
		selectChatWindow(friend);
	});

	$('#chatContentWrapper-' + friend).scroll(function() {
		if ($('#chatContentWrapper-' + friend).scrollTop() == 0) { // scrolled to top
			socket.emit('requirePreviousMessages', {
				from : friend,
				before : earliestMsgs[friend],
				isGroupChat : isGroupChat(friend)
			})
		}
	});

	bindChatInputButtons(friend);
}

function populateChatContent(friend, socket) {
	socket.emit('requireRecentMessages', {
		from : friend,
		isGroupChat : isGroupChat(friend)
	});
}

function highlightChatWindow(friend) {
	$('.highlightedChatWindow').removeClass('highlightedChatWindow');
	$('#chatWindow-' + friend).addClass('highlightedChatWindow');
}

function bindChatInput(friend, socket, friends) {
	$('#chatInput-' + friend).bind('keydown', function(evt) {
		var code = evt.keyCode || evt.which;
		var f = sentMsgs[friend];
		if (code == 13) { // enter key
			if (!evt.shiftKey) {
				evt.preventDefault();
				if ($(this).val() != '') {
					sendChatMessage(friend, socket, friends);
					f.index = 0;
				}
			}
		} else if (code == 38 && evt.shiftKey) { // up arrow
			evt.preventDefault();
			chatPrevMsg(friend);
		} else if (code == 40 && evt.shiftKey) { // down arrow key
			evt.preventDefault();
			chatNextMsg(friend);
		} else if (code == 9) { // tab
			evt.preventDefault();
			$(this).insertAtCursor('  ');
		}
	});
}

function chatPrevMsg(friend) {
	var f = sentMsgs[friend];
	if (f.index < f.msgs.length - 1) {
		if (f.index == 0) {
			f.msgs[f.msgs.length - 1] = $('#chatInput-' + friend).val();
		}
		$('#chatInput-' + friend).val(f.msgs[f.msgs.length - f.index - 2]);
		f.index++;
	}
}

function chatNextMsg(friend) {
	var f = sentMsgs[friend];
	if (f.index > 0) {
		f.index--;
		$('#chatInput-' + friend).val(f.msgs[f.msgs.length - f.index - 1]);
	}
}

function prependMsgsToChat(data) { // data.from and data.messages
	if (chattingWith.indexOf(data.from) > -1) {
		var chatContent = $('#chatContent-' + data.from);

		friendsInfo[data.from] = {};

		for (var i = 0; i < data.messages.length; i++) {
			
			if (displayUsername(data, i)) {
				chatContent.prepend(chatMessage(data.messages[i].from, data.messages[i].time, data.messages[i].content, friends));
			} else {
				chatContent.prepend(chatMessageWithoutName(data.messages[i].from, data.messages[i].time, data.messages[i].content, friends));
			}
			if (i == data.messages.length - 1) {
				friendsInfo[data.from].lastMsgUser = data.messages[i].from;
				friendsInfo[data.from].lastMsgTime = data.messages[i].time;
			}
		}
	}
	earliestMsgs[data.from] = data.messages[data.messages.length - 1].time;
}

function sendChatMessage(recipient, socket, friends) {
	var content = $('#chatInput-' + recipient).val();
	var time = new Date();
	var isGroupMsg = false;
	if (groups.hasOwnProperty(recipient)) isGroupMsg = true;
	socket.emit('sendMessage', {
		content : content,
		recipient : recipient,
		time : time,
		isGroupMsg : isGroupMsg
	});
	$('#chatInput-' + recipient).val(null);

	if (friendsInfo[recipient] && 
	    friendsInfo[recipient].lastMsgUser == user && 
	    new Date(time) - new Date(friendsInfo[recipient].lastMsgTime) < 300000) {
		$('#chatContent-' + recipient).append(chatMessageWithoutName(user, time, content, friends));
	} else {
		$('#chatContent-' + recipient).append(chatMessage(user, time, content, friends));
	}
	if (!friendsInfo[recipient]) friendsInfo[recipient] = {};
	friendsInfo[recipient].lastMsgUser = user;
	friendsInfo[recipient].lastMsgTime = time;
	
	formatElem($('#chatContent-' + recipient), true);

	// add the input to the list of sent messages
	var msgs = sentMsgs[recipient].msgs;
	msgs[msgs.length - 1] = content;
	msgs.push('');
}

function bindCloseChatWindow(chattingWith, friend) {
	$('.closeChatWindow-' + friend).unbind();
	$('.closeChatWindow-' + friend).click(function(evt){
		closeChatWindow(chattingWith, friend);
	});
}

function closeChatWindow(chattingWith, friend) {
	console.log('closeChatWindow');
	$('#chatWindow-' + friend).remove();
	$('#minimizedWindowLi-' + friend).remove();
	chattingWith.splice(chattingWith.indexOf(friend), 1);
	refreshChatHidden();
	saveOpenChats();
}

function friendListItem(friend, online) {
	// friend = { username: '', firstName: '', lastName: ''}
	if (typeof(friend) == 'string') { // it's a group ID
		return (
		  '<li class="friendLi clickable" id="friendLi-' + friend + '">' + 
		  getFirstNames(friend) + '</li>'
		);
	}
	var onlineClass = online ? ' onlineFriendLi' : '';
	return (
	  '<li class="friendLi clickable' + onlineClass + '" id="friendLi-' + friend.username + '">' + 
	  friend.firstName + ' ' + friend.lastName + '</li>'
	);
}


function pendingFriendListItem(friend) {
	return (
	  '<li class="pendingFriendLi friendLi" id="pendingFriendLi-' + friend + '">' + 
	  friend + ' (pending) </li>'
	);
}


function chatWindow(friend, friends) {
	var name = getName(friend);
	var code = '<div class="chatWindow" id="chatWindow-' + friend + '">' +
    '<div class="chatHeader" id="chatHeader-' + friend + '">' +
    '<div class="chatHeaderNameWrapper"><span class="chatHeaderName">' + name + '</span></div>' +
    closeChatWindowButton(friend) +
    '<div class="toggleAddButton darkClickable" id="toggleAddButton-' + friend + '">+</div></div>' +
    '<div class="chatAddToGroup" id="chatAddToGroup-' + friend + '">' +
    '<div class="chatAddPlaceholder" id="chatAddPlaceholder-' + friend + '">Enter names here...</div>' +
    '<input class="chatAddToGroupInput" id="chatAddToGroupInput-' + friend +'" data-role="tagsinput"/>' +
    '<div class="addToGroupButton clickable" id="addToGroupButton-' + friend + '">add</div></div>' +
    '<div class="chatContentWrapper" id="chatContentWrapper-' + friend + '">' +
    '<div class="chatContent" id="chatContent-' + friend + '"></div></div>' +
    '<div class="chatInputDiv">' +
    '<textarea cols="39" rows="4" class="chatInput" id="chatInput-' + friend +
		'" placeholder="Message..."/></div>' + chatInputButtons(friend) + '</div>';

	return code;
}

function chatInputButtons(friend) {
	var code = '<div class="chatButtonsDiv" id="chatButtonsDiv-' + friend + '">' +
		'<span class="chatButton clickable chatLatexButton" id="chatLatexButton-' + friend + '">Insert LaTeX</span>' +
		'<span class="chatButton clickable chatCodeButton" id="chatCodeButton-' + friend + '">Insert code</span>' +
		'<span class="chatButton clickable chatPrevButton" id="chatPrevButton-' + friend + '">Prev</span>' +
		'<span class="chatButton clickable chatNextButton" id="chatNextButton-' + friend + '">Next</span>' +
		'</div>';
	return code;
}

function bindChatInputButtons(friend) {
	runMathJax($('#chatLatexButton-' + friend));
	$('#chatLatexButton-' + friend).click(function(evt) {
		$('#chatInput-' + friend).insertAtCursor('$$');
		moveChatInputCursor(friend, 1);
	});
	$('#chatCodeButton-' + friend).click(function(evt) {
		$('#chatInput-' + friend).insertAtCursor('####');
		moveChatInputCursor(friend, 2);
	});
	$('#chatPrevButton-' + friend).click(function() {
		chatPrevMsg(friend);
	});
	$('#chatNextButton-' + friend).click(function() {
		chatNextMsg(friend);
	});
}

function moveChatInputCursor(friend, diff) {
	moveInputCursor($('#chatInput-' + friend)[0], diff);
}

function getCursorPos(el) {
  if (el.selectionStart) { 
    return el.selectionStart; 
  } else if (document.selection) { 
    el.focus(); 

    var r = document.selection.createRange(); 
    if (r != null) {
      var re = el.createTextRange(), 
        rc = re.duplicate(); 
      re.moveToBookmark(r.getBookmark()); 
      rc.setEndPoint('EndToStart', re); 

      return rc.text.length; 
    }
  }
  return 0;
}

function moveInputCursor(el, diff) {
	var cur_pos = getCursorPos(el);

  if (el.setSelectionRange) {
    el.focus();
    el.setSelectionRange(cur_pos + diff, cur_pos + diff);
  } else if (el.createTextRange) {
    var range = el.createTextRange();
    range.collapse(true);
    range.moveEnd('character', cur_pos + diff);
    range.moveStart('character', cur_pos + diff);
    range.select();
  }
}

function closeChatWindowButton(friend) {
	return ('<div class="closeChatWindow darkClickable closeChatWindow-' +
	  friend + '">X</div>');
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
	var sender = (from == user) ? ' senderSelf' : '';
	return (
	  '<div class="chatMessage yesName' + sender + '" id="chatMessage-' + time.toISOString().replace(/:|./g, '-') + '">' + 
	  '<div class="chatMessageSender">' + name + '</div>' +
	  '<div class="chatMessageTime">' + formatTime(time) + '</div>' +
	  '<div class="chatMessageContent">' + codify(Autolinker.link(escapeHtml(content))) + '</div>' +
	  '</div>'
	);
}

function chatMessageWithoutName(from, time, content, friends) {
	if (typeof time == 'string') {
		time = new Date(time);
		}
	if (from == user) {
		return (
		  '<div class="chatMessage noName senderSelf id="chatMessage-' + time.toISOString().replace(/:|./g, '-') + '">' +
		  '<div class="chatMessageContent">' + codify(Autolinker.link(escapeHtml(content))) + '</div>' +
		  '</div>'
	 	);
	} else {
		return (
		  '<div class="chatMessage noName id="chatMessage-' + time.toISOString().replace(/:|./g, '-') + '">' +
		  '<div class="chatMessageContent">' + codify(Autolinker.link(escapeHtml(content))) + '</div>' +
		  '</div>'
		 );
	}
}

function escapeHtml(string) {
	 var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "\t": '  '
    // "/": '&#x2F;'
  };
  return String(string).replace(/[&<>"'\t]/g, function (s) {
  // return String(string).replace(/[&<>"'\/]/g, function (s) {
    return entityMap[s];
  });
}


function getFirstName(friends, username) {
	var f = friends.filter(function(obj) { return obj.username == username })[0];
	return f.firstName;
}

function getFirstNames(group) {
	var names = getFirstName(friends, groups[group][0])
	for (var i = 1; i < groups[group].length; i++) {
		names += ', ' + getFirstName(friends, groups[group][i]);
	}
	return names;
}

function getName(id) {
	var f = friends.filter(function(obj) { return obj.username == id })[0];
	if (f == null) return getFirstNames(id);
	return (f.firstName + ' ' + f.lastName);
}

function scrollChatToBottom(friend, animate) {
	var d = $('#chatContentWrapper-' + friend);
	scrollToBottom(d, animate);
}

function scrollToBottom(elem, animate) {
	if (animate) {
		elem.animate({ scrollTop : elem.prop('scrollHeight') }, 300);
	} else {
		elem.scrollTop(elem.prop('scrollHeight'));
	}
}

function noTextSelected() {
	return (getSelection().toString() == '');
}

function chatContentAtBottom(friend) {
	var d = $('#chatContent-' + friend);
	console.log(d.scrollTop());
	console.log(d.height());
   if (d.scrollTop() + d.height() == $(document).height()) {
       console.log("bottom!");
   }
}

function isOnline(friend) {
	return (onlineFriends.indexOf(friend) != -1);
}

function saveOpenChats() {
	socket.emit('saveOpenChats', { openChats : chattingWith });
}

function addToSentMsgs(recipient) {
  sentMsgs[recipient] = { 'msgs': [''], 'index': 0 };
}

// ========================== ORGANIZING CHAT WINDOWS ==========================

function openChatWindow(friend) {
	// friend is already in the list of chattingWith
	var pos = chattingWith.indexOf(friend);

	if (pos >= windowsToDisplay) {
		$('#chatWindow-' + friend).insertBefore(
		  $('#chatWindow-' + chattingWith[windowsToDisplay - 1])
		);
		chattingWith.splice(pos, 1);
		chattingWith.splice(windowsToDisplay - 1, 0, friend);
		console.log(chattingWith);

		refreshChatHidden();
	}
	scrollChatToBottom(friend, false);
	selectChatWindow(friend);
	saveOpenChats();
}

function organizeChatWindows() { // called from js/style.js
	var oldWTD = (typeof(windowsToDisplay) == 'undefined') ? 0 : windowsToDisplay;
  windowsToDisplay = toInt(($(window).width() - 290) / 320) || 1; // global :P
  if (oldWTD != windowsToDisplay) refreshChatHidden();
}

function refreshChatHidden() {
	for (var i = 0; i < chattingWith.length; i++) {
		if (i < windowsToDisplay) {
			// display the window
			$('#chatWindow-' + chattingWith[i]).removeClass('chatWindowHidden');
		} else {
			$('#chatWindow-' + chattingWith[i]).addClass('chatWindowHidden');
		}
	}
	refreshMinimized();
}

function refreshMinimized() {
	if (chattingWith.length <= windowsToDisplay) {
		$('.minimized').css('display', 'none');
	} else {
		$('.minimizedToggle').text(chattingWith.length - windowsToDisplay);
		$('.minimized').css('display', 'block');
		var ul = $('.minimizedWindowList');
		ul.empty();
		for (var i = 0; i < chattingWith.length - windowsToDisplay; i++) {
			console.log('li');
			var friend = chattingWith[windowsToDisplay + i];
			ul.append(minimizedWindow(friend));
			bindCloseChatWindow(chattingWith, friend);
		}
		bindMinimizedWindow();
	}
}

function minimizedWindow(friend) {
	// var onlineClass = isOnline(friend) ? ' onlineFriendLi' : '';
	return (
//	  '<li class="minimizedWindowLi' /*+ onlineClass*/ + '" id="minimizedWindowLi-' +
//	  friend + '"><div class="minimizedWindow" id="minimizedWindowLi-' + friend +
//	  '" username="' + friend + '">' + getName(friend) +
//	  '</div>' + closeChatWindowButton(friend) +'</li>'

	  '<div class="minimizedWindowDiv' /*+ onlineClass*/ + '" id="minimizedWindowLi-' +
	  friend + '"><div class="minimizedWindow clickable" id="minimizedWindowLi-' + friend +
	  '" username="' + friend + '">' + getName(friend) +
	  '</div>' + closeChatWindowButton(friend) +'</li>'
	);
}

function bindMinimizedWindow() {
	$('.minimizedWindow').click(function() {
		openChatWindow($(this).attr('username'));
	});
}

function toggleMinimizedList() {
	var ul = $('.minimizedWindowList');
	ul.css('display', (ul.css('display') == 'block') ? 'none' : 'block');
	/*$('.minimizedToggleOff').addClass('minimizedToggleOn').removeClass('minimizedToggleOff');
	$('.minimizedToggleOn').addClass('minimizedToggleOff').removeClass('minimizedToggleOn');
	*/
}

function hideMinimizedList() {
	$('.minimizedWindowList').css('display', 'none');
}

function toInt(i) {
  return ~~(i);
}


// ============================ GROUP CHAT ==============================

function makeGroup(members) {
	// save the group to the DB
	socket.emit('makeGroup', { members : members });
}

function isGroupChat(entity) {
	console.log(friends);
	return groups.hasOwnProperty(entity);
}

function initAddToGroupInput(id) {
	initTagInput(id);
	bindTagInput(id);
	bindAddToGroupButton(id);
	bindToggleAddButton(id);
}

function bindAddToGroupButton(id) {
	$('#addToGroupButton-' + id).click(function() {
		var members = [];
		var data = $('#chatAddToGroupInput-' + id).tagsinput('items');
		for (var i = 0; i < data.length; i++) {
			members.push(data[i].username);
		}
		if (friendsArr.indexOf(id) != -1) {
			// it's a single-user chat now
			if (members.indexOf(id) == -1) members.push(id);
			if (members.length > 1) {
				console.log('making a group with: ' + members);
				makeGroup(members);
			}
		} else {
			// add the users to this group
		}
		$('#chatAddToGroupInput-' + id).tagsinput('removeAll');
		$('#chatAddToGroupInput-' + id).tagsinput('input').val('');
		$('#chatAddToGroup-' + id).hide();
	});
}

function bindTagInput(id) {
	$('#chatAddToGroup-' + id).find('.tt-input').bind('keydown', function(evt) {
		$('#chatAddPlaceholder-' + id).text('');
	});
	$('#chatAddToGroup-' + id).find('.tt-input').bind('keyup', function(evt) {
		setTimeout(function() {
			if ($('#chatAddToGroupInput-' + id).val() == '' && $('#chatAddToGroup-' + id).find('.tt-input').val() == '') {
				$('#chatAddPlaceholder-' + id).text('Enter names here...');
			}
		}, 50);
	});

	// clicking on the placeholder div makes the input focused
	$('#chatAddPlaceholder-' + id).click(function() {
		$('#chatAddToGroup-' + id).find('.tt-input').focus();
	});
}

function initTagInput(id) {
		$('#chatAddToGroupInput-' + id).tagsinput({
		itemValue: 'username',
		itemText: function(d) { return d.firstName + ' ' + d.lastName }
	});

	$('#chatAddToGroupInput-' + id).tagsinput('input').typeahead({
	  hint: true,
	  highlight: true,
	  minLength: 1
	},
	{
	  name: id,
	  displayKey: function(d) { return d.firstName + ' ' + d.lastName },
	  // `ttAdapter` wraps the suggestion engine in an adapter that
	  // is compatible with the typeahead jQuery plugin
	  source: friendsTypeaheadData().ttAdapter()
	}).bind('typeahead:selected', $.proxy(function (obj, datum) {
		this.tagsinput('add', datum);
		this.tagsinput('input').typeahead('val', '');
	}, $('#chatAddToGroupInput-' + id)));
}

function friendsTypeaheadData() {
	// constructs the suggestion engine
	var data = new Bloodhound({
	  datumTokenizer: function (d) { return Bloodhound.tokenizers.whitespace(d.firstName + ' ' + d.lastName) },
	  queryTokenizer: Bloodhound.tokenizers.whitespace,
	  local: friends
	});
	 
	// kicks off the loading/processing of `local` and `prefetch`
	data.initialize();

	return data;
}

function bindToggleAddButton(id) {
	$('#toggleAddButton-' + id).unbind();
	$('#toggleAddButton-' + id).click(function() {
		$('#chatAddToGroup-' + id).toggle();
		if ($('#chatAddToGroup-' + id).attr('display') != 'none') {
			setTimeout(function() {
				$('#chatAddToGroup-' + id).find('.tt-input').focus();
				console.log('focusing on the tt-input');
			}, 50);
		}
	});
}

function hideAddToGroup(id) {
	$('#chatAddToGroup-' + id).hide();
}

// ============================ MATHJAX AND PRISM ==============================

function codify(string) {
	while ((string.match(/##/g) || []).length >= 2) {
		string = string.replace('##', '<code class="language-javascript">');
		string = string.replace('##', '</code>');
	}
	return string;
}

function formatElem(elem, scroll) {
	Prism.highlightAll();

	var callback = (scroll ?
	            function() { scrollToBottom(elem.parent(), false); } :
	            function() {});
	runMathJax(elem, callback);
}

function runMathJax(elem, callback) {
	MathJax.Hub.Queue(["Typeset", MathJax.Hub, elem[0]], callback);
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


// ===================== FRIEND REQUESTS ==============================

function initFriendRequests() {
	for (var i = 0; i < friendRequests.length; i++) {
		$('.friendRequestsList').append(friendRequestsListItem(friendRequests[i]));
		bindFriendRequestItem(friendRequests[i]);
	}
	refreshFriendRequestsDiv();
}

function friendRequestsListItem(data) {
	return (
	  '<div class="friendRequestsListItem" id="friendRequestsListItem-' + data.username + '">' +
	  '<div class="friendRequestsListItemName">' + data.firstName + ' ' + data.lastName + '</div>' +
	  '<div class="friendRequestAccept clickable" id="friendRequestAccept-' + data.username + '">Y</div>' +
	  '<div class="friendRequestDecline clickable" id="friendRequestDecline-' + data.username + '">N</div>' +
	  '</div>'
	);
}

function bindFriendRequestItem(data) {
	bindAcceptOrDeclineFriendRequest('accept', data);
	bindAcceptOrDeclineFriendRequest('decline', data);
}

function bindAcceptOrDeclineFriendRequest(val, data) {
	var id = data.username;
	$('#friendRequest' + capitalizeFirstLetter(val) + '-' + id).click(function() {
		socket.emit(val + 'FriendRequest', { from : id });
		$('#friendRequestsListItem-' + id).remove();

		// remove from the friendRequests array
		friendRequests.splice(friendRequests.indexOf(data), 1);

		refreshFriendRequestsDiv();
	});
}

function refreshFriendRequestsDiv() {
	if (friendRequests.length) {
		$('.friendRequests').css('display', 'block');
	} else {
		$('.friendRequests').css('display', 'none');
	}
	resizeChatContentWrapper();
}

function addFriend(friend, socket) {
	if (pending.indexOf(friend.username) == -1) {
		pending.push(friend.username);
		$('.friendListUl').append(pendingFriendListItem(friend.username));
		socket.emit('sendFriendRequest', { friend : friend.username });
		$('#searchResult').html('');
		$('#searchBar').val('');
	}
}

function receiveFriendRequest(friend) {
	// friend : {username, fn, ln}
	$('.friendRequestsList').append(friendRequestsListItem(friend));
	bindFriendRequestItem(friend);
	friendRequests.push(friend);
	refreshFriendRequestsDiv();
}

function capitalizeFirstLetter(string){
  return string.charAt(0).toUpperCase() + string.slice(1);
}


