var passportSocketIo = require('passport.socketio');

module.exports = function(io, cookieParser, sessionStore, sessionSecret) {

  // configure passport.socketio =======================

  io.use(passportSocketIo.authorize({
    cookieParser: cookieParser,
    secret:      sessionSecret,    // the session_secret to parse the cookie
    store:       sessionStore,        // we NEED to use a sessionstore. no memorystore please
    success:     onAuthorizeSuccess,  // *optional* callback on success - read more below
    fail:        onAuthorizeFail,     // *optional* callback on fail/error - read more below
  }));

  function onAuthorizeSuccess(data, accept){
    console.log('successful connection to socket.io');

    // The accept-callback still allows us to decide whether to
    // accept the connection or not.
    accept(null, true);
  }

  function onAuthorizeFail(data, message, error, accept){
    if(error)
      throw new Error(message);
    console.log('failed connection to socket.io:', message);

    // We use this callback to log all of our failed connections.
    accept(null, false);
  }
}