const bcrypt = require("bcrypt");

const password = "pewdepie";
const saltsRound = 10;

bcrypt.hash(password, saltsRound, (err, hash) => {
  if (err) {
    console.log(err);
  } else {
    console.log(hash);
  }
});
