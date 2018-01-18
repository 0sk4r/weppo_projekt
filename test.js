const sqlite3 = require('sqlite3').verbose();
var Sequelize = require('sequelize');

var db = new Sequelize(null, null, null, {
    dialect: "sqlite",
    storage: 'db/test.sqlite',
});

var user = db.define('user',{
    login: Sequelize.STRING,
    password: Sequelize.STRING
});

// sequelize.sync().then( () => {
//     x.findAll().then( (row) => {
//         console.log(row);
//     })
// });

var x = new user({login: 'lol', password: 'lol2'});


user.find().then((row) => {console.log(row)});
