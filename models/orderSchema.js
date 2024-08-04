const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: String,
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category', 
    },
    price: Number,
    quantity:Number,
    image:[]

});

const orderSchema = new mongoose.Schema({
    product: {
        type: [productSchema], 
        required: true,
    },
    totalPrice: {
        type: Number,
        required: true,
    },
    quantity:{
        type:Number,
        
    },
    address: {
        type: Array,
        required: true,
    },
    payment: {
        type: String,
        default: 'pending',
        required: true,
    },
    userId: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        default: 'Pending',
        required: true,
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true,
    },
    date: {
        type: String,
    },
    cancel: {
        type: Array,
    },
    return: {
        type: Array,
    },
    couponDiscount: {
        type: Number,
        default: 0,
    },
    razorpayOrderId: {
        type: String,
    },
    
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
