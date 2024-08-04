const User = require("../models/userSchema");
const Product = require("../models/productSchema");
const Address = require("../models/addressSchema");
const Order = require("../models/orderSchema");
const Coupon = require("../models/couponSchema");
const razorpay = require("razorpay");
const invoice = require("../helpers/invoice");
const mongodb = require("mongodb");
const crypto = require("crypto");

const instance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user;

        if (req.query.isSingle === "true") {
            const id = req.query.id;
            const findProduct = await Product.find({ id: id }).lean();
            const findUser = await User.findOne({ _id: userId });
            const addressData = await Address.findOne({ userId: userId });
            const today = new Date().toISOString();

            const findCoupons = await Coupon.find({
                isList: true,
                createdOn: { $lt: new Date(today) },
                expireOn: { $gt: new Date(today) },
                minimumPrice: { $lt: findProduct[0].salePrice }
            });

            res.render("user/checkout", {
                product: findProduct,
                user: userId,
                findUser: findUser,
                userAddress: addressData,
                isSingle: true,
                coupons: findCoupons
            });
        } else {
            const user = req.query.userId;
            const findUser = await User.findOne({ _id: user });

            if (!findUser.cart.length) {
                return res.redirect('/cart');
            }

            const addressData = await Address.findOne({ userId: user });
            const oid = new mongodb.ObjectId(user);
            const data = await User.aggregate([
                { $match: { _id: oid } },
                { $unwind: "$cart" },
                {
                    $project: {
                        proId: { '$toObjectId': '$cart.productId' },
                        quantity: "$cart.quantity"
                    }
                },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'proId',
                        foreignField: '_id',
                        as: 'productDetails'
                    }
                }
            ]);

            const grandTotal = req.session.grandTotal;
            const today = new Date().toISOString();

            const findCoupons = await Coupon.find({
                isList: true,
                createdOn: { $lt: new Date(today) },
                expireOn: { $gt: new Date(today) },
                minimumPrice: { $lt: grandTotal }
            });

            res.render("user/checkout", {
                data: data,
                user: findUser,
                isCart: true,
                userAddress: addressData,
                isSingle: false,
                grandTotal,
                coupons: findCoupons
            });
        }
    } catch (error) {
        console.error("Error in getCheckoutPage:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
const orderPlaced = async (req, res) => {
    try {
        const { totalPrice, addressId, payment, productId, isSingle, retryOrderId } = req.body;
        const userId = req.session.user;
        const couponDiscount = req.session.coupon || 0;
        req.session.payment = payment;

        let order;

        if (retryOrderId) {
            // Handle retrying an existing failed order
            console.log(retryOrderId, ">>>>>>>>>>>>>>>>2")
            order = await Order.findById(retryOrderId);
            if (!order) {
                return res.status(404).json({ error: "Order not found" });
            }
            order.payment = payment;
            order.status = "Payment Pending";
        } else {
            const findUser = await User.findById(userId);
            const address = await Address.findOne({ userId });
            const findAddress = address.address.find(item => item._id.toString() === addressId);

            if (isSingle === "true") {
                const findProduct = await Product.findById(productId);
                if (!findProduct) {
                    return res.status(404).json({ error: "Product not found" });
                }
                const productDetails = {
                    _id: findProduct._id,
                    price: findProduct.salePrice,
                    name: findProduct.productName,
                    image: findProduct.productImage[0],
                    brand: findProduct.brand,
                    category: findProduct.category,
                    productOffer: findProduct.regularPrice - findProduct.salePrice,
                    quantity: 1
                };

                order = new Order({
                    product: [productDetails],
                    totalPrice,
                    address: findAddress,
                    payment,
                    userId,
                    couponDiscount,
                    createdOn: Date.now(),
                    status: "Payment Pending",
                });

                findProduct.quantity -= 1;
                await findProduct.save();
            } else {
                const productIds = findUser.cart.map(item => item.productId);
                const findProducts = await Product.find({ _id: { $in: productIds } });

                const cartItemQuantities = findUser.cart.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity
                }));

                const orderedProducts = findProducts.map((item) => ({
                    _id: item._id,
                    price: item.salePrice,
                    regularPrice: item.regularPrice,
                    name: item.productName,
                    image: item.productImage[0],
                    brand: item.brand,
                    category: item.category,
                    productOffer: item.regularPrice - item.salePrice,
                    quantity: cartItemQuantities.find(cartItem => cartItem.productId.toString() === item._id.toString()).quantity
                }));

                order = new Order({
                    product: orderedProducts,
                    totalPrice,
                    address: findAddress,
                    payment,
                    userId,
                    couponDiscount,
                    createdOn: Date.now(),
                    status: "Payment Pending",
                });

                for (const orderedProduct of orderedProducts) {
                    const product = await Product.findById(orderedProduct._id);
                    if (!product) {
                        return res.status(404).json({ error: `Product ${orderedProduct.name} not found` });
                    }
                    product.quantity -= orderedProduct.quantity;
                    await product.save();
                }
            }
        }

        await order.save();

        if (payment === 'cod') {
            if (order.totalPrice >= 1000) {
                return res.status(400).json({ error: "COD not allowed for orders over 1000. Please select another payment method." });
            }
            order.status = "Confirmed";
            await order.save();
            if (isSingle !== "true") {
                await User.updateOne({ _id: userId }, { $set: { cart: [] } });
            }
            res.json({ payment: true, method: "cod", order });
        } else if (payment === 'online') {
            const generatedOrder = await generateOrderRazorpay(order._id, totalPrice);
            order.razorpayOrderId = generatedOrder.id;
            await order.save();
            res.json({ payment: false, method: "online", razorpayOrder: generatedOrder, order });
        } else if (payment === 'wallet') {
            const findUser = await User.findById(userId);
            if (totalPrice <= findUser.wallet) {
                findUser.wallet -= totalPrice;
                findUser.history.push({ amount: totalPrice, status: "debit", date: Date.now() });
                await findUser.save();
                order.status = "Confirmed";
                await order.save();
                if (isSingle !== "true") {
                    await User.updateOne({ _id: userId }, { $set: { cart: [] } });
                }
                res.json({ payment: true, method: "wallet", order });
            } else {
                res.json({ payment: false, method: "wallet", success: false });
            }
        }
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};



// const orderPlaced = async (req, res) => {
//     try {
//         console.log("req.body================>", req.body);
//         const { totalPrice, addressId, payment, couponId, productId } = req.body;
//         const userId = req.session.user;
//         const findUser = await User.findOne({ _id: userId });

//         if (req.body.isSingle === "true") {
//             const grandTotal = req.session.grandTotal || totalPrice;
//             const address = await Address.findOne({ userId: userId });
//             const findAddress = address.address.find(item => item._id.toString() === addressId);
//             const findProduct = await Product.findOne({ _id: productId });

//             const productDetails = {
//                 _id: findProduct._id,
//                 price: findProduct.salePrice,
//                 name: findProduct.productName,
//                 image: findProduct.productImage[0],
//                 quantity: 1
//             };

//             const newOrder = new Order({
//                 product: productDetails,
//                 totalPrice: grandTotal,
//                 address: findAddress,
//                 payment: payment,
//                 userId: userId,
//                 status: "Payment Pending",
//                 createdOn: Date.now(),
//             });

//             let orderDone;

//             if (newOrder.payment === 'cod') {
//                 await findProduct.save();
//                 newOrder.status = "Confirmed";
//                 orderDone = await newOrder.save();
//                 res.json({ payment: true, method: "cod", order: orderDone, orderId: userId });
//             } else if (newOrder.payment === 'online') {
//                 orderDone = await newOrder.save();
//                 const generatedOrder = await generateOrderRazorpay(orderDone._id, orderDone.totalPrice);
//                 await findProduct.save();
//                 res.json({ payment: false, method: "online", razorpayOrder: generatedOrder, order: orderDone, orderId: orderDone._id });
//             } else if (newOrder.payment === "wallet") {
//                 if (newOrder.totalPrice <= findUser.wallet) {
//                     findUser.wallet -= newOrder.totalPrice;
//                     findUser.history.push({
//                         amount: newOrder.totalPrice,
//                         status: "debit",
//                         date: Date.now()
//                     });
//                     await findUser.save();
//                     await findProduct.save();
//                     newOrder.status = "Confirmed";
//                     orderDone = await newOrder.save();
//                     res.json({ payment: true, method: "wallet", order: orderDone, orderId: orderDone._id });
//                 } else {
//                     res.json({ payment: false, method: "wallet", success: false });
//                 }
//             }
//         } else {
//             const productIds = findUser.cart.map(item => item.productId);
//             const findAddress = await Address.findOne({ 'address._id': addressId });

//             if (!findAddress) {
//                 return res.status(404).json({ message: 'Address not found' });
//             }

//             const desiredAddress = findAddress.address.find(item => item._id.toString() === addressId.toString());
//             const findProducts = await Product.find({ _id: { $in: productIds } });

//             let grandTotal = 0;
//             const orderedProducts = findProducts.map((item, index) => {
//                 const quantity = findUser.cart.find(cartItem => cartItem.productId.toString() === item._id.toString()).quantity;
//                 console.log(quantity,"quantitymmmmm")
//                 const totalItemPrice = item.salePrice * quantity;
//                 grandTotal += totalItemPrice;
//                 return {
//                     _id: item._id,
//                     price: item.salePrice,
//                     name: item.productName,
//                     image: item.productImage[0],
//                     quantity: quantity,
//                     orderIndex: index,
//                     totalItemPrice: totalItemPrice
//                 };
//             });

//             let couponDiscount = 0;
//             if (couponId) {
//                 const coupon = await Coupon.findOne({ _id: couponId });
//                 if (coupon) {
//                     couponDiscount = coupon.offerPrice;
//                     grandTotal -= couponDiscount;
//                 }
//             }

//             // Check if payment method is COD and total price exceeds Rs 1000
//             if (payment === 'cod' && grandTotal > 1000) {
//                 return res.status(400).json({ message: 'COD not allowed for orders above Rs 1000' });
//             }

//             const newOrder = new Order({
//                 product: orderedProducts,
//                 totalPrice: totalPrice || grandTotal,
//                 address: desiredAddress,
//                 payment: payment,
//                 userId: userId,
//                 status: "Payment Pending",
//                 createdOn: Date.now(),
//                 couponDiscount: couponDiscount
//             });

//             await User.updateOne(
//                 { _id: userId },
//                 { $set: { cart: [] } }
//             );

//             for (let i = 0; i < orderedProducts.length; i++) {
//                 const product = await Product.findOne({ _id: orderedProducts[i]._id });
//                 if (product) {
//                     product.quantity = Math.max(product.quantity - orderedProducts[i].quantity, 0);
//                     await product.save();
//                 }
//             }

//             let orderDone;

//             if (newOrder.payment === 'cod') {
//                 newOrder.status = "Confirmed";
//                 orderDone = await newOrder.save();
//                 res.json({ payment: true, method: "cod", order: orderDone, orderId: findUser._id });
//             } else if (newOrder.payment === 'online') {
                
//                 const generatedOrder = await generateOrderRazorpay(newOrder._id, newOrder.totalPrice);
//                 newOrder.razorpayOrderId = generatedOrder.id;
//                 orderDone = await newOrder.save();
//                 console.log(generatedOrder,"geratejjjjjj")
//                 res.json({ payment: false, method: "online", razorpayOrder: generatedOrder, order: orderDone, orderId: orderDone._id });
//             } else if (newOrder.payment === "wallet") {
//                 if (newOrder.totalPrice <= findUser.wallet) {
//                     findUser.wallet -= newOrder.totalPrice;
//                     findUser.history.push({
//                         amount: newOrder.totalPrice,
//                         status: "debit",
//                         date: Date.now()
//                     });
//                     await findUser.save();
//                     newOrder.status = "Confirmed";
//                     orderDone = await newOrder.save();
//                     res.json({ payment: true, method: "wallet", order: orderDone, orderId: orderDone._id });
//                 } else {
//                     res.json({ payment: false, method: "wallet", success: false });
//                 }
//             }
//         }
//     } catch (error) {
//         console.error(error.message);
//     }
// };



const generateOrderRazorpay = (orderId, total) => {
    return new Promise((resolve, reject) => {
        const options = {
            amount: total * 100, // amount in paise
            currency: "INR",
            receipt: String(orderId) // receipt ID can be a random string or specific test data
        };
        console.log("Creating Razorpay order with options:", options);
        instance.orders.create(options, (err, order) => {
            if (err) {
                reject(err);
            } else {
                console.log("Razorpay order created:", order);
                resolve(order);
            }
        });
    });
};

const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body.payment;
        console.log(razorpay_order_id)
        // console.log('Verifying Payment:', {
        //     razorpay_order_id: razorpay_order_id,
        //     razorpay_payment_id: razorpay_payment_id,
        //     razorpay_signature: response.razorpay_signature
        // });
        
        
        if (!razorpay_signature) {
            return res.status(400).json({ error: "Missing razorpay_signature" });
        }

        // Verify the signature
        const generatedSignature = crypto
            .createHmac('sha256', '2QyjXO4txvokRV1LC85NPlGI')
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ error: "Invalid razorpay_signature" });
        }

        const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        order.status = "Confirmed";
        order.createdOn = Date.now();
        await order.save();
         console.log(order,"order done")
        // Clear the cart only after successful payment
        if (order.status == "Confirmed") {
            await User.updateOne({ _id: order.userId }, { $set: { cart: [] } });
        }

        res.json({ status: true });
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const logPaymentFailure = async (req, res) => {
    try {
        const { orderId, error } = req.body;
        console.log(orderId)
        console.error(`Payment failed for order ${orderId}: ${error}`);
        await Order.updateOne({ _id: orderId }, { $set: { status: 'Payment Failed' } });
        res.json({ message: 'Payment failure logged' });
    } catch (error) {
        console.error("Error in logPaymentFailure:", error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const savePendingOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findOne({ _id: orderId });
        if (order) {
            order.status = 'Payment Pending';
            await order.save();
            res.json({ message: 'Order saved in pending state' });
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        console.error("Error in savePendingOrder:", error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};



const getOrderDetailsPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderId = req.query.id;
        const findOrder = await Order.findOne({ _id: orderId });
        console.log(findOrder,"00000");
        if (!findOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        const sortedProducts = findOrder.product.sort((a, b) => a.orderIndex - b.orderIndex);
        const findUser = await User.findOne({ _id: userId });

        res.render("user/orderDetails", {
            orders: { ...findOrder._doc, product: sortedProducts },
            user: findUser,
            orderId
        });
    } catch (error) {
        console.error(error.message);
    }
};


const getOrderListPageAdmin = async (req, res) => {
    try {
        const orders = await Order.find({}).sort({ createdOn: -1 });

        let itemsPerPage = 5;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(orders.length / itemsPerPage);
        const currentOrder = orders.slice(startIndex, endIndex);

        res.render("admin/orders-list", {
            orders: currentOrder,
            totalPages,
            currentPage
        });
    } catch (error) {
        console.error("Error in getOrderListPageAdmin:", error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};




const changeOrderStatus = async (req, res) => {
    try {
        const orderId = req.query.orderId;
        await Order.updateOne({ _id: orderId }, { status: req.query.status });
        res.redirect('/admin/orderList');
    } catch (error) {
        console.error("Error in changeOrderStatus:", error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getCartCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const findUser = await User.findOne({ _id: userId });

        if (!findUser.cart.length) {
            return res.redirect('/cart');
        }

        const grandTotal = req.session.grandTotal;
        const addressData = await Address.findOne({ userId: userId });
        const today = new Date().toISOString();

        const findCoupons = await Coupon.find({
            isList: true,
            createdOn: { $lt: new Date(today) },
            expireOn: { $gt: new Date(today) },
            minimumPrice: { $lt: findProduct[0].salePrice },
        });
        console.log(findCoupons, 'this is coupon ');
        res.render("user/checkout", {
            data: findUser.cart,
            user: findUser,
            isCart: true,
            userAddress: addressData,
            grandTotal,
            coupons: findCoupons
        });
    } catch (error) {
        console.error("Error in getCartCheckoutPage:", error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getInvoice = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findOne({ _id: orderId }).populate('product._id');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const invoiceData = invoice.generateInvoice(order);
        res.json(invoiceData);
    } catch (error) {
        console.error("Error in getInvoice:", error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
const getOrderDetailsPageAdmin = async (req, res) => {
    try {
        const orderId = req.query.id;
        const findOrder = await Order.findOne({ _id: orderId });

        if (!findOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Render the order details page with the order's product data
        res.render("admin/order-details-admin", {
            orders: findOrder,
            orderId
        });
    } catch (error) {
        console.error("Error in getOrderDetailsPageAdmin:", error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const requestReturn = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderId = req.query.orderId;
        const findUser = await User.findOne({ _id: userId });

        if (!findUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const order = await Order.findOne({ _id: orderId });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status !== "Delivered") {
            return res.status(400).json({ message: 'Only delivered orders can be returned' });
        }

        order.status = "Returned";
        await order.save();

        // Process refund if payment was made online or through wallet
        if (order.payment === "wallet" || order.payment === "online") {
            findUser.wallet += order.totalPrice;
            findUser.history.push({
                amount: order.totalPrice,
                status: "credit",
                date: Date.now()
            });
            await findUser.save();
        }

        // Update product quantities
        for (const productData of order.product) {
            const productId = productData._id;
            const product = await Product.findById(productId);
            if (product) {
                product.quantity += productData.quantity;
                await product.save();
            }
        }

        res.redirect('/profile');
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'An error occurred while processing the return request' });
    }
};
const cancelOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const findUser = await User.findOne({ _id: userId });

        if (!findUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!Array.isArray(findUser.history)) {
            findUser.history = [];
        }

        const orderId = req.query.orderId;
        const order = await Order.findOne({ _id: orderId });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        order.status = "Canceled";
        await order.save();

        if (order.payment === "wallet" || order.payment === "online") {
            findUser.wallet += order.totalPrice;
            findUser.history.push({
                amount: order.totalPrice,
                status: "credit",
                date: Date.now()
            });
            await findUser.save();
        }

        for (const productData of order.product) {
            const productId = productData._id;
            const product = await Product.findById(productId);
            if (product) {
                product.quantity += productData.quantity;
                await product.save();
            }
        }

        res.redirect('/profile');
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'An error occurred while cancelling the order' });
    }
};

// const retryPayment = async (req, res) => {
//     try {
//         const orderId = req.params.id;
//         const order = await Order.findOne({ _id: orderId });

//         if (!order || order.status !== 'Payment Pending') {
//             return res.status(404).json({ message: 'Order not found or payment already completed' });
//         }

//         const generatedOrder = await generateOrderRazorpay(order._id, order.totalPrice);
        
//         // Update the order with new Razorpay details
//         order.razorpayOrderId = generatedOrder.id;
//         await order.save();

//         res.json({ razorpayOrder: generatedOrder });
//     } catch (error) {
//         console.error("Error in retryPayment:", error.message);
//         res.status(500).json({ message: 'Error retrying payment' });
//     }
// };
const retryPayment = async (req, res) => {
try {
    const { orderId, userId } = req.body;

    // Fetch order details from the database
    const order = await Order.findById(orderId).populate('product').populate('user');
    const user = await User.findById(userId);

    if (!order || !user) {
        return res.status(404).json({ status: 'error', message: 'Order or User not found' });
    }

    // Prepare Razorpay order
    const razorpayOrder = await razorpay.orders.create({
        amount: order.totalPrice * 100,
        currency: "INR",
        receipt: `order_rcptid_${orderId}`
    });

    res.json({
        method: 'online',
        razorpayOrder,
        totalPrice: order.totalPrice,
        customerName: user.name,
        customerEmail: user.email,
        customerContact: user.phone,
        productId: order.product._id,
        addressId: order.address._id
    });
} catch (error) {
    console.error('Error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
}
};

module.exports = {
    getCheckoutPage,
    orderPlaced,
    changeOrderStatus,
    getOrderDetailsPage,
    getOrderListPageAdmin,
    cancelOrder,
    getCartCheckoutPage,
    getOrderDetailsPageAdmin,
    getInvoice,
    verifyPayment,
    requestReturn,
    retryPayment,
    logPaymentFailure,
    savePendingOrder,
    
};