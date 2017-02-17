const express = require('express');
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const cookieSession = require('cookie-session');

const server = express();
const PORT = process.env.PORT || 3000;

server.set("view engine", "ejs");

// Middlewares
server.use(express.static('public'));
server.use(bodyParser.urlencoded({ extended: true }));
server.use(cookieParser());
server.use(morgan('dev'));
server.use(cookieSession({
  name: 'session',
  keys: [process.env.SECRET_KEY || 'developer']
}))

// Databases
const urlDatabase = {
  'b2xVn2': { longURL: 'http://www.lighthouselabs.ca', userID: 'lhl' }
};
const users = {};

// Helper functions
function generateRandomString() {
  let chars = 'abcdefghijklmnopqrstufwxyzABCDEFGHIJKLMNOPQRSTUFWXYZ1234567890';
  let str = '';
  for (let x = 0; x < 6; x++) {
    let letter = Math.ceil(Math.random() * chars.length - 1);
    str += chars[letter];
  }
  return str;
}

function toHTTP(str) {
  if(str) {
    let output = '';
    let scheme = 'http://';
    if(!str.includes(scheme)) {
      output = scheme + str;
    }
    return output;
  }
}

function isLoggedIn(req) {
  // must use for...in instead of Object.keys().forEach() because
  // forEach is impervious against breaking loop before completion
  if(req.session.user_id) {
    for(let u in users) {
      if(users[u]['id'] === req.session.user_id) {
        return true;
      }
    }
  }
  return false;
}

function urlsForUser(id) {
  let userUrls = []
  Object.keys(urlDatabase).forEach((u, i) => {
    if(urlDatabase[u].userID === id) {
      userUrls.push( { urlID: u, url: urlDatabase[u].longURL } );
    }
  })
  return userUrls;
}


////////////////////
// TinyApp Routes //
////////////////////



// root route

server.get('/', (req, res) => {
  if(isLoggedIn(req)) {
    res.redirect('/urls');
  }
  res.redirect('/login');
});



// urls route

server.get('/urls', (req, res) => {
  let templateVars = {
    urls: urlDatabase,
    users: users,
    user: req.session.user_id,
    loggedIn: false
  };
  if(isLoggedIn(req)) {
    templateVars['loggedIn'] = true;
    templateVars['userUrls'] = urlsForUser(req.session.user_id);
  } else {
    res.status(401);
  }
  res.render('urls_index', templateVars);
});

// post received from /urls/new

server.post('/urls', (req, res) => {
  // if shortURL alreadys exists in database, generate another
  // until shortURL's value cannot be found in urlDatabase
  let str = generateRandomString();
  if (urlDatabase[str]) {
    while (urlDatabase[str]) {
      str = generateRandomString();
    }
  }

  let longURL = toHTTP(req.body['longURL']);
  let userID = req.session.user_id;
  urlDatabase[str] = {
    longURL: longURL,
    userID: userID
  }
  res.redirect('/urls/' + str);
});



/**
 *  /register route
 */

server.get('/register', (req, res) => {
  res.render('urls_register');
});

server.post('/register', (req, res) => {
  if(!req.body['email'] || !req.body['password']) {
    res.send(400, 'Error: Email address and/or password were empty');
  }
  Object.keys(users).forEach(id => {
    if(users[id]['email'] === req.body['email']) {
      res.send(400, 'Error: Email address already in use');
    }
  });
  // Verifies new user_id isn't already in users DB
  let userID = generateRandomString();
  if(users[userID]) {
    while(users[userID]) {
      users[userID] = generateRandomString();
    }
  } else {
    users[userID] = userID;
  }
  const email = req.body['email'];
  const password = bcrypt.hashSync(req.body['password'], 10);
  users[userID] = {
    id: userID,
    email: email,
    password: password
  };
  req.session.user_id = userID;
  res.redirect('/urls');
});



// login routes

server.get('/login', (req, res) => {
  res.render('urls_login');
});

server.post('/login', (req, res) => {
  // Checks against DB to verify user credentials
  Object.keys(users).forEach(id => {
    if(users[id]['email'] === req.body['email']) {
      if(bcrypt.compareSync(req.body['password'], users[id]['password'])) {
        req.session.user_id = users[id]['id'];
        res.redirect('/urls');
        return;
      }
    }
  });
  res.send(403, 'Error: Login credentials cannot be found in database');
});



// logout route

server.post('/logout', (req, res) => {
  delete req.session.user_id;
  res.redirect('/urls');
});



// new shortURL route

server.get('/urls/new', (req, res) => {
  if(!isLoggedIn(req)) {
    res.status(401)
    res.redirect('/urls');
    return;
  }
  let templateVars = { users: users, user: req.session.user_id };
  res.render('urls_new', templateVars);
});



// :shortURL routes

server.post('/urls/:id', (req, res) => {
  let user_id = req.session.user_id;
  if(urlDatabase[req.params.id]['userID'] === user_id) {
    let updatedURL = toHTTP(req.body['updatedURL']);
    urlDatabase[req.params.id]['longURL'] = updatedURL;
    res.redirect('/urls/' + req.params.id);
  }
  res.send(400, 'Not authorized to modify link');
});

server.get('/urls/:id', (req, res) => {
  let templateVars = {
  shortURL: req.params.id,
  urls: urlDatabase,
  users: users,
  user: req.session.user_id,
  errors: {}
  };
  if(!urlDatabase.hasOwnProperty(req.params.id)) {
    templateVars.errors.urlExists = false;
    res.status(404).render('urls_show', templateVars);
    return;
  } else if(!isLoggedIn(req)) {
      templateVars.errors.loggedIn = false;
      res.status(401).render('urls_show', templateVars);
      return;
  } else if(urlDatabase[req.params.id].userID !== req.session.user_id) {
      templateVars.errors.owner = false;
      res.status(403).render('urls_show', templateVars);
      return;
  }
  res.render('urls_show', templateVars);
});


// remote :longURL route

server.get('/u/:shortURL', (req, res) => {
  let shortURL = req.params.shortURL;
  if(!urlDatabase[shortURL]) {
    res.redirect(404, '/urls');
  }
  let longURL = urlDatabase[shortURL].longURL;
  res.redirect(longURL);
});



// delete shortURL route

server.post('/urls/:id/delete', (req, res) => {
  if(isLoggedIn(req)) {
    let userID = req.session.user_id;
    let urlID = req.params.id;
    console.log(urlID, urlDatabase[urlID]);
    if(urlDatabase[urlID]['userID'] === userID) {
      delete urlDatabase[urlID];
      res.redirect('/urls');
    }
  }
  res.send(401, 'Error: Not authorized to delete link');
});



server.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});