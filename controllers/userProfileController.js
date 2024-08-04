const User = require("../models/userSchema");
const Product=require("../models/productSchema")
const Address= require("../models/addressSchema")
const Order = require("../models/orderSchema")
const nodemailer =require("nodemailer");
const bcrypt =require("bcryptjs");


const getUserProfile = async(req,res)=>{
    try{
        // console.log(req.session.user);
        // console.log(req.session.grandTotal,"grandToal user");
        const userId = req.session.user
        const userData =await User.findById({_id:userId});
        const addressData =await Address.findOne({userId:userId})
        const orderData = await Order.find({ userId: userId }).sort({ createdOn: -1 })
        // console.log(orderData,"orderData")
        res.render("user/profile",{user:userData,userAddress:addressData,order: orderData })
    }catch(error){
        console.log(error.message)
    }
}


const editUserDetails = async (req, res) => {
    try {
        const userId = req.query.id;
        const data = req.body;
        console.log(data,"hjkuiuiuuiuiuii")
        // Validate name field
        if (!data.Name ) {
            return res.status(400).json({ success: false, message: "Please provide a valid name." });
        }

        

        await User.updateOne(
            { _id: userId },
            {
                $set: {
                    Name: data.Name,
                    phone: data.phone,
                  
                    // email: data.email,
                }
            }
        );

        res.status(200).json({ success: true, message: "User details updated." });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ success: false, message: "An error occurred while updating user details." });
    }
};




const getAddressAddPage= async(req,res)=>{
    try{
        const user =req.session.user
        res.render("user/add-address",{user:user})
    }catch(error){
        console.log(error.message);
    }
}

        
const postAddress = async (req, res) => {
    try {
        const user = req.session.user;
        console.log(user);
        const userData = await User.findOne({ _id: user });
        const {
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            phone,
            altPhone,
        } = req.body;

        const userAddress = await Address.findOne({ userId: userData._id });
        console.log(userAddress);

        if (!userAddress) {
            console.log("fst");
            console.log(userData._id);
            const newAddress = new Address({
                userId: userData._id,
                address: [
                    {
                        addressType,
                        name,
                        city,
                        landMark,
                        state,
                        pincode,
                        phone,
                        altPhone,
                    },
                ],
            });
            await newAddress.save();
        } else {
            console.log("scnd");
            userAddress.address.push({
                addressType,
                name,
                city,
                landMark,
                state,
                pincode,
                phone,
                altPhone,
            });
            await userAddress.save();
        }

        // Send JSON response for success
        res.json({ success: true, message: "Address added successfully." });

    } catch (error) {
        console.log(error.message);
        // Send JSON response for error
        res.status(500).json({ success: false, message: error.message });
    }
};

const getEditAddress = async(req,res)=>{
    try{
        const addressId = req.query.id
        const user =req.session.user
        const currAddress = await Address.findOne({
            "address._id": addressId,
        })
        const addressData = currAddress.address.find((item)=>{
            return item._id.toString()== addressId
        })
        res.render("user/edit-address",{address:addressData, user:user})
    }catch(error){
        console.log(error.message)
    }
}

const postEditAddress = async(req,res)=>{
    try{
        console.log(req.body);
        const data =req.body
        const addressId = req.query.id
        console.log(addressId,"address id")
        const user =req.session.user
        const findAddress= await Address.findOne({"address._id":addressId});
        const matchAddress = findAddress.address.find(item=>item._id==addressId)
        console.log(matchAddress);
        await Address.updateOne(
            {
            "address._id":addressId,
            "_id":findAddress
        },
        {
            $set:{
                "address.$":{
                    _id:addressId,
                    addressType:data.addressType,
                    name: data.name,
                        city: data.city,
                        landMark: data.landMark,
                        state: data.state,
                        pincode: data.pincode,
                        phone: data.phone,
                        altPhone: data.altPhone,

                }
            }
        }
    ).then((result)=>{
        res.redirect("profile")
    })
    }catch(error){
        console.log(error.message)
    }
}

const getDeleteAddress = async(req,res)=>{
    try{
        const addressId = req.query.id
        const findAddress = await Address.findOne({"address._id":addressId})
        await Address.updateOne(
            {"address._id":addressId},
            {
                $pull:{
                    address:{
                        _id:addressId
                    }
                }
            }
        )
        .then((data)=>res.redirect("profile")
    )
    }catch(error){
        console.log(error.message)
    }
}

const getForgotPassPage=async(req,res)=>{
    try{
        res.render("user/forgot-password")
    }catch{
        console.log(error.message)
    }
}

function generateOtp() {
    const digits = "1234567890"
    var otp = ""
    for (i = 0; i < 6; i++) {
        otp += digits[Math.floor(Math.random() * 10)]
    }
    return otp
}

const forgotEmailValid =async(req,res)=>{
    try{
        const {email}=req.body
        const findUser = await User.findOne({ email: email })
        if (!findUser) {
            var otp = generateOtp()
            console.log(otp);
            const transporter = nodemailer.createTransport({
                host: "smtp.mailtrap.io",
                port: 2525,
                auth: {
                    user: process.env.MAILTRAP_USER,
                    pass: process.env.MAILTRAP_PASS
                }
            })
            const info = await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Verify Your Account ✔",
                text: `Your OTP is ${otp}`,
                html: `<b>  <h4 >Your OTP  ${otp}</h4>    <br>  <a href="">Click here</a></b>`,
            })
            if(info){
                req.session.userOtp=otp
                req.session.userData=req.body
                req.session.email=emailres.render("user/forgotPass-otp")
                console.log("Email sented",info.messageId)
            }else{
                res.json("email-error")
            }
         } else {
                res.render("user/forgot-password", { message: "User with this email already exists" })
            }
        } catch (error) {
            console.log(error.message);
        }

    }

const getResetPassPage =async(req,res)=>{
    try{
        res.render("user/reset-password")
    }catch(error){
        console.log(error.message);
    }
}

const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp
        if (enteredOtp === req.session.userOtp) {

            res.json({ status: true })
        } else {
            console.log('jijijijij');
            res.json({ status: false })
        }
    } catch (error) {
        console.log(error.message);
    }
}

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash
    } catch (error) {
        console.log(error.message);
    }
}

const postNewPassword = async (req, res) => {
    const userId = req.session.user; // Assuming user ID is stored in session
    const { currentPass, newPass1, newPass2 } = req.body;

    try {
        if (!currentPass || !newPass1 || !newPass2) {
            return res.status(400).render('user/reset-password', { message: 'All fields are required' });
        }

        if (newPass1 !== newPass2) {
            return res.status(400).render('user/reset-password', { message: 'New passwords do not match' });
        }

        // Fetch user from database
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).render('user/reset-password', { message: 'User not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPass, user.password);
        if (!isMatch) {
            return res.status(400).render('user/reset-password', { message: 'Current password is incorrect' });
        }

        // Enforce stronger password criteria
        const strongPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})/;
        if (!strongPattern.test(newPass1)) {
            return res.status(400).render('user/reset-password', { message: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.' });
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPass1, 10);

        // Update user's password in the database
        await User.findByIdAndUpdate(userId, { password: hashedNewPassword });

        // Password changed successfully
        res.redirect('/profile');
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).render('user/reset-password', { message: 'An error occurred while changing password' });
    }
};

   
    const  verifyReferalCode  = async (req, res) => {
    try {
        const { referalCode } = req.body;
        console.log("Referral Code Received:", referalCode);

        if (!referalCode) {
            return res.json({ message: "No referral code provided!" });
        }

        const currentUser = await User.findById(req.session.user);
        if (!currentUser) {
            return res.json({ message: "Current user not found!" });
        }

        if (currentUser.redeemed) {
            return res.json({ message: "You have already redeemed a referral code before!" });
        }

        const codeOwner = await User.findOne({ referalCode });
        if (!codeOwner) {
            return res.json({ message: "Invalid referral code!" });
        }

        if (codeOwner._id.equals(currentUser._id)) {
            return res.json({ message: "Invalid referral code!" });
        }

        if (codeOwner.redeemedUsers && codeOwner.redeemedUsers.includes(currentUser._id)) {
            return res.json({ message: "You have already used this referral code!" });
        }

        await User.updateOne(
            { _id: req.session.user },
            {
                $inc: { wallet: 100 },
                $set: { redeemed: true }
            }
        );

        await User.updateOne(
            { _id: codeOwner._id },
            {
                $inc: { wallet: 200 },
                $push: {
                    history: {
                        amount: 200,
                        status: "credit",
                        date: Date.now()
                    }
                },
                $push: { redeemedUsers: currentUser._id }
            }
        );

        res.json({ message: "Referral code redeemed successfully!" });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: "An error occurred while verifying the referral code." });
    }
};



module.exports = {
    getUserProfile,
    getAddressAddPage,
    postAddress,
    getEditAddress,
    postEditAddress,
    getDeleteAddress,
    editUserDetails,
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    postNewPassword,
    verifyReferalCode
};



