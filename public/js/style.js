$(function() {
  $(window).resize(function(evt) {
    resizeChatContentWrapper();
    organizeChatWindows();
  })
});

function resizeChatContentWrapper() {
  $('.chatContentWrapper').height($(window).height() - 205);
  $('.friendList').height($('.sidebar').height() - 85);
}

