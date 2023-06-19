const express = require('express');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const sha256 = require("sha256");
const session = require("express-session");
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;


const app = express();
app.use(bodyParser.json());

const DATABASE_NAME = "test_transaction";
const USERNAME = "admin";
const PASSWORD = "IHateSoftwareStudio";
const PORT = 3306;

const CLIENT_ID = '475648335583-6hcec2ms988sstc52ahn6ol3ega0j6rg.apps.googleusercontent.com';
const CLIENT_SECRET = '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';


const EMAIL_FORMAT = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
const TRANSACTION_PER_PAGE = 20;
const FRIEND_PER_PAGE = 20;

//Utility functions
const generateToken = () => Math.random().toString(36).substring(2)
const calculateHash = (email, password, token) => sha256(email + password + token)
const isValidEmail = email => EMAIL_FORMAT.test(email)

// Database connection
const sequelize = new Sequelize(DATABASE_NAME, USERNAME, PASSWORD, {
    host: 'db-demo3.cjqatcvujpry.ap-southeast-2.rds.amazonaws.com',
    dialect: 'mysql',
});

// User model

const User = sequelize.define('User', {
    email: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false
    },
    token: Sequelize.STRING,
    hash: Sequelize.STRING,
    balance: Sequelize.DECIMAL(10, 2)
});

// Transaction model

const Transaction = sequelize.define('Transaction', {
    amount: Sequelize.DECIMAL(10, 2),
    unit: Sequelize.CHAR(3),
    catagory: Sequelize.STRING,
    date: {
        type: Sequelize.DATE,
        allowNull: false
    },
    time: Sequelize.TIME,
    method: Sequelize.STRING,
    description: Sequelize.TEXT,
});

//Friendship model

const Friendship = sequelize.define('Friendship', {});

// Define relationship between User and Transaction
User.hasMany(Transaction);
Transaction.belongsTo(User);
User.belongsToMany(User, { through: Friendship, as: 'friends' });
/*
// Initialize Passport.js middleware
app.use(session({
    secret: "AIzaSyCT0AxtRMaEDeZORLZnPAa29LpKBVEuAyU"
}))

app.use(passport.initialize());
app.use(passport.session());

// Configure the Google authentication strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
      passReqToCallback: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        user = await User.findOne({where: {googleId: profile.id}});
        if(!user) {
            user = await User.create({
                email: profile.email,
                username: profile.displayName,
            });
      }
      done(null, user);
      } catch (error) {
        done(error);
      }
    }
  )
);

// Serialize and deserialize user for session management
passport.serializeUser((user, done) => {
    done(null, user.email);
});

passport.deserializeUser(async (email, done) => {
    try {
        user = await User.findOne({where : {email: email}});
        done(null, user? user: false);
    } catch (error) {
        done(error);
    }
});
*/
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// Sync the models with the database
sequelize.sync().then(() => {
    console.log('Database & tables created!');
});

//FUNCTIONS

// User registration
app.post('/register', async (req, res) => {
    const { email, username, password } = req.body;
    try {
        if (!isValidEmail(email)) {
            console.error("Not a valid email");
            res.status(501).json({ error: 'Wrong format' });
            return;
        }

        originalUser = await User.findOne({ where: { email: email } });

        if (originalUser) {
            console.error("The email has been taken");
            res.status(409).json({ error: 'Email taken' });
            return;
        }

        // Create a new user in the database
        token = await generateToken();
        hash = await calculateHash(email, password, token);
        newUser = await User.create({ email, username, token, hash, balance: 0 });
        res.json(newUser);
    } catch (error) {
        console.error('Error creating user: ', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        user = await User.findOne({ where: { email: email } });
        if (!user) {
            console.error("User do not exist");
            res.status(404).json({ error: 'Not found' });
            return;
        }
        if (calculateHash(email, password, user.token) !== user.hash) {
            console.error("The password is incorrect");
            res.status(403).json({ error: 'Incorrect password' });
            return;
        }
        res.json(user);
    } catch (error) {
        console.error('Error retrieving user: ', error);
        res.status(500).json({ error: 'Internal server error' });
    };
});

// Routes for Google authentication
app.get('/auth/google',
    passport.authenticate('google',
    { scope: ['profile', 'email']
}));

app.get('/auth/google/callback',
    passport.authenticate('google',
    { successRedirect: "/",
        failureRedirect: '/login' })
);


app.delete('/users/:userId/friends/:friendId', async (req, res) => {
    try {
        const { userId, friendId } = req.params;
        user = await User.findByPk(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        friend = await User.findByPk(friendId);
        if (!friend) {
            res.status(404).json({ error: 'Friend not found' });
            return;
        }

        user.removeFriend(friend).then(() => {
            res.json({ message: 'Friendship removed successfully' });
            return;
        });
    } catch (error) {
        console.error('Error retrieving user: ', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//Update User balance

app.put('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { balance } = req.body;
        user = await User.findByPk(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        updatedBalance = await user.update({ balance });
        if (!updatedBalance) {
            res.status(500).json({ error: "Cannot update balance" });
            return;
        }
        res.json(updatedBalance);
    } catch (err) {
        console.error('Error retrieving user: ', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a user along with their transactions and friendships
app.delete('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findByPk(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Delete all transactions associated with the user
        await Transaction.destroy({ where: { UserId: userId } });

        // Delete all friendships associated with the user
        await Friendship.destroy({
            where: {
                [sequelize.Op.or]: [{ UserId: userId }, { FriendId: userId }],
            },
        });

        // Delete the user
        await user.destroy();
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user: ', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Create a new transaction for a user
app.post('/users/:userId/transactions', async (req, res) => {
    const { userId } = req.params;
    try {
        user = await User.findByPk(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        transaction = await user.createTransaction(req.body);
        if (!transaction) {
            res.status(500).json({ error: "Can't create transaction" });
            return;
        }
        res.json(transaction);
    } catch (error) {
        console.error('Error retrieving user: ', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get some transactions for a user
app.get('/users/:userId/transactions', async (req, res) => {
    const { userId } = req.params;
    const { pageNumber, startDate, endDate } = req.query;
    try {
        const page = parseInt(pageNumber) || 1;
        const size = TRANSACTION_PER_PAGE;
        const offset = (page - 1) * size;

        const filter = {
            userId: userId,
        };

        if (startDate && endDate) {
            filter.date = {
              [Sequelize.Op.between]: [startDate, endDate]
            };
        } else if (startDate) {
            filter.date = {
              [Sequelize.Op.gte]: startDate
            };
        } else if (endDate) {
            filter.date = {
              [Sequelize.Op.lte]: endDate
            };
        }

        const transactions = await Transaction.findAll({
            where: filter,
            offset: offset,
            limit: size,
            order: [['Date', 'DESC']],
            include: [{ model: User, as: 'User' }]
        })

        res.json(transactions);
    } catch (error) {
        console.error('Error retrieving user: ', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//Edit Transaction

app.put('/users/:userId/transactions/:transactionId', async (req, res) => {
    const { userId, transactionId } = req.params;

    try {
        user = await User.findByPk(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        transaction = await Transaction.findOne({ where: { id: transactionId, UserId: user.id } });
        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found' });
            return;
        }
        updatedTransaction = await transaction.update(req.body);
        if (!updatedTransaction) {
            res.status(500).json({ error: 'Cannot make transaction' });
            return;
        }
        res.json(updatedTransaction);
    } catch (err) {
        console.error('Error retrieving user: ', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a friendship between two users
app.post('/users/:userId/friends', async (req, res) => {
    const { userId } = req.params;
    const { friendId } = req.body;

    try {
        user = await User.findByPk(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        friend = await User.findByPk(friendId);
        if (!friend) {
            res.status(404).json({ error: 'Friend not found' });
            return;
        }
        if (userId == friendId) {
            res.status(500).json({ error: "Can't add yourself as a friend" });
            return;
        }
        addedFriend = await user.addFriend(friend);
        if (!addedFriend) {
            res.status(500).json({ error: 'Cannot add friend' });
            return;
        }
        res.json({ message: "Added friend successfully" });

    } catch (error) {
        console.error('Error retrieving user: ', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/users/:userId/friends', async (req, res) => {
    const { userId } = req.params;
    const { pageNumber } = req.query;
    try {
        const page = parseInt(pageNumber) || 1;
        const size = FRIEND_PER_PAGE;
        const offset = (page - 1) * size;

        const friends = await Friendship.findAll({
            where: { userId: userId },
            offset: offset,
            limit: size,
            include: [{ model: User, as: 'friend' }]
        });
        res.json(friends);
    }
    catch (error) {
        console.error('Error retrieving user: ', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// Remove a friendship between two users
app.delete('/users/:userId/friends/:friendId', async (req, res) => {
    const { userId, friendId } = req.params;
    try {
        user = await User.findByPk(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        friend = await User.findByPk(friendId);
        if (!friend) {
            res.status(404).json({ error: 'Friend not found' });
            return;
        }

        user.removeFriend(friend);
        res.json({ message: 'Friendship removed successfully' });
        return;
    } catch (error) {
        console.error('Error retrieving user: ', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
