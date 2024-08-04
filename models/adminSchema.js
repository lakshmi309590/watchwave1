const mongoose =require('mongoose');
const Schema= mongoose.Schema;

const AdminSchema = new Schema({
    Name:{
        type:String,
        require:true
    },
    Email:{
        type:String,
        require:true
    },
    Password:{
        type:String,
        require:true
    },
    Status:{
        type:String,
        default:"Active"
    }
});

const Admin =mongoose.model('admin',AdminSchema);
module.exports =Admin;