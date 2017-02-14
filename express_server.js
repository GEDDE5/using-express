const server = require("express")();
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8080;

server.use(bodyParser.urlencoded({ extended: true }));
server.set("view engine", "ejs");

const urlDatabase = {
  "b2xVn2": "http://www.lighthouselabs.ca",
  "9sm5xK": "http://www.google.com"
};

server.get('/urls', (request, response) => {
  response.render('urls_index', { urls: urlDatabase })
});

server.get('/urls/:id', (request, response) => {
  let templateVars = { shortURL: request.params.id, urls: urlDatabase };
  response.render('urls_show', templateVars);
});

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