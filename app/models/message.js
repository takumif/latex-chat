// app/models/user.js
// load the things we need
var mongoose = require('mongoose');

// define the schema for our user model
var messageSchema = mongoose.Schema({
	from    : String,
	to      : String,
	content : String,
	time    : Date,
  seen    : Date
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Message', messageSchema);
