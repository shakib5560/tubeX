
const asyncHandler = (requestHandler) => async (req, res, next) => {
    try {
        await requestHandler(req, res, next);
    } catch (e) {
        console.error("🔥 REGISTER ERROR:", e);
        res.status(e.statusCode || 500).json({
            success: false,
            message: e.message || "Internal Server Error",
            errors: e.errors || [],
        });
    }
};

export { asyncHandler };
