const express = require('express');
const bodyParser = require("body-parser");
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const cookieSession = require('cookie-session');

const server = express();
const PORT = process.env.PORT || 3000;

server.set("view engine", "ejs");


// Middlewares
server.use(express.static('public'));
server.use(bodyParser.urlencoded({ extended: true }));
server.use(morgan('dev'));
server.use(cookieSession({
  name: 'session',
  keys: [process.env.SECRET_KEY || 'developer']
}));


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
};


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
    let output = str;
    let scheme = 'http://';
    if(!str.includes(scheme)) {
      output = scheme + str;
    }
    return output;
  }
}

function isLoggedIn(req) {
  // must use for...in instead of Object.keys().forEach() because
  // forEach is impervious* against breaking loop before completion
  // *???
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
  let userUrls = [];
  Object.keys(urlDatabase).forEach((u, i) => {
    if(urlDatabase[u].userID === id) {
      userUrls.push( { urlID: u,
        url: urlDatabase[u].longURL,
        date: urlDatabase[u].date,
        visits: urlDatabase[u].visits
      });
    }
  });
  return userUrls;
}

function sendError(status, res, error) {
  templateVars.error = error;
  res.status(status).render('urls_index', templateVars);
  templateVars.error = false;
  return;
}


/**
 *  TinyApp Routes
 */



// root route

server.get('/', (req, res) => {
  if(isLoggedIn(req)) {
    res.redirect('/urls');
    return;
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
  }
  sendError(401, res, 'Error: You must be logged in to access this page');
});


// post received from /urls/new

server.post('/urls', (req, res) => {
  if(isLoggedIn(req)) {
    console.log(req.body);
    // if shortURL alreadys exists in database, generate another
    // until shortURL's value cannot be found in urlDatabase
    if(!req.body['longURL']) {
      sendError(400, res, 'Error: Please specify a URL to shorten');
      return;
    }
    let str = '';
    if(!req.body['custom']) {
      str = generateRandomString();
      if (urlDatabase[str]) {
        while (urlDatabase[str]) {
          str = generateRandomString();
        }
      }
    } else {
      str = req.body['custom'];
    }
    let longURL = toHTTP(req.body['longURL']);
    let userID = req.session.user_id;

    // Grabs date in dd/mm/yyyy format
    let d = new Date();
    let today = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();

    let visits = {
      visits: 0,
      unique: 0,
      ipAddr: []
    };
    console.log(visits);
    urlDatabase[str] = {
      longURL: longURL,
      userID: userID,
      date: today,
      visits: visits
    };
    res.redirect('/urls/' + str);
    return;
  }
  sendError(401, res, 'Error: You must be logged in to access this page');
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
    sendError(400, res, 'Error: Email address and/or password were empty');
    return;
  }
  Object.keys(users).forEach(id => {
    if(users[id]['email'] === req.body['email']) {
      sendError(400, res, 'Error: Email address already in use');
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
    sendError(400, res, 'Error: Email address and/or password were empty');
    return;
  }
  for(id in users) {
    if(users[id]['email'] === req.body['email']) {
      if(bcrypt.compareSync(req.body['password'], users[id]['password'])) {
        req.session.user_id = users[id]['id'];
        res.redirect('/urls');
        return;
      }
    }
  }
  sendError(401, res, 'Error: Login credentials do not match any in database');
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
    sendError(401, res, 'Error: You must be logged in to access this page');
    return;
  }
  res.render('urls_new', templateVars);
});


// :shortURL routes

server.post('/urls/:id', (req, res) => {
  if(!urlDatabase.hasOwnProperty(req.params.id)) {
    sendError(404, res, 'Error: This short URL does not yet exist');
    return;
  } else if(!isLoggedIn(req)) {
    sendError(401, res, 'Error: You must be logged in to access this page');
    return;
  } else if(urlDatabase[req.params.id].userID !== req.session.user_id) {
    sendError(403, res, 'Error: You do not have sufficient credentials to access this short URL');
    return;
  }
  if(req.body['updatedURL']) {
    let updatedURL = toHTTP(req.body['updatedURL']);
    urlDatabase[req.params.id]['longURL'] = updatedURL;
    res.redirect('/urls/' + req.params.id);
  } else {
    sendError(400, res, 'Error: Please specify a URL to be updated');
    return;
  }
});

server.get('/urls/:id', (req, res) => {
  templateVars.url = req.params.id;
  if(!urlDatabase.hasOwnProperty(req.params.id)) {
    sendError(404, res, 'Error: This short URL does not yet exist');
    return;
  } else if(!isLoggedIn(req)) {
    sendError(401, res, 'Error: You must be logged in to access this page');
    return;
  } else if(urlDatabase[req.params.id].userID !== req.session.user_id) {
    sendError(403, res, 'Error: You do not have sufficient credentials to access this short URL');
    return;
  }
  res.render('urls_show', templateVars);
});


// redirects to remote :longURL route

server.get('/u/:shortURL', (req, res) => {
  let shortURL = req.params.shortURL;
  if(urlDatabase[shortURL]) {
    if(urlDatabase[shortURL].visits.ipAddr.length === 0) {
      urlDatabase[shortURL].visits.ipAddr.push(req.connection.remoteAddress);
      urlDatabase[shortURL].visits.unique++;
    } else {
      urlDatabase[shortURL].visits.ipAddr.forEach(ip => {
        if(req.connection.remoteAddress !== ip) {
          urlDatabase[shortURL].visits.ipAddr.push(req.connection.remoteAddress);
          urlDatabase[shortURL].visits.unique++;
        }
      });
    }
    urlDatabase[shortURL].visits.visits++;
    let longURL = urlDatabase[shortURL].longURL;
    res.redirect(longURL);
    return;
  }
  sendError(404, res, 'Error: This short URL does not yet exist');
});

// delete shortURL route

server.post('/urls/:id/delete', (req, res) => {
  if(isLoggedIn(req)) {
    let userID = req.session.user_id;
    let urlID = req.params.id;
    if(urlDatabase[urlID]['userID'] === userID) {
      delete urlDatabase[urlID];
      res.redirect('/urls');
      return;
    }
  }
  sendError(400, res, 'Error: Not authorized to delete link');
});



server.listen(PORT, () => {
  console.log(`TinyApp listening on :${PORT}!`);
});