// app.js
//admin user: login: admin password: admin
//normal user: login: testowy password: testowy

const PORT = process.env.PORT || 8080;


var bcrypt = require('bcrypt');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var path = require('path');
var multer = require('multer');
var Sequelize = require('sequelize');
const Op = Sequelize.Op;

//multer config
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

app.use(express.urlencoded({extended: true}));

//session config
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
app.use(express.static(__dirname + '/styles'));

//Sequelze config and models
var db = new Sequelize(null, null, null, {
    dialect: "sqlite",
    storage: 'db/database.db',
});

var user = db.define('user', {
    login: Sequelize.STRING,
    password: Sequelize.STRING,
    admin: Sequelize.BOOLEAN
});

var product = db.define('product', {
    name: Sequelize.STRING,
    description: Sequelize.TEXT,
    price: Sequelize.FLOAT,
    image: Sequelize.STRING
});

var order = db.define('order', {
    price: Sequelize.FLOAT
});

var orderItem = db.define('orderItem', {
    qty: Sequelize.INTEGER
});

orderItem.belongsTo(order);
orderItem.belongsTo(product);
order.items = order.hasMany(orderItem);
user.orders = user.hasMany(order);
order.belongsTo(user);



function authenticate(req, res, next) {
    if (req.session.valid) {
        next();
    }
    else {
        res.send('Funkcja dostępna tylko dla zalogowanych');
    }
}

function authenticateAdmin(req, res, next) {
    if (req.session.admin === "1" && req.session.valid) {
        next();
    }
    else {
        res.end('Funkcja dostępna tylko dla administratora');
    }
}
// db.sync();


//router

app.get('/', function (req, res) {
    product.findAll().then(function (table) {
        res.render('index', {product: table, admin: req.session.admin, login: req.session.valid});
    })
});

app.post('/', function (req, res) {
    let item = req.body.search_text;
    product.findAll({
        where: {
            name: {[Op.like]: '%' + item + '%'}
        }
    }).then(function (product) {
        res.render('index', {product: product, admin: req.session.admin, login: req.session.valid})
    })
});

app.get('/login', function (req, res) {
    res.render('login', {error: false, admin: req.session.admin, login: req.session.valid});

});

app.post('/login', function (req, res) {
    let login = req.body.login.toString();
    let password = req.body.password.toString();

    user.findOne({where: {login: login}}).then(function (result) {
        if (result != null) {
            let hashedPassword = result.dataValues.password;
            bcrypt.compare(password, hashedPassword, function (err, x) {
                if (x) {
                    req.session.user = login;
                    req.session.userid = result.dataValues.id;
                    req.session.admin = result.dataValues.admin;
                    req.session.valid = true;
                    req.session.cart = {};
                    req.session.price = 0;
                    res.redirect('/');
                }
                else {
                    res.render('login', {error: true, admin: req.session.admin, login: req.session.valid})
                }
            });
        }
        else {
            res.render('login', {error: true})
        }
    })

});

app.get('/register', function (req, res) {
    res.render('register', {error: false, admin: req.session.admin, login: req.session.valid});
});

app.post('/register', function (req, res) {
    let login = req.body.login.toString();
    let admin = req.body.admin === 'on';
    let password = req.body.password.toString();

    user.count({
        where: {
            login: login
        }
    })
        .then((result) => {
            if (result >= 1) {
                res.render('register', {error: true})
            } else {
                bcrypt.genSalt(10, function (err, salt) {
                    bcrypt.hash(password, salt, function (err, hashedPassword) {
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

app.get('/logout', function (req, res) {
    req.session.destroy();
    res.redirect('/');
});


app.get('/add', authenticateAdmin, function (req, res) {
    product.findAll().then(function (table) {
        res.render('add', {product: table, admin: req.session.admin, login: req.session.valid});
    })

});

app.post('/add', authenticateAdmin, upload, function (req, res) {
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


app.get('/delete/:id', authenticateAdmin, function (req, res) {

    let id = req.param('id');
    // console.log(name);
    product.destroy({
        where: {
            id: id
        }
    });
    res.redirect('/add');
});


app.get('/edit/:id', authenticateAdmin, function (req, res) {
    let id = req.param('id');
    //console.log(id);
    product.findById(id).then((product) => {
        // console.log(product);
        res.render('edit', {product: product, admin: req.session.admin, login: req.session.valid});
    });
});


app.post('/edit/:id', authenticateAdmin, upload, function (req, res) {
    if (req.file !== undefined) {
        var filename = req.file.filename;
    }
    let name = req.body.name;
    let description = req.body.description;
    let price = req.body.price;
    let id = req.param('id');

    product.update({
        name: name,
        description: description,
        price: price,
        image: filename
    }, {where: {id: id}}).then(() => {
        res.redirect('/add')
    });

});

app.get('/buy/:id', authenticate, function (req, res) {
    let id = req.param('id');
    product.findById(id).then(function (product) {
        if (req.session.cart[id] === undefined) {
            req.session.cart[id] = {
                qty: 1,
                name: product.dataValues.name,
                price: product.dataValues.price
            };
            req.session.price += product.dataValues.price
        }
        else {
            req.session.cart[id].qty += 1;
            req.session.price += product.dataValues.price
        }
        res.redirect('/');
    })

});


app.get('/cart', authenticate, function (req, res) {
    res.render('cart', {product: req.session.cart, admin: req.session.admin, login: req.session.valid});
});

app.get('/checkout', authenticate, function (req, res) {
    let cart = req.session.cart;
    let id = req.session.userid;
    let price = req.session.price;
    if(cart != {}) {
        order.create({
            price: price,
            userId: id,
        }).then(function (resoult) {
            for (var key in cart) {
                orderItem.create({
                    qty: cart[key].qty,
                    orderId: resoult.dataValues.id,
                    productId: key
                })
            }
            req.session.cart = {};
            req.session.price = 0;
            res.redirect('/');
        })
    } else {res.redirect('/');}
});

app.get('/orders', authenticate, function (req, res) {
    var userid = req.session.userid;

    order.findAll({where: {userId: userid}}).then(function (resoult) {
        res.render('orders', {orders: resoult, admin: req.session.admin, login: req.session.valid});
    })
});

app.get('/orders/:id', authenticate, function (req, res) {
    var userid = req.param('id') || req.session.userid;

    order.findAll({where: {userId: userid}}).then(function (resoult) {
        res.render('orders', {orders: resoult, admin: req.session.admin, login: req.session.valid});
    })
});

app.get('/order/:id', authenticate, function (req, res) {
    const id = req.param('id');

    orderItem.findAll({where: {orderId: id}, include: {model: product}}).then(function (resoult) {
        res.render('order', {orders_item: resoult, id: id, admin: req.session.admin, login: req.session.valid});
    })
});

app.get('/all', authenticateAdmin, function (req, res) {
    order.findAll({include: {model: user}}).then(function (resoult) {
        res.render('all', {orders: resoult, admin: req.session.admin, login: req.session.valid})
    })
});

app.get('/users', authenticateAdmin, function (req, res) {
    user.findAll().then(function (resoult) {
        res.render('users', {users: resoult, admin: req.session.admin, login: req.session.valid})
    })
})

app.listen(PORT);
console.log(PORT);
