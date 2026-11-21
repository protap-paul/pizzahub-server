
export const uploadMenuItemImage = async (req, res) => {
    try {
        // Check whether an image was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select an image to upload.",
            });
        }

        const apiKey = process.env.IMGBB_API_KEY;

        if (!apiKey) {
            console.error("IMGBB_API_KEY is missing.");

            return res.status(500).json({
                success: false,
                message: "Image upload service is not configured.",
            });
        }

        // Prepare image data for ImgBB
        const formData = new FormData();

        const imageBlob = new Blob(
            [req.file.buffer],
            { type: req.file.mimetype }
        );

        formData.append("image", imageBlob, req.file.originalname);

        // Upload image to ImgBB
        const response = await fetch(
            `https://api.imgbb.com/1/upload?key=${apiKey}`,
            {
                method: "POST",
                body: formData,
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            console.error("ImgBB Upload Error:", result);

            return res.status(502).json({
                success: false,
                message: "Failed to upload image to ImgBB.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Image uploaded successfully.",
            image: {
                url: result.data.url,
                displayUrl: result.data.display_url,
                deleteUrl: result.data.delete_url,
            },
        });
    } catch (error) {
        console.error("Image Upload Error:", error);

        return res.status(500).json({
            success: false,
            message: "Image upload failed. Please try again.",
        });
    }
};
