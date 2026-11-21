
import multer from "multer";

// Store uploaded image temporarily in memory
const storage = multer.memoryStorage();

// Allow image files only
const fileFilter = (req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
        return callback(new Error("Only image files are allowed."));
    }

    callback(null, true);
};

const uploadImage = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // Maximum 5 MB
        files: 1,
    },
});

export default uploadImage;
