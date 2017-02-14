const server = require('express')();
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8080;
const randomStr = require('./make-shorturl')

server.use(bodyParser.urlencoded({ extended: true }));
server.set("view engine", "ejs");

const urlDatabase = {
  "b2xVn2": "http://www.lighthouselabs.ca",
  "9sm5xK": "http://www.google.com"
};

server.get('/urls', (request, response) => {
  response.render('urls_index', { urls: urlDatabase })
});

// server.get('/urls/:id', (request, response) => {
//   let templateVars = { shortURL: request.params.id, urls: urlDatabase };
//   response.render('urls_show', templateVars);
// });

server.get('/urls/new', (request, response) => {
  response.render('urls_new');
});

server.post('/urls', (request, response) => {
  console.log(request.body);
  let str = randomStr.get();
  if (urlDatabase[str]) {
    while (urlDatabase[str]) {
      str = randomStr.get();
    }
  }
  urlDatabase[str] = request.body['longURL'];
  console.log(urlDatabase);
  response.send('OK');
})

// server.get("/", (request, response) => {
//   console.log(request);
//   response.send("Hello!");
// });

// server.get("/urls.json", (request, response) => {
//   response.json(urlDatabase);
// });

// server.get('/hello', (request, response) => {
//   response.send('<html><body>Hello<b>World</b></body></html>\n');
// })

server.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});