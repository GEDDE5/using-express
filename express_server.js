const express = require('express');
server = express();
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8080;
const randomStr = require('./make-shorturl');

server.use(express.static('public'));
server.use(bodyParser.urlencoded({ extended: true }));
server.set("view engine", "ejs");

const urlDatabase = {
  "b2xVn2": "http://www.lighthouselabs.ca",
  "9sm5xK": "http://www.google.com"
};

server.get('/urls', (request, response) => {
  response.render('urls_index', { urls: urlDatabase });
});

server.post('/urls', (request, response) => {
  // if shortURL alreadys exists in database, generate one
  // until shortURL's value cannot be found in urlDatabase
  let str = randomStr.get();
  if (urlDatabase[str]) {
    while (urlDatabase[str]) {
      str = randomStr.get();
    }
  }
  // if submitted URL does not include http://, prepend
  // it to longURL and save it to urlDatabase
  let longURL = request.body['longURL'];
  let scheme='http://';
  if (!request.body['longURL'].includes('http://')) {
    longURL = scheme + longURL;
  }
  // Adds a new key-value pair, ie. shortURL: longURL
  urlDatabase[str] = longURL;
  response.redirect('/urls/' + str);
});

server.get('/urls/new', (request, response) => {
  response.render('urls_new');
});

server.get('/urls/:id', (request, response) => {
  let templateVars = { shortURL: request.params.id, urls: urlDatabase };
  response.render('urls_show', templateVars);
});

server.post('/urls/:id/delete', (request, response) => {
  delete urlDatabase[request.params.id];
  response.redirect('/urls');
});

server.get('/u/:shortURL', (request, response) => {
  let shortURL = request.params.shortURL;
  if(!urlDatabase[shortURL]) {
    response.redirect('/urls');
  }
  let longURL = urlDatabase[shortURL];
  response.redirect(longURL);
});

server.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});