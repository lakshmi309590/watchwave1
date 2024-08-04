const Product = require("../models/productSchema");
const Category = require("../models/categorySchema");

const fs = require("fs");
const path = require("path");

const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        res.render("admin/product-add", { cat: category });
    } catch (error) {
        console.log(error.message);
    }
};

const addProducts = async (req, res) => {
    try {
        const products = req.body;

        const productExists = await Product.findOne({ productName: products.productName });
        if (!productExists) {
            const images = [];
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    images.push(req.files[i].filename);
                }
            }

            const category = await Category.findOne({ name: products.category });
            if (!category) {
                throw new Error('Category not found');
            }

            const newProduct = new Product({
                id: Date.now(),
                productName: products.productName,
                description: products.description,
                brand: products.brand,
                category: category._id,
                regularPrice: products.regularPrice,
                salePrice: products.regularPrice,
                createdOn: new Date(),
                quantity: products.quantity,
                color: products.color,
                productImage: images
            });

            await newProduct.save();
            res.redirect("/admin/products");
        } else {
            res.json("failed");
        }
    } catch (error) {
        console.log(error.message);
    }
};

const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const findProduct = await Product.findOne({ _id: id });

        const category = await Category.find({});
        res.render("admin/edit-product", { product: findProduct, cat: category });
    } catch (error) {
        console.log(error.message);
    }
};

const deleteSingleImage = async (req, res) => {
    try {
        const id = req.body.productId;
        const image = req.body.filename;

        const product = await Product.findByIdAndUpdate(id, {
            $pull: { productImage: image }
        });

        const imagePath = path.join('public', 'uploads', 'product-images', image);
        if (fs.existsSync(imagePath)) {
            await fs.unlinkSync(imagePath);
            res.json({ success: true });
        } else {
            console.log(`Image ${image} not found`);
        }
    } catch (error) {
        console.log(error.message);
    }
};

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;

        // Fetch the current product
        const product = await Product.findById(id);
        if (!product) {
            throw new Error('Product not found');
        }

        // Collect new images
        const newImages = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                newImages.push(req.files[i].filename);
            }
        }

        // Combine existing images with new images
        const updatedImages = [...product.productImage, ...newImages];

        // Find the category
        const category = await Category.findOne({ name: data.category });
        if (!category) {
            throw new Error('Category not found');
        }

        // Prepare the update data
        const updateData = {
            productName: data.productName,
            description: data.description,
            category: category._id,
            regularPrice: data.regularPrice,
            quantity: data.quantity,
            size: data.size,
            color: data.color,
            createdOn: new Date(),
            productImage: updatedImages // update with combined images
        };

        // Update the product
        const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true });

        res.redirect("/admin/products");
    } catch (error) {
        console.log(error.message);
        res.status(500).send("An error occurred while updating the product");
    }
};


const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        let query = {}; // Start with an empty query

        if (req.query.category) {
            const category = await Category.findOne({ name: req.query.category });
            if (category) {
                query.category = category._id;
            } else {
                throw new Error('Category not found');
            }
        }

        // Simplify query to test product fetching
        const productData = await Product.find(query)
            .populate('category', 'name')
            .sort({ createdOn: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        // Add search conditions back
        const searchQuery = {
            ...query,
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
            ]
        };

        const productDataWithSearch = await Product.find(searchQuery)
            .populate('category', 'name')
            .sort({ createdOn: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        const count = await Product.find(searchQuery).countDocuments();

        res.render("admin/product", {
            data: productDataWithSearch,
            currentPage: page,
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.log(error.message);
    }
};

const getBlockProduct = async (req, res) => {
    try {
        let id = req.query.id;
        await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect("/admin/products");
    } catch (error) {
        console.log(error.message);
    }
};

const getUnblockProduct = async (req, res) => {
    try {
        let id = req.query.id;
        await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect("/admin/products");
    } catch (error) {
        console.log(error.message);
    }
};

const addProductOffer = async (req, res) => {
    try {
        // console.log(req.body);
        const { productId, percentage } = req.body
        const findProduct = await Product.findOne({ _id: productId })
        // console.log(findProduct);

        findProduct.salePrice = findProduct.salePrice - Math.floor(findProduct.regularPrice * (percentage / 100))
        findProduct.productOffer = parseInt(percentage)
        await findProduct.save()

        res.json({ status: true })

    } catch (error) {
        console.log(error.message);
    }

}
const removeProductOffer= async(req,res)=>{
    try{
        const {productId}=req.body;
        const findProduct = await Product.findOne({_id:productId})
        const percentage=findProduct.productOffer
       findProduct.salePrice =findProduct.salePrice + Math.floor(findProduct.regularPrice*(percentage/100))
       findProduct.productOffer=0
       await findProduct.save()
       res.json({status:true})

    }catch(error){
        console.log(error.message)
    }
}

module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    getBlockProduct,
    getUnblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    addProductOffer,
    removeProductOffer
};
