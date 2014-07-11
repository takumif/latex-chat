$(function() {
  $(window).resize(function(evt) {
    resizeChatContentWrapper();
    organizeChatWindows();
  })
});

function resizeChatContentWrapper() {
  $('.chatContentWrapper').height($(window).height() - 180);
  $('.friendList').height($('.sidebar').height() - 85);
  /*
  if (friendRequests.length) {
    var requestsHeight = $('.friendRequests').height(); // get the height
    $('.friendList').height($('.sidebar').height() - 85 - requestsHeight);
  } else {
    $('.friendList').height($('.sidebar').height() - 85);
  }
  */
}

