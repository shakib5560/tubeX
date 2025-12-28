const asyncHandler = (requestHandler) => async (req, res, next) =>{
  try {
      await requestHandler(req, res, next);
  }  catch(err) {
      res.status(eer.code || 500).json({
          success: false,
          message: err.message,
      });
  }
}
export {asyncHandler}