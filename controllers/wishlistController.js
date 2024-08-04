const User =require("../models/userSchema")
const Product= require("../models/productSchema");
const Category = require("../models/categorySchema");

const getWishlistPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send('User not found');
        }

        res.render("user/wishlist", { data: user.wishlist });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};




const addToWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ status: false, message: "User not logged in" });
        }

        const productId = req.body.productId;
        const findProduct = await Product.findOne({ _id: productId });

        if (!findProduct) {
            return res.json({ status: false, message: "Product not found" });
        }

        const updateResult = await User.updateOne(
            { _id: req.session.user },
            {
                $addToSet: {
                    wishlist: {
                        productId: productId,
                        image: findProduct.productImage[0],
                        productName: findProduct.productName,
                        category: findProduct.category,
                        salePrice: findProduct.salePrice,
                        brand: findProduct.brand,
                        units: findProduct.quantity,
                    },
                },
            }
        );

        if (updateResult.nModified === 0) {
            return res.json({ status: false, message: "Failed to add to wishlist" });
        }

        res.json({ status: true });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ status: false, message: "Server Error" });
    }
};


const deleteItemWishlist = async (req, res)=>{
    try {
        // console.log(req.query);
        const id = req.query.id
        await User.updateOne(
            { _id: req.session.user },
            {
                $pull: {
                    wishlist: { productId: id }
                }
            }
        )
        .then((data)=>console.log(data))
        res.redirect("wishlist")
    } catch (error) {
        console.log(error.message);
    }
}
module.exports = {
    getWishlistPage,
    addToWishlist,
    deleteItemWishlist
}
