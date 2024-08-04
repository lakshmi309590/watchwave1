const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    Name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    phone: { 
        type: String,
        required: true
    },
    Status: {
        type: String,
        default: 'Active'
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    cart: {
        type: Array
    },
    wishlist: {
        type: Array
    },
    wallet: {
        type: Number,
        default: 0
    },
    Address: [{
        Name: {
            type: String
        },
        AddressLane: {
            type: String
        },
        City: {
            type: String
        },
        Pincode: {
            type: Number
        },
        State: {
            type: String
        },
        Mobile: {
            type: Number
        }
    }],
    history: {
        type: Array,
        default: []
    },
    referalCode: {
        type: String,
        required: true
    },
    redeemed: {
        type: Boolean,
        default: false
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }]
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
