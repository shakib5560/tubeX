import { Router} from "express";
import {loginUser, logoutUser, registerUser} from "../controllers/user.controller.js";
import {upload} from "../middleware/multer.middleware.js";
import {verifyToken} from "../middleware/auth.middleware.js";

const router = Router();
router.route("/register")
    .get((req, res) => {
        res.json({ message: "GET register working" });
    })
    .post(
        upload.fields(
            [
                {
                    name: "avatar",
                    maxCount: 1,
                },
                {
                    name: "coverImage",
                    maxCount: 1,
                }
            ]
        ),
        registerUser);

router.post("/login", loginUser);

//secured routes
router.route("/logout").post(verifyToken, logoutUser);

export default router;