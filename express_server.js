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
const templateVars = {
  urls: urlDatabase,
  users: users,
  user: '',
  error: ''
}


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
  templateVars.user = req.session.user_id;
  if(isLoggedIn(req)) {
    templateVars.loggedIn = true;
    templateVars['userUrls'] = urlsForUser(req.session.user_id);
    res.render('urls_index', templateVars);
    return;
  } else {
    templateVars.error = 'Error: You must be logged in to access this page'
    res.status(401).render('urls_index', templateVars);
    templateVars.error = false;
    return;
  }
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


// register route

server.get('/register', (req, res) => {
  if(isLoggedIn(req)) {
    res.redirect('/');
    return;
  }
  res.render('urls_register');
});

server.post('/register', (req, res) => {
  if(!req.body['email'] || !req.body['password']) {
    templateVars.error = 'Error: Email address and/or password were empty';
    res.status(400).render('urls_index', templateVars );
    templateVars.error = false;
    return;
  }
  Object.keys(users).forEach(id => {
    if(users[id]['email'] === req.body['email']) {
      templateVars.error = 'Error: Email address already in use';
      res.status(400).render('urls_index', templateVars );
      templateVars.error = false;
      return;
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
  if(isLoggedIn(req)) {
    res.redirect('/');
    return;
  }
  res.render('urls_login');
});

server.post('/login', (req, res) => {
  if(!req.body['email'] || !req.body['password']) {
    templateVars.error = 'Error: Email address and/or password were empty'
    res.status(400).render('urls_index', templateVars);
    templateVars.error = false;
    return;
  }
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
  templateVars.error = 'Error: Login credentials do not match any in database';
  res.status(401).render('urls', templateVars );
  templateVars.error = false;
  return;
});


// logout route

server.post('/logout', (req, res) => {
  delete req.session.user_id;
  res.redirect('/urls');
});


// new shortURL route

server.get('/urls/new', (req, res) => {
  templateVars.user = req.session.user_id;
  if(!isLoggedIn(req)) {
    templateVars.error = 'Error: You must be logged in to access this page';
    res.status(401).render('urls_show', templateVars);
    templateVars.error = false;
    return;
  }
  res.render('urls_new', templateVars);
});


// :shortURL routes

server.post('/urls/:id', (req, res) => {
  if(!urlDatabase.hasOwnProperty(req.params.id)) {
    templateVars.error = 'Error: This short URL does not yet exist';
    res.status(404).render('urls_show', templateVars);
    templateVars.error = false;
    return;
  } else if(!isLoggedIn(req)) {
      templateVars.error = 'Error: You must be logged into access this page';
      res.status(401).render('urls_show', templateVars);
      templateVars.error = false;
      return;
  } else if(urlDatabase[req.params.id].userID !== req.session.user_id) {
      templateVars.error = 'Error: You do not have sufficient credentials to access this short URL';
      res.status(403).render('urls_show', templateVars);
      templateVars.error = false;
      return;
  }
  if(urlDatabase[req.params.id]['userID'] === req.session.user_id) {
    let updatedURL = toHTTP(req.body['updatedURL']);
    urlDatabase[req.params.id]['longURL'] = updatedURL;
    res.redirect('/urls/' + req.params.id);
    return;
  }
});

server.get('/urls/:id', (req, res) => {
  templateVars.shortURL = req.params.id;
  templateVars.user = req.session.user_id;
  if(!urlDatabase.hasOwnProperty(req.params.id)) {
    templateVars.error = 'Error: This short URL does not exist';
    res.status(404).render('urls_show', templateVars);
    templateVars.error = false;
    return;
  } else if(!isLoggedIn(req)) {
      templateVars.error = 'Error: You must be logged into access this page';
      res.status(401).render('urls_show', templateVars);
      templateVars.error = false;
      return;
  } else if(urlDatabase[req.params.id].userID !== req.session.user_id) {
      templateVars.error = 'Error: You do not have sufficient credentials to access this short URL';
      res.status(403).render('urls_show', templateVars);
      templateVars.error = false;
      return;
  }
  console.log(templateVars);
  res.render('urls_show', templateVars);
});


// redirects to remote :longURL route

server.get('/u/:shortURL', (req, res) => {
  let shortURL = req.params.shortURL;
  if(urlDatabase[shortURL]) {
    let longURL = urlDatabase[shortURL].longURL;
    res.redirect(longURL);
    return;
  }
  templateVars.error = 'Error: This short URL has not yet been created'
  res.status(404).render('urls_index', templateVars);
  templateVars.error = false;
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