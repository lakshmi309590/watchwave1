const Category = require("../models/categorySchema")
const Product =require("../models/productSchema")

const getCategoryInfo =async(req,res)=>{
    try{
        const categoryData = await Category.find({})
        res.render("admin/category",{cat:categoryData})
    }catch(error){
        console.log(error.message);
    }
}

const addCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        // Trim and validate name and description
        if (!name || !description || name.trim().length === 0 || description.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Name and description cannot be empty or whitespace." });
        }

        const trimmedName = name.trim().toLowerCase(); // Convert to lowercase
        const trimmedDescription = description.trim();

        // Use a case-insensitive regular expression to find existing category
        const categoryExists = await Category.findOne({ name: new RegExp(`^${trimmedName}$`, 'i') });

        if (!categoryExists) {
            const newCategory = new Category({
                name: trimmedName, // Store the name in lowercase
                description: trimmedDescription
            });
            await newCategory.save();
            return res.status(200).json({ success: true, message: "Category added successfully." });
        } else {
            return res.status(400).json({ success: false, message: "Category already exists." });
        }
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ success: false, message: "Internal Server Error." });
    }
};


const getAllCategories = async (req, res) => {
    try {
        const categoryData = await Category.find({})
        res.render("admin/category", { cat: categoryData })
    } catch (error) {
        console.log(error.message);
    }
}

const getListCategory = async (req, res) => {
    try {
        let id = req.query.id
        console.log("wrking");
        await Category.updateOne({ _id: id }, { $set: { isListed: false } })
        res.redirect("/admin/category")
    } catch (error) {
        console.log(error.message);
    }
}


const getUnlistCategory = async (req, res) => {
    try {
        let id = req.query.id
        await Category.updateOne({ _id: id }, { $set: { isListed: true } })
        res.redirect("/admin/category")
    } catch (error) {
        console.log(error.message);
    }
}

const getEditCategory = async (req, res) => {
    try {
        const id = req.query.id
        const category = await Category.findOne({ _id: id })
        res.render("admin/edit-category", { category: category })
    } catch (error) {
        console.log(error.message);
    }
}

const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;

        // Trim and validate category name and description
        if (!categoryName || !description || categoryName.trim().length === 0 || description.trim().length === 0) {
            console.log("Category name and description are required and cannot be empty or whitespace.");
            return res.redirect(`/admin/category?id=${id}`);
        }

        const trimmedCategoryName = categoryName.trim();
        const trimmedDescription = description.trim();

        // Check if another category with the same name exists
        const categoryExists = await Category.findOne({ name: trimmedCategoryName });
        if (categoryExists && categoryExists._id.toString() !== id) {
            console.log("Category name already exists.");
            return res.redirect(`/admin/category?id=${id}`);
        }

        // Update the category
        await Category.updateOne(
            { _id: id },
            {
                name: trimmedCategoryName,
                description: trimmedDescription
            }
        );

        // Update the category reference in the products
        await Product.updateMany(
            { category: id },
            { $set: { category: id } }
        );

        res.redirect("/admin/category");
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Internal Server Error");
    }
};



const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;
        const findCategory = await Category.findById(categoryId);

        if (!findCategory) {
            return res.status(404).json({ status: false, message: 'Category not found' });
        }

        await Category.updateOne(
            { _id: categoryId },
            { $set: { categoryOffer: percentage } }
        );

        const productData = await Product.find({ category: categoryId });

        for (const product of productData) {
            product.salePrice = product.regularPrice - Math.floor(product.regularPrice * (percentage / 100));
            await product.save();
        }

        res.json({ status: true, message: 'Category offer added successfully' });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ status: false, message: 'Server error' });
    }
};

const removeCategoryOffer = async (req, res) => {
    try {
        const categoryId = req.body.categoryId;
        const findCategory = await Category.findById(categoryId);

        if (!findCategory) {
            return res.status(404).json({ status: false, message: 'Category not found' });
        }

        const productData = await Product.find({ category: categoryId });

        for (const product of productData) {
            product.salePrice = product.regularPrice;
            await product.save();
        }

        findCategory.categoryOffer = 0;
        await findCategory.save();

        res.json({ status: true, message: 'Category offer removed successfully' });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ status: false, message: 'Server error' });
    }
};
module.exports = {
    getCategoryInfo,
    addCategory,
    getAllCategories,
    getListCategory,
    getUnlistCategory,
    editCategory,
    getEditCategory,
    addCategoryOffer,
    
    removeCategoryOffer
}