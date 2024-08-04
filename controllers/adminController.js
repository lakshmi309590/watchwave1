const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema");
const Coupon = require("../models/couponSchema");
const bcrypt = require("bcryptjs");
const Order = require("../models/orderSchema");
const ExcelJS = require('exceljs');
const moment = require('moment');
const PDFDocument = require('pdfkit');

const hardcodedAdminEmail = "admin@example.com";
const hardcodeAdminPassword = "password";

const parseDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date)) {
        throw new Error('Invalid Date');
    }
    return date;
};

const getLoginPage = async (req, res) => {
    try {
        res.render("admin/admin-login");
    } catch (error) {
        console.log(error.message);
    }
};

const verifyLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (email === hardcodedAdminEmail && password === hardcodeAdminPassword) {
            req.session.admin = true;
            console.log("Admin Logged In");
            res.redirect("/admin/users");
        } else {
            console.log("Incorrect email or password");
            res.redirect("/admin/login");
        }
    } catch (error) {
        console.log(error.message);
    }
};

const getLogout = async (req, res) => {
    try {
        req.session.admin = null;
        res.redirect("/admin/login");
    } catch (error) {
        console.log(error.message);
    }
};
const getCouponPageAdmin = async (req, res) => {
    try {
        const findCoupons = await Coupon.find({})
        res.render("admin/coupon", { coupons: findCoupons })
    } catch (error) {
        console.log(error.message);
    }
}

const createCoupon = async (req, res) => {
    try {

        const data = {
            couponName: req.body.couponName,
            startDate: new Date(req.body.startDate + 'T00:00:00'),
            endDate: new Date(req.body.endDate + 'T00:00:00'),
            offerPrice: parseInt(req.body.offerPrice),
            minimumPrice: parseInt(req.body.minimumPrice)
        };

        const newCoupon = new Coupon({
            name: data.couponName,
            createdOn: data.startDate,
            expireOn: data.endDate,
            offerPrice: data.offerPrice,
            minimumPrice: data.minimumPrice
        })

        await newCoupon.save()
            .then(data => console.log(data))

        res.redirect("/admin/coupon")

        console.log(data);

    } catch (error) {
        console.log(error.message);
    }
}

const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        await Coupon.findByIdAndDelete(couponId);
        res.redirect("/admin/coupon");
    } catch (error) {
        console.log(error.message);
        res.status(500).send("Error deleting coupon");
    }
};





const dateWiseFilter = async (req, res) => {
    try {
        const date = parseDate(req.query.date);

        const startOfDay = moment(date).startOf('day').toDate();
        const endOfDay = moment(date).endOf('day').toDate();

        const orders = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: startOfDay,
                        $lt: endOfDay
                    },
                    status: "Delivered"
                }
            }
        ]);

        let itemsPerPage = 5;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(orders.length / itemsPerPage);
        const currentOrder = orders.slice(startIndex, endIndex);
        res.render("admin/salesReport", { data: currentOrder, totalPages, currentPage, date });
    } catch (error) {
        console.log(error.message);
        res.status(500).send("Server Error");
    }
};
const getSalesReportPage = async (req, res) => {
    try {
        // const orders = await Order.find({ status: "Delivered" }).sort({ createdOn: -1 })
        // console.log(orders);

        // res.render("salesReport", { data: currentOrder, totalPages, currentPage })

        // console.log(req.query.day);
        let filterBy = req.query.day
        if (filterBy) {
            res.redirect(`/admin/${req.query.day}`)
        } else {
            res.redirect(`/admin/salesMonthly`)
        }
    } catch (error) {
        console.log(error.message);
    }
}

const salesToday = async (req, res) => {
    try {
        let today = new Date()
        const startOfTheDay = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            0,
            0,
            0,
            0
        )

        const endOfTheDay = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            23,
            59,
            59,
            999
        )

        const orders = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: startOfTheDay,
                        $lt: endOfTheDay
                    },
                    status: "Delivered"
                }
            }
        ]).sort({ createdOn: -1 })


        let itemsPerPage = 5
        let currentPage = parseInt(req.query.page) || 1
        let startIndex = (currentPage - 1) * itemsPerPage
        let endIndex = startIndex + itemsPerPage
        let totalPages = Math.ceil(orders.length / 3)
        const currentOrder = orders.slice(startIndex, endIndex)

        console.log(currentOrder, "currOrder");

        res.render("admin/salesReport", { data: currentOrder, totalPages, currentPage, salesToday: true })

    } catch (error) {
        console.log(error.message);
    }
}


const salesWeekly = async (req, res) => {
    try {
        let currentDate = new Date()
        const startOfTheWeek = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate() - currentDate.getDay()
        )

        const endOfTheWeek = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate() + (6 - currentDate.getDay()),
            23,
            59,
            59,
            999
        )

        const orders = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: startOfTheWeek,
                        $lt: endOfTheWeek
                    },
                    status: "Delivered"
                }
            }
        ]).sort({ createdOn: -1 })

        let itemsPerPage = 5
        let currentPage = parseInt(req.query.page) || 1
        let startIndex = (currentPage - 1) * itemsPerPage
        let endIndex = startIndex + itemsPerPage
        let totalPages = Math.ceil(orders.length / 3)
        const currentOrder = orders.slice(startIndex, endIndex)

        res.render("admin/salesReport", { data: currentOrder, totalPages, currentPage, salesWeekly: true })

    } catch (error) {
        console.log(error.message);
    }
}


const salesMonthly = async (req, res) => {
    try {
        let currentMonth = new Date().getMonth() + 1
        const startOfTheMonth = new Date(
            new Date().getFullYear(),
            currentMonth - 1,
            1, 0, 0, 0, 0
        )
        const endOfTheMonth = new Date(
            new Date().getFullYear(),
            currentMonth,
            0, 23, 59, 59, 999
        )
        const orders = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: startOfTheMonth,
                        $lt: endOfTheMonth
                    },
                    status: "Delivered"
                }
            }
        ]).sort({ createdOn: -1 })
        // .then(data=>console.log(data))
        console.log("ethi");
        console.log(orders);

        let itemsPerPage = 5
        let currentPage = parseInt(req.query.page) || 1
        let startIndex = (currentPage - 1) * itemsPerPage
        let endIndex = startIndex + itemsPerPage
        let totalPages = Math.ceil(orders.length / 3)
        const currentOrder = orders.slice(startIndex, endIndex)

        res.render("admin/salesReport", { data: currentOrder, totalPages, currentPage, salesMonthly: true })


    } catch (error) {
        console.log(error.message);
    }
}


const salesYearly = async (req, res) => {
    try {
        const currentYear = new Date().getFullYear()
        const startofYear = new Date(currentYear, 0, 1, 0, 0, 0, 0)
        const endofYear = new Date(currentYear, 11, 31, 23, 59, 59, 999)

        const orders = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: startofYear,
                        $lt: endofYear
                    },
                    status: "Delivered"
                }
            }
        ])


        let itemsPerPage = 5
        let currentPage = parseInt(req.query.page) || 1
        let startIndex = (currentPage - 1) * itemsPerPage
        let endIndex = startIndex + itemsPerPage
        let totalPages = Math.ceil(orders.length / 3)
        const currentOrder = orders.slice(startIndex, endIndex)

        res.render("admin/salesReport", { data: currentOrder, totalPages, currentPage, salesYearly: true })

    } catch (error) {
        console.log(error.message);
    }
}



const generatePdf = async (req, res) => {
    try {
        const doc = new PDFDocument();
        const filename = 'sales-report.pdf';
        const orders = req.body;
        // console.log(orders);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        doc.pipe(res);
        doc.fontSize(12);
        doc.text('Sales Report', { align: 'center', fontSize: 16 });
        const margin = 5;
        doc
            .moveTo(margin, margin)
            .lineTo(600 - margin, margin)
            .lineTo(600 - margin, 842 - margin)
            .lineTo(margin, 842 - margin)
            .lineTo(margin, margin)
            .lineTo(600 - margin, margin)
            .lineWidth(3)
            .strokeColor('#000000')
            .stroke();

        doc.moveDown();



        //   console.log("nothing");

        const headers = ['Order ID', 'Name', 'Date', 'Total'];

let headerX = 20;
const headerY = doc.y + 10;

doc.text(headers[0], headerX, headerY);
headerX += 200;

headers.slice(1).forEach(header => {
    doc.text(header, headerX, headerY);
    headerX += 130;
});

let dataY = headerY + 25;

orders.forEach(order => {
    const cleanedDataId = order.dataId.trim();
    const cleanedName = order.name.trim();

    doc.text(cleanedDataId, 20, dataY, { width: 200 });
    doc.text(cleanedName, 230, dataY);
    doc.text(order.date, 350, dataY, { width: 120 }); 
    doc.text(order.totalAmount, 490, dataY);
    
    dataY += 30;
});

        

        doc.end();
    } catch (error) {
        console.log(error.message);
    }
}


const downloadExcel = async (req, res) => {
    try {

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        worksheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 50 },
            { header: 'Customer', key: 'customer', width: 30 },
            { header: 'Date', key: 'date', width: 30 },
            { header: 'Total', key: 'totalAmount', width: 15 },
            { header: 'Payment', key: 'payment', width: 15 },
        ];

        const orders = req.body;

        orders.forEach(order => {
            worksheet.addRow({
                orderId: order.orderId,
                customer: order.name,
                date: order.date,
                totalAmount: order.totalAmount,
                payment: order.payment,
                products: order.products,
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=salesReport.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.log(error.message);
    }
}

const adminDashboard = async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        let { year = currentYear, month } = req.query;

        // Convert year to a number     
        year = Number(year);

        // Validate the year
        if (isNaN(year) || year < 2000 || year > currentYear) {
            return res.status(400).send("Invalid year");
        }

        // If month is provided, validate and convert it to a number
        if (month !== undefined) {
            month = Number(month);
            // Validate the month
            if (isNaN(month) || month < 1 || month > 12) {
                console.log("Invalid month:", month);
                return res.status(400).send("Invalid month");
            }
        } else {
            // If month is not provided, set it to the current month
            const currentDate = new Date();
            month = currentDate.getMonth() + 1; // Months are zero-indexed, so add 1
            console.log("Current month:", month);
        }

        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year + 1, 0, 1);
        let startOfMonth, endOfMonth;

        if (month !== undefined) {
            startOfMonth = new Date(year, month - 1, 1);
            endOfMonth = new Date(year, month, 0);
        }

        const [
            categories,
            deliveredOrders,
            products,
            users,
            monthlySales,
            latestOrders,
            bestSellingProducts,
            bestSellingCategories,
            bestSellingBrands
        ] = await Promise.all([
            Category.find({ isListed: true }),
            Order.find({ status: "Delivered", createdOn: { $gte: startOfYear, $lt: endOfYear } }),
            Product.find({}),
            User.find({}),
            Order.aggregate([
                { $match: { status: "Delivered", createdOn: { $gte: startOfYear, $lt: endOfYear } } },
                {
                    $group: {
                        _id: { year: { $year: "$createdOn" }, month: { $month: "$createdOn" } },
                        count: { $sum: 1 },
                        totalRevenue: { $sum: "$totalPrice" }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ]),
            Order.find().sort({ createdOn: -1 }).limit(5),
            Order.aggregate([
                { $match: { status: "Delivered", createdOn: { $gte: startOfYear, $lt: endOfYear } } },
                { $unwind: "$product" },
                {
                    $group: {
                        _id: "$product.name",
                        totalSold: { $sum: "$product.quantity" }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 10 }
            ]),
            Order.aggregate([
                { $match: { status: "Delivered", createdOn: { $gte: startOfYear, $lt: endOfYear } } },
                { $unwind: "$product" },
                {
                    $group: {
                        _id: "$product.categoryId",
                        totalSold: { $sum: "$product.quantity" }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 10 }
            ]),
            Order.aggregate([
                { $match: { status: "Delivered", createdOn: { $gte: startOfYear, $lt: endOfYear } } },
                { $unwind: "$product" },
                {
                    $group: {
                        _id: "$product.brand",
                        totalSold: { $sum: "$product.quantity" }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 10 }
            ])
        ]);

        // Calculate total revenue
        const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.totalPrice, 0);

        // Calculate products added per month
        const productPerMonth = Array(12).fill(0);
        products.forEach(p => {
            const createdMonth = new Date(p.createdOn).getMonth();
            productPerMonth[createdMonth]++;
        });

        // Calculate monthly sales
        const monthlySalesArray = Array.from({ length: 12 }, (_, index) => {
            const monthData = monthlySales.find(item => item._id.month === index + 1 && item._id.year === year);
            return monthData ? monthData.count : 0;
        });

        // Render the admin dashboard with all calculated data
        res.render("admin/index", {
            orderCount: deliveredOrders.length,
            productCount: products.length,
            categoryCount: categories.length,
            totalRevenue,
            monthlyRevenue: totalRevenue, // Placeholder for monthly revenue
            monthlySalesArray,
            productPerMonth,
            latestOrders,
            bestSellingProducts,
            bestSellingCategories,
            bestSellingBrands,
            year,
            month // Pass the month to the template
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send("Internal Server Error");
    }
};

   
    

  


module.exports = {
    getLoginPage,
    verifyLogin,
    getLogout,
    getCouponPageAdmin,
    createCoupon,
    deleteCoupon,
    getSalesReportPage,
    salesToday,
    salesWeekly,
    salesMonthly,
    salesYearly,
    dateWiseFilter,
    adminDashboard,
    downloadExcel,
    generatePdf
    
};
