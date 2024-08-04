const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
    },
    productName: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
    },
    regularPrice: {
        type: Number,
        required: true,
    },
    salePrice: {
        type: Number,
        required: true,
    },
    createdOn: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        validate: {
            validator: function (v) {
                return !isNaN(v);
            },
            message: props => `${props.value} is not a valid number for quantity!`
        }
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    productImage: {
        type: Array,
        required: true,
    },
    color: {
        type: String,
        required: true,
    },
    productOffer: {
        type: Number,
        default: 0
    }
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
