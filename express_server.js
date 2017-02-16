const express = require('express');
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const bcrypt = require('bcrypt');

const server = express();
const PORT = process.env.PORT || 8080;

server.set("view engine", "ejs");


// Middlewares
server.use(express.static('public'));
server.use(bodyParser.urlencoded({ extended: true }));
server.use(cookieParser());
server.use(morgan('dev'));


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
  if(req.cookies.user_id) {
    for(let u in users) {
      if(users[u]['id'] === req.cookies.user_id) {
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



// urls route

server.get('/urls', (request, response) => {
  let templateVars = {
    urls: urlDatabase,
    users: users,
    user: request.cookies.user_id,
    loggedIn: false
  };
  if(isLoggedIn(request)) {
    templateVars['loggedIn'] = true;
    templateVars['userUrls'] = urlsForUser(request.cookies.user_id);
    console.log(templateVars);
  }
  response.render('urls_index', templateVars);
});

// post received from /urls/new

server.post('/urls', (request, response) => {
  // if shortURL alreadys exists in database, generate another
  // until shortURL's value cannot be found in urlDatabase
  let str = generateRandomString();
  if (urlDatabase[str]) {
    while (urlDatabase[str]) {
      str = generateRandomString();
    }
  }

  let longURL = toHTTP(request.body['longURL']);
  let userID = request.cookies.user_id;
  urlDatabase[str] = {
    longURL: longURL,
    userID: userID
  }
  response.redirect('/urls/' + str);
});



// register routes

server.get('/register', (request, response) => {
  response.render('urls_register');
});

server.post('/register', (request, response) => {
  if(!request.body['email'] || !request.body['password']) {
    response.send(400, 'Error: Email address and/or password were empty');
  }
  Object.keys(users).forEach(id => {
    if(users[id]['email'] === request.body['email']) {
      response.send(400, 'Error: Email address already in use');
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
  const email = request.body['email'];
  const password = bcrypt.hashSync(request.body['password'], 10);
  users[userID] = {
    id: userID,
    email: email,
    password: password
  };
  response.cookie('user_id', userID);
  response.redirect('/urls');
});



// login routes

server.get('/login', (request, response) => {
  response.render('urls_login');
});

server.post('/login', (request, response) => {
  // Checks against DB to verify user credentials
  Object.keys(users).forEach(id => {
    console.log(users[id]['email']);
    if(users[id]['email'] === request.body['email']) {
      if(bcrypt.compareSync(request.body['password'], users[id]['password'])) {
        response.cookie('user_id', users[id]['id']);
        response.redirect('/urls');
        return;
      }
    }
  });
  response.send(403, 'Error: Login credentials cannot be found in database');
});



// logout route

server.post('/logout', (request, response) => {
  response.clearCookie('user_id');
  response.redirect('/urls');
});



// new shortURL route

server.get('/urls/new', (request, response) => {
  if(!request.cookies['user_id']) {
    response.redirect('/login');
  }
  console.log(request.cookies['user_id']);
  let templateVars = { users: users, user: request.cookies['user_id'] };
  response.render('urls_new', templateVars);
});



// :shortURL routes

server.post('/urls/:id', (request, response) => {
  let user_id = request.cookies.user_id;
  if(urlDatabase[request.params.id]['userID'] === user_id) {
    let updatedURL = toHTTP(request.body['updatedURL']);
    urlDatabase[request.params.id]['longURL'] = updatedURL;
    response.redirect('/urls/' + request.params.id);
  }
  response.send(400, 'Not authorized to modify link');
});

server.get('/urls/:id', (request, response) => {
  let templateVars = {
    shortURL: request.params.id,
    urls: urlDatabase,
    users: users,
    user: request.cookies['user_id']
  };
  response.render('urls_show', templateVars);
});


// remote :longURL route

server.get('/u/:shortURL', (request, response) => {
  let shortURL = request.params.shortURL;
  if(!urlDatabase[shortURL]) {
    response.redirect(404, '/urls');
  }
  let longURL = urlDatabase[shortURL].longURL;
  response.redirect(longURL);
});



// delete shortURL route

server.post('/urls/:id/delete', (request, response) => {
  if(isLoggedIn(request)) {
    let userID = request.cookies.user_id;
    let urlID = request.params.id;
    if(urlDatabase[urlID]['userID'] === userID) {
      delete urlDatabase[urlID];
      response.redirect('/urls');
      return;
    }
  }
  response.send(401, 'Error: Not authorized to delete link');
});



server.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});