$(function() {
	chattingWith = [];
	onlineFriends = [];
	friends = []; // [ { username: '', firstName: '', lastName: ''}, ... ]
	pending = [];
	sentMsgs = {};
	groups = {};

	socket = io.connect('http://localhost:8080');

	documentInit();

	socket.on('initFriends', function(data) {
		if (data.onlineFriends) {
			onlineFriends = data.onlineFriends;
		}
		if (data.friends) {
			friends = data.friends;

			for (var i = 0; i < friends.length; i++) {
			  sentMsgs[friends[i].username] = { 'msgs': [''], 'index': 0 };
			}
			
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
					openNewChatWindow(friend, socket, chattingWith, onlineFriends, friends);
				} else {
					openChatWindow(friend);
				}
			});
		}
		
		if (data.chattingWith) {
			chattingWith = data.chattingWith;
			for (var i = 0; i < chattingWith.length; i++) {
				createChatWindow(chattingWith[i], socket, chattingWith, onlineFriends, friends);
			}
			refreshChatHidden();
		}

		if (data.groups) {
			groups = data.groups;
		}
	});

	socket.on('receiveMessage', function(data) {
		if (chattingWith.indexOf(data.chat) > -1) { // chat window already open
			$('#chatContent-' + data.chat).append(chatMessage(data.from, data.time, data.content, friends));
		} else { // chat window not open, so open it
			openNewChatWindow(data.chat, socket, chattingWith, onlineFriends, friends);
		}
		highlightChatWindow(data.chat);
		formatElem($('#chatContent-' + data.chat));
	});

	// receiving messages to populate the newly-opened chat window with
	socket.on('receiveRecentMessages', function(data) {
		if (chattingWith.indexOf(data.from) > -1) {
			var chatContent = $('#chatContent-' + data.from);
			for (var i = 0; i < data.messages.length; i++) {
				chatContent.prepend(chatMessage(data.messages[i].from, data.messages[i].time, data.messages[i].content, friends));
			}
			formatElem($('#chatContent-' + data.from));
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
		
	});
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
				hideMinimizedList();
			}
		}
	});

	organizeChatWindows();

	searchInit(socket);
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
	}
}

function bindChatWindow(friend) {
	$('#chatWindow-' + friend).click(function() {
		selectChatWindow(friend);
	});
	bindChatInputButtons(friend);
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
	$('#chatInput-' + friend).val(null);
	$('#chatContent-' + friend).append(chatMessage(user, time, content, friends));
	formatElem($('#chatContent-' + friend));

	// add the input to the list of sent messages
	var msgs = sentMsgs[friend].msgs;
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
	var onlineClass = online ? ' onlineFriendLi' : '';
	return (
	  '<li class="friendLi' + onlineClass + '" id="friendLi-' + friend.username + '">' + 
	  friend.firstName + ' ' + friend.lastName + '</li>'
	);
}

function chatWindow(friend, friends) {
	var name = getName(friend);
	var code = '<div class="chatWindow" id="chatWindow-' + friend + '">' +
    '<div class="chatHeader" id="chatHeader-' + friend + '">' + name +
    closeChatWindowButton(friend) + '</div>' +
    '<div class="chatContentWrapper" id="chatContentWrapper-' + friend + '">' +
    '<div class="chatContent" id="chatContent-' + friend + '"></div></div>' +
    '<div class="chatInputDiv">' +
    '<textarea cols="39" rows="4" class="chatInput" id="chatInput-' + friend +
		'" placeholder="Message..."/></div>' + chatInputButtons(friend) + '</div>';

	return code;
}

function chatInputButtons(friend) {
	var code = '<div class="chatButtonsDiv">' +
		'<span class="chatLatexButton" id="chatLatexButton-' + friend + '">Insert $\LaTeX$</span>' +
		'<span class="chatCodeButton" id="chatCodeButton-' + friend + '">Insert <code>code</code></span>' +
		'<span class="chatPrevButton" id="chatPrevButton-' + friend + '">Prev</span>' +
		'<span class="chatNextButton" id="chatNextButton-' + friend + '">Next</span>' +
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
	return ('<div class="closeChatWindow closeChatWindow-' +
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
	return (
	  '<div class="chatMessage">' + 
	  '<div class="chatMessageSender">' + name + '</div>' +
	  '<div class="chatMessageTime">' + formatTime(time) + '</div>' +
	  '<div class="chatMessageContent">' + codify(Autolinker.link(escapeHtml(content))) + '</div>' +
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

function getName(username) {
	var f = friends.filter(function(obj) { return obj.username == username })[0];
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
	var onlineClass = isOnline(friend) ? ' onlineFriendLi' : '';
	return (
	  '<li class="minimizedWindowLi' + onlineClass + '" id="minimizedWindowLi-' +
	  friend + '"><span class="minimizedWindow" id="minimizedWindowLi-' + friend +
	  '" username="' + friend + '">' + getName(friend) +
	  '</span>' + closeChatWindowButton(friend) +'</li>'
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


// ============================ MATHJAX AND PRISM ==============================

function codify(string) {
	while ((string.match(/##/g) || []).length >= 2) {
		string = string.replace('##', '<code class="language-javascript">');
		string = string.replace('##', '</code>');
	}
	return string;
}

function formatElem(elem) {
	Prism.highlightAll();
	runMathJax(elem);
}

function runMathJax(elem) {
	MathJax.Hub.Queue(["Typeset", MathJax.Hub, elem[0]], function() {
		scrollToBottom(elem.parent(), false);
	});
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

function receiveFriendRequest(friend) {
	var li = friendListItem(friend, false);
	li = li.replace('class="', 'class="pendingRequestFriendLi ');
	$('.friendListUl').append(li);
}



