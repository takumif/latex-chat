$(function() {
  $(window).resize(function(evt) {
    resizeChatContentWrapper();
  })
});

function resizeChatContentWrapper() {
  $('.chatContentWrapper').height($(window).height() - 170);
}

