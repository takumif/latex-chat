$(function() {
	var chattingWith = [];

	var socket = io.connect('http://localhost:8080');

	socket.on('initFriends', function(data) {
		if (data.friends) {
			console.log('data received');
			$('.friendList').append('<ul>');
			for (var i = 0; i < data.friends.length; i++) {
				$('.friendList').append('<li class="friendLi" id="friendLi-' + data.friends[i].username + '">' + data.friends[i].username);
			}
			$('.friendList').append('</ul>');

			$('.friendLi').click(function() { // open chat window with the friend
				var friend = $(this).attr('id').slice(9);
				if (chattingWith.indexOf(friend) == -1) { // if not already chatting
					$('.chats').append(chatWindow(friend));
					socket.emit('talkTo', {
						friend : friend
					});
					bindChatInput(friend, socket);
					bindCloseChatWindow(chattingWith ,friend);
					chattingWith.push(friend);
				}
			});
		}
	});

	socket.on('receiveMessage', function(data) {

	});
});

function jqueryBind(socket) {
	$('#input').bind('keypress', function(e) {
		var code = e.keyCode || e.which;
		if (code == 13) {
			socket.emit('send', {message : $('#input').val()})
			$('#input').val('');
		}
	});	
}

function bindChatInput(friend, socket) {
	$('#chatInput-' + friend).bind('keypress', function(evt) {
		var code = evt.keyCode || evt.which;
		if (code == 13) {
			socket.emit('sendMessage', {
				content : $(this).val(),
				friend : friend,
				time : new Date()
			});
			$(this).val('');
		}
	});
}

function bindCloseChatWindow(chattingWith, friend) {
	$('#closeChatWindow-' + friend).click(function(evt){
		$(this).closest('.chatWindow').remove();
		chattingWith.splice(chattingWith.indexOf(friend), 1);
		evt.preventDefault(); 
	});
}

function chatWindow(friend) {
	return ('<div class="chatWindow" id="chatWindow-' + friend + '">' +
	        '<div class="chatHeader">' + friend +
	        '<a href="" class="closeChatWindow" id="closeChatWindow-' + friend +
	        '">x</a></div>' +
	        '<div class="chatContent" id="chatContent-' + friend + '"></div>' +
	        '<input type="text" class="chatInput" id="chatInput-' + friend +
	  			'" /></div>');
}