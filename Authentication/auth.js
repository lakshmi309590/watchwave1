const User = require("../models/userSchema");

const isLogged = (req, res, next) => {
    if (req.session.user) {
        User.findById({ _id: req.session.user }).lean()
            .then((data) => {
                if (data && !data.isBlocked) {
                    next();
                } else {
                    res.redirect("/login");
                }
            })
            .catch((error) => {
                console.error("Error querying user data:", error);
                res.redirect("/login"); // Redirect in case of error
            });
    } else {
        res.redirect("/login");
    }
};
const isAdmin = (req, res, next) => {
    console.log(req.session.admin,"debug")
    if (req.session.admin) {
        User.findOne({ isAdmin})
            .then((data) => {
                console.log(data,"data")
                if (data) {
                    next();
                } else {
                    res.redirect("/admin/login");
                }
            })
            .catch((error) => {
                console.error("Error in isAdmin middleware:", error);
                res.status(500).send("Internal Server Error");
            });
    } else {

        res.redirect("/admin/login");
    }
};
module.exports = {
    isLogged,
    isAdmin
};
