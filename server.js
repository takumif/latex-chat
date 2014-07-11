// server.js

// set up ======================================================================
// get all the tools we need
var express  = require('express');
var app      = express();
var ip       = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var port     = process.env.OPENSHIFT_NODEJS_PORT || 8080;
var mongoose = require('mongoose');
var passport = require('passport');
var flash    = require('connect-flash');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');

var configDB = require('./config/database');
var sessionSecret = require('./config/secret').sessionSecret;
var mongoStore = require('./config/mongoStore')(session, sessionSecret);

// configuration ===============================================================
mongoose.connect(configDB.url); // connect to our database

require('./config/passport')(passport); // pass passport for configuration

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser()); // get information from html forms
app.use(express.static(__dirname + '/public'));

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({ store: mongoStore, secret: sessionSecret })); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session


// routes ======================================================================
require('./app/routes')(app, passport); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
var io = require('socket.io').listen(app.listen(port, ip));

// config socket.io
require('./config/passportSocketIo')(io, cookieParser, mongoStore, sessionSecret);
require('./app/io')(io);

console.log('The server is running on port ' + port);
