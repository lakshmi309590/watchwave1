const mongoose= require('mongoose');
require('dotenv').config();

const MONGODB_URL= "mongodb+srv://chinoos111:aS3dtLwyEuQARIQ6@cluster0.lvoa0wv.mongodb.net/test"

mongoose.connect(MONGODB_URL);

mongoose.connection.on('connected',()=>{
    console.log('Connected to Database Successfully')
})

mongoose.connection.on('disconnected',()=>{
    console.log('Failed to Connect the Database')
})
// const mongoose = require('mongoose');

// const connectDB = async () => {
//     try {
//         const conn = await mongoose.connect(process.env.MONGODB_URL, {
//             useNewUrlParser: true,
//             useUnifiedTopology: true,
//         });

//         console.log('Database connected:', conn.connection.host);
        
//         // Check connection status
//         conn.connection.on('connected', () => {
//             console.log('MongoDB connected successfully');
//         });

//         conn.connection.on('error', (err) => {
//             console.error('MongoDB connection error:', err);
//         });

//         conn.connection.on('disconnected', () => {
//             console.log('MongoDB disconnected');
//         });

//     } catch (error) {
//         console.error('MongoDB connection error:', error);
//     }
// }

// module.exports = connectDB;
