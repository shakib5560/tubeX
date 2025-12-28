const promiseHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(
            requestHandler(req, res, next)
        ).catch((err) => next(err));
    };
};

export { promiseHandler };



// const promiseHandler = (fn) => async (req, res, next) => {
//   try {
//     await fn(req, res, next);
//   } catch (e){
//       res.status(500).json({error: e.message, success: false});
//   }
// }