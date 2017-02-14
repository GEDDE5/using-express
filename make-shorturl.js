function generateRandomString() {
  let chars = 'abcdefghijklmnopqrstufwxyzABCDEFGHIJKLMNOPQRSTUFWXYZ1234567890';
  let str = '';
  for (let x = 0; x < 6; x++) {
    str += chars[Math.ceil(Math.random() * 62)];
  }
  return console.log(str);
}

generateRandomString();