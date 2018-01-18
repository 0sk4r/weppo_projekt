// server.js
// load the things we need
var fs = require('fs'),
    https = require('https'),
    bcrypt = require('bcrypt');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var path = require('path');
var multer = require('multer');
var Sequelize = require('sequelize');
const sqlite3 = require('sqlite3').verbose();
const Op = Sequelize.Op;

// https.createServer({
//     key: fs.readFileSync('key.pem'),
//     cert: [fs.readFileSync('cert.pem'),'1234']
// }, app).listen(8080);
var generateHash = function (password, done) {
    bcrypt.genSalt(10, function (err, salt) {
        bcrypt.hash(password, salt, null, done);
    })
};

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, "./images");
    },
    filename: function (req, file, callback) {
        callback(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname))
    }
});

var upload = multer({
    storage: storage
}).single('photo');
// set the view engine to ejs
app.set('view engine', 'ejs');

app.use(express.urlencoded({
    extended: true
}));
app.use(session({
    key: 'user_sid',
    secret: 'aldkjsalkdjlkasjlkjaldjsjdaljlska',
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 600000
    }
}));
app.use(cookieParser('aldkjsalkdjlkasjlkjaldjsjdaljlska'));
app.use(express.static(__dirname + '/images'));
// app.use((req, res, next) => {
//     if (req.cookie.user_id && !req.session.user){
//         res.clearCookie('user_id');
//     }
// });

// use res.render to load up an ejs view file

//ORM DATABASE
var db = new Sequelize(null, null, null, {
    dialect: "sqlite",
    storage: 'db/database.db',
});

var user = db.define('user', {
    login: Sequelize.STRING,
    password: Sequelize.STRING,
    admin: Sequelize.STRING
}, {
    instanceMethods: {
        validPassword: function (password) {
            return bcrypt.compareSync(password, this.password);
        }
    }
});

var product = db.define('product', {
    name: Sequelize.STRING,
    description: Sequelize.TEXT,
    price: Sequelize.FLOAT,
    image: Sequelize.STRING
});

// var db = new sqlite3.Database('db/database.db', sqlite3.OPEN_READ, (err) => {
//     if (err) {
//         console.error(err.message);
//     }
//     console.log('Connected to the database.');
// });

// db.run(`CREATE TABLE IF NOT EXISTS user (id INT, login TEXT, password TEXT)`);

// index page
// app.get('/images/:id',function (req,res){
//         res.sendFile('images/'+id)
//     }
//     )
app.get('/', function (req, res) {
    if (req.session.valid) {
        console.log(req.session.user);
    }

    product.findAll().then(function (table) {
        res.render('index', {product: table});
    })
});

app.post('/', function (req, res) {
    let item = req.body.search_text;
    product.findAll({where: {
        name: {[Op.like]: '%' + item + '%'}
        }}).then(function (product) {
            res.render('index', {product: product})
    })
});

app.get('/login', function (req, res) {
    res.render('login');

});

app.get('/register', function (req, res) {
    res.render('register');
});

app.get('/logout', function (req, res) {
    req.session.destroy();
    res.redirect('/');
});

function authenticate(req, res, next) {
    if (req.session.valid) {
        console.log('dziala');
        next();
    }
    else {
        console.log('jebło');
        res.send('jebło');
    }
}

app.get('/secret', authenticate, function (req, res) {
    res.render('secret');
});

//TODO ORM
app.post('/register', function (req, res) {
    let login = req.body.login.toString();
    let admin = req.body.admin;
    let password = req.body.password.toString();

    // db.run(`INSERT INTO user (login,password) VALUES ('${login}','${password}')`);
    user.count({
        where: {
            login: login
        }
    })
        .then((result) => {
            if (result >= 1) {
                res.end('istnieje juz');
            } else {

                bcrypt.genSalt(10, function (err, salt) {
                    bcrypt.hash(password, salt, function (err, hashedPassword) {

                        // console.log(hashedPassword);

                        user.create({
                            login: login,
                            password: hashedPassword,
                            admin: admin
                        });
                    })

                });

                res.redirect('/');
            }
        });
});

//TODO ORM
app.post('/login', function (req, res) {
    let login = req.body.login.toString();
    let password = req.body.password.toString();
    // let admin = req.body.admin;

    user.findOne({where: {login: login}}).then(function (result) {
        let hashedPassword = result.dataValues.password;
        bcrypt.compare(password, hashedPassword, function (err, x) {
            if (x) {
                console.log('hasło poprawne');
                req.session.user = login;
                req.session.valid = true;
                req.session.cart = {};
                res.redirect('/');
            }
            else {
                console.log('hasło błędne!!!');
            }
        });
        //console.log(result);
    })

});

app.get('/add', function (req, res) {
    product.findAll().then(function (table) {
        res.render('add', {product: table});
    })

});


//TODO ORM
app.post('/add', upload, function (req, res) {
    let filename = req.file.filename;
    let name = req.body.name;
    let description = req.body.description;
    let price = req.body.price;

    product.create({
        name: name,
        description: description,
        price: price,
        image: filename
    });

    res.redirect("/add");
});

app.get('/delete/:id', function (req, res) {

    let id = req.param('id');
    // console.log(name);
    product.destroy({
        where: {
            id: id
        }
    });
    res.redirect('/add');
});


app.get('/edit/:id', function (req, res) {
    let id = req.param('id');
    //console.log(id);
    product.findById(id).then((product) => {
        // console.log(product);
        res.render('edit', {product: product});
    });
});


app.post('/edit/:id', upload, function (req, res) {
    if (req.file != undefined) {
        var filename = req.file.filename;
    }
    //console.log(filename);
    let name = req.body.name;
    let description = req.body.description;
    let price = req.body.price;
    let id = req.param('id');
    //console.log(name);

    product.update({
        name: name,
        description: description,
        price: price,
        image: filename
    }, {where: {id: id}}).then(() => {
        res.redirect('/add')
    });

});

app.get('/buy/:id', function (req, res) {
    let id = req.param('id');
    if (req.session.cart[id] === undefined) {
        req.session.cart[id] = 1;
    }
    else {
        req.session.cart[id] += 1;
    }
    console.log(req.session.cart);
    res.redirect('/');
});


app.get('/cart', function (req, res) {
    res.render('cart');
});
// app.get('/content', auth, function (req, res) {
//     res.send("You can only see this after you've logged in.");
// });


app.listen(8080);
console.log('8080 is the magic port');