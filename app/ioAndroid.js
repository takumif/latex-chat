var User = require('./models/user');

module.exports = function(io, socket, callback) {

  socket.on('authenticateAndroidUser', function(data) {
    console.log('authenticateAndroidUser: ' + data.email);
    if (data.email && data.password) {
      User.findOne({ 'email' : data.email }, function(err, user) {

        if (user && user.validPassword(data.password)) {
          setUser(socket, user);
          callback();

          socket.emit('authenticatedUser', {
            validLogin : true,
            username   : user.username,
            firstname  : user.firstName,
            lastname   : user.lastName,
            token : user.getAndroidToken(user)
          });
        } else {
          socket.emit('authenticatedUser', {
            validLogin : false
          });
        }
      });
    }
  }); // end socket.on('authenticateAndroidUser')

  socket.on('foo', function(data) {
    console.log(data.bar);
    socket.emit('sushi', { sushi : "SUSHI DESUYO"});
  });
}

function setUser(socket, user) {
  socket.request.user = user;
}