const User =  require("../models/userSchema")
const Product = require("../models/productSchema")
const mongodb = require("mongodb")

const getCartPage = async (req, res) => {
    try {
        const id = req.session.user;
        console.log("User ID:", id);
        const user = await User.findOne({ _id: id });
        console.log("User:", user); // Logging user object for debugging

        // Check if user is not found
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (!user.cart) {
            return res.status(404).json({ error: "User has no cart" });
        }


        // Extract product IDs from the user's cart
        const productIds = user.cart.map(item => item.productId);
        console.log("Product IDs:", productIds); // Logging product IDs for debugging

        // Retrieve products based on the product IDs
        const products = await Product.find({ _id: { $in: productIds } });

        // Aggregate data for rendering the cart page
        const oid = new mongodb.ObjectId(id);
        let data = await User.aggregate([
            { $match: { _id: oid } },
            { $unwind: '$cart' },
            {
                $project: {
                    proId: { '$toObjectId': '$cart.productId' },
                    quantity: '$cart.quantity',
                },
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'proId',
                    foreignField: '_id',
                    as: 'productDetails',
                },
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'productDetails.category',
                    foreignField: '_id',
                    as: 'categoryDetails',
                },
            },
            {
                $addFields: {
                    categoryDetails: { $arrayElemAt: ["$categoryDetails", 0] }
                }
            }
        ]);
        // console.log("Data:", data); // Logging aggregated data for debugging

        // Calculate total quantity and grand total
        let quantity = 0;
        let grandTotal = 0;
        for (const i of user.cart) {
            quantity += i.quantity;
        }
        for (let i = 0; i < data.length; i++) {
            if (products[i]) {
                grandTotal += data[i].productDetails[0].salePrice * data[i].quantity;
            }
        }
        req.session.grandTotal = grandTotal;

        // Render the cart page with user data, quantity, data, and grand total
        res.render("user/cart", {
            user,
            quantity,
            data,
            grandTotal,
        });
    } catch (error) {
        // Handle any errors that occur during execution
        console.log("Error:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};


const addToCart = async (req, res) => {
    try {
        const id = req.query.id;
        const userId = req.session.user;
        const findUser = await User.findById(userId);
        const product = await Product.findById({ _id: id }).lean();

        // Check if the product was found
        if (!product) {
            return res.json({ status: "Product not found" });
        }

        // Log the product details
        console.log("Product added to cart:");

        if (product.quantity > 0) {
            const cartIndex = findUser.cart.findIndex(item => item.productId == id);
            if (cartIndex == -1) {
                let quantity = parseInt(req.body.quantity);
                await User.findByIdAndUpdate(userId, {
                    $addToSet: {
                        cart: {
                            productId: id,
                            quantity: quantity,
                        }
                    }
                });
                return res.json({ status: true });
            } else {
                const productInCart = findUser.cart[cartIndex];
                if (productInCart.quantity < product.quantity) {
                    const newQuantity = parseInt(productInCart.quantity) + parseInt(req.body.quantity);
                    await User.updateOne(
                        { _id: userId, "cart.productId": id },
                        { $set: { "cart.$.quantity": newQuantity } }
                    );
                    return res.json({ status: true });
                } else {
                    return res.json({ status: "Out of stock" });
                }
            }
        } else {
            console.log("Product is out of stock");
            return res.json({ status: "Out of stock" });
        }
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ status: false, error: "Internal server error" });
    }
}

const changeQuantity = async (req, res) => {
    try {
        // console.log('herere--------');
        const id = req.body.productId
        const user = req.session.user
        const count = req.body.count

        // console.log(user);
        // console.log(id, "productId");

        const findUser = await User.findOne({ _id: user })
        // console.log(findUser);
        const findProduct = await Product.findOne({ _id: id })


        if (findUser) {

            // console.log('iam here--');
            const productExistinCart = findUser.cart.find(item => item.productId === id)
            // console.log(productExistinCart, 'this is product in cart');
            let newQuantity
            if (productExistinCart) {
                // console.log('iam in the carrt----------------------mm');
                console.log(count);
                if (count == 1) {
                    // console.log("count + 1");
                    newQuantity = productExistinCart.quantity + 1
                } else if (count == -1) {
                    // console.log("count - 1");
                    newQuantity = productExistinCart.quantity - 1
                } else {
                    // console.log("errrrrrrrr");
                    return res.status(400).json({ status: false, error: "Invalid count" })
                }
            } else {
                // console.log('hhihihihihihi../');
            }
            // console.log('hiiiiiiiiiiiiiiiiiiii',newQuantity);
            console.log(newQuantity, 'this id new Quantity');
            if (newQuantity > 0 && newQuantity <= findProduct.quantity) {
                let quantityUpdated = await User.updateOne(
                    { _id: user, "cart.productId": id },
                    {
                        $set: {
                            "cart.$.quantity": newQuantity
                        }
                    }
                )
                const totalAmount = findProduct.salePrice
                console.log(totalAmount,"00000000000000000000")


                // console.log(totalAmount,"totsll");
                if (quantityUpdated) {
                    // console.log('iam here inside the cart', quantityUpdated, 'ok');

                    res.json({ status: true, quantityInput: newQuantity,count:count, totalAmount: totalAmount })

                } else {
                    res.json({ status: false, error: 'cart quantity is less' });

                }
            } else {
                res.json({ status: false, error: 'out of stock' });
            }
        }

    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ status: false, error: "Server error" });
    }
}


 
const deleteProduct = async (req, res) => {
    try {
        const id = req.query.id
        console.log(id, "id");
        
        const userId = req.session.user
        const user = await User.findById(userId)
        const cartIndex = user.cart.findIndex(item => item.productId == id)
        user.cart.splice(cartIndex, 1)
        await user.save()

        console.log("item deleted from cart");
        res.redirect("/cart")
    } catch (error) {
        console.log('thsi is aeroor ',error);
    }
}

module.exports = {
    getCartPage,
    addToCart,
    changeQuantity,
    deleteProduct
}
