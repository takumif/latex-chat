var mongoose = require('mongoose');

var groupSchema = mongoose.Schema({
  idString: String,
  members: [String],
  name: String
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Group', groupSchema);
