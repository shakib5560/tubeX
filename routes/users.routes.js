import { Router} from "express";
import {registerUser} from "../controllers/users.controller.js";
import {upload} from "../middleware/multer.middleware.js";

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


export default router;