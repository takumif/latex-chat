// app/routes.js
module.exports = function(app, passport) {

	// =====================================
	// HOME PAGE (with login links) ========
	// =====================================
	app.get('/', function(req, res) {
		if (req.isAuthenticated()) {
			user = req.user; // wonder if this works
			res.render('chat.ejs', {
				user : req.user
			});
		} else {
			res.render('index.ejs'); // load the index.ejs file
		}
	});

	// buffer necessary for req.isAuthenticated() to work properly
	app.get('/redirect', function(req, res) {
		res.redirect('/');
	});

	// =====================================
	// LOGIN ===============================
	// =====================================
	// show the login form
	app.get('/login', function(req, res) {
		if (req.isAuthenticated()) {
			res.redirect('/');
		} else {
			// render the page and pass in any flash data if it exists
			res.render('login.ejs', { message: req.flash('loginMessage') });
		}
	});

	// process the login form
	app.post('/login', passport.authenticate('local-login', {
		successRedirect : '/redirect', // redirect to the secure profile section
		failureRedirect : '/login', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

	// =====================================
	// SIGNUP ==============================
	// =====================================
	// show the signup form
	app.get('/signup', function(req, res) {
		if (req.isAuthenticated()) {
			res.redirect('/');
		} else {
			// render the page and pass in any flash data if it exists
			res.render('signup.ejs', { message: req.flash('signupMessage') });
		}
	});

	// process the signup form
	app.post('/signup', passport.authenticate('local-signup', {
		successRedirect : '/redirect',
		failureRedirect : '/signup', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

	// =====================================
	// LOGOUT ==============================
	// =====================================
	app.get('/logout', function(req, res) {
		req.session.destroy(function (err) {
			res.redirect('/');
		});
	});
};

// route middleware to make sure
function isLoggedIn(req, res, next) {

	// if user is authenticated in the session, carry on
	if (req.isAuthenticated())
		return next();

	// if they aren't redirect them to the home page
	res.redirect('/');
}
